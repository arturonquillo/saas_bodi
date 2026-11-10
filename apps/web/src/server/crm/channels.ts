import {
  CHANNEL_CONNECTION_MAX_NON_WA,
  CHANNEL_TYPES,
  INTERACTIVE_CHANNEL_TYPES,
  INTERACTIVE_CONTENT_TYPES,
  SOCIAL_CHANNEL_TYPES,
  WA_LIVE_REQUIRED_SECRET_KEYS,
  type ChannelType,
  type WaConnectionStatus,
} from "@saas-frota/shared";
import { publicWhatsappWebhookUrl } from "./whatsapp-webhook";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { channelSimulateInboundPort } from "../ports/channel";
import { urlEgressGuard } from "../ports/egress";
import { appendDomainEvent } from "./events";
import { channelDto, inboxDto } from "./dto";
import { assertInboxMember } from "./visibility";
import { hashToken, newOpaqueToken, tokenDisplay } from "./tokens";
import { ensureJobWorkerStarted } from "../ports/jobs";

const UNCHANGED = "__unchanged__";

const STATUS_RANK: Record<WaConnectionStatus, number> = {
  not_configured: 0,
  credentials_saved: 1,
  ready_stub: 2,
  live: 3,
};

const DEFAULT_PRE_CHAT = [
  { name: "nome", type: "text", label_pt: "Nome", required: true },
  { name: "email", type: "email", label_pt: "E-mail", required: false },
  { name: "empresa", type: "text", label_pt: "Empresa", required: false },
];

export function assertChannelType(value: string): asserts value is ChannelType {
  if (!(CHANNEL_TYPES as readonly string[]).includes(value)) {
    throw new ApiError("validacao", `channel_type inválido: ${value}`);
  }
}

export function isSocialChannel(type: string): boolean {
  return (SOCIAL_CHANNEL_TYPES as readonly string[]).includes(type);
}

export function isInteractiveChannel(type: string): boolean {
  return (INTERACTIVE_CHANNEL_TYPES as readonly string[]).includes(type);
}

export function assertInteractiveContentAllowed(
  channelType: string,
  contentType: string | undefined,
) {
  if (!contentType || contentType === "text" || contentType === "attachment") return;
  if (!(INTERACTIVE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new ApiError("validacao", `content_type inválido: ${contentType}`);
  }
  if (!isInteractiveChannel(channelType)) {
    throw new ApiError(
      "validacao",
      "Mensagens interativas só são permitidas em canais web_widget ou api.",
    );
  }
}

function normalizeConnectionStatus(
  status: string | undefined,
): WaConnectionStatus | undefined {
  if (!status) return undefined;
  // Alias product wording "connected" → schema enum `live`
  if (status === "connected") return "live";
  return status as WaConnectionStatus;
}

/** Non-WhatsApp channels cannot go live. WhatsApp may — validated in putWhatsappChannel. */
function rejectLiveNonWhatsapp(status?: WaConnectionStatus) {
  if (status === "live") {
    throw new ApiError(
      "nao_implementado",
      "Status live não está disponível para este canal (somente WhatsApp Cloud API).",
    );
  }
  if (status && STATUS_RANK[status] > STATUS_RANK[CHANNEL_CONNECTION_MAX_NON_WA]) {
    throw new ApiError("validacao", "Status de conexão acima de ready_stub não permitido.");
  }
}

async function assertWhatsappLiveReady(input: {
  phoneNumberId: string | null | undefined;
  businessAccountId: string | null | undefined;
  secretsCiphertext: string | null | undefined;
}) {
  if (!input.phoneNumberId?.trim()) {
    throw new ApiError("validacao", "Phone Number ID é obrigatório para status live.");
  }
  if (!input.businessAccountId?.trim()) {
    throw new ApiError(
      "validacao",
      "WhatsApp Business Account ID é obrigatório para status live.",
    );
  }
  if (!input.secretsCiphertext) {
    throw new ApiError(
      "validacao",
      "Credenciais Meta (Access Token, App Secret, Verify Token) são obrigatórias para live.",
    );
  }
  const secrets = await channelCredentialsVault.open(input.secretsCiphertext);
  for (const key of WA_LIVE_REQUIRED_SECRET_KEYS) {
    if (!secrets[key]?.trim()) {
      throw new ApiError(
        "validacao",
        `Segredo obrigatório ausente para live: ${key}.`,
      );
    }
  }
}

async function sealSecretsMerge(
  existingCipher: string | null | undefined,
  writes: Record<string, string | undefined>,
): Promise<string | null | undefined> {
  const keys = Object.keys(writes).filter((k) => writes[k] !== undefined);
  if (!keys.length) return undefined;
  let existing: Record<string, string> = {};
  if (existingCipher) {
    existing = await channelCredentialsVault.open(existingCipher);
  }
  const next = { ...existing };
  for (const k of keys) {
    const v = writes[k]!;
    if (v === UNCHANGED) continue;
    next[k] = v;
  }
  return channelCredentialsVault.seal(next);
}

export async function listInboxes(session: SessionContext) {
  ensureJobWorkerStarted();
  assertSaasRole(session, "admin", "vendedor");
  if (session.saasRole === "admin") {
    const rows = await db.inbox.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        channelWhatsapp: true,
        channelWebsiteWidget: true,
        channelEmail: true,
        channelSocial: true,
        channelSms: true,
        channelApi: true,
        channelVoice: true,
      },
    });
    return {
      items: rows.map((r) => ({
        ...inboxDto(r),
        connection_status: connectionStatusOf(r),
      })),
    };
  }
  const memberships = await db.inboxMember.findMany({
    where: { tenantId: session.tenantId, userId: session.userId },
    include: {
      inbox: {
        include: {
          channelWhatsapp: true,
          channelWebsiteWidget: true,
          channelEmail: true,
          channelSocial: true,
          channelSms: true,
          channelApi: true,
        },
      },
    },
  });
  return {
    items: memberships.map((m) => ({
      ...inboxDto(m.inbox),
      connection_status: connectionStatusOf(m.inbox),
    })),
  };
}

function connectionStatusOf(row: {
  channelType: string;
  channelWhatsapp?: { connectionStatus: string } | null;
  channelWebsiteWidget?: { connectionStatus: string } | null;
  channelEmail?: { connectionStatus: string } | null;
  channelSocial?: { connectionStatus: string } | null;
  channelSms?: { connectionStatus: string } | null;
  channelApi?: { connectionStatus: string } | null;
  channelVoice?: { connectionStatus: string } | null;
}): string | null {
  switch (row.channelType) {
    case "whatsapp":
      return row.channelWhatsapp?.connectionStatus ?? null;
    case "web_widget":
      return row.channelWebsiteWidget?.connectionStatus ?? null;
    case "email":
      return row.channelEmail?.connectionStatus ?? null;
    case "sms":
      return row.channelSms?.connectionStatus ?? null;
    case "api":
      return row.channelApi?.connectionStatus ?? null;
    case "voice":
      return row.channelVoice?.connectionStatus ?? null;
    default:
      if (isSocialChannel(row.channelType)) {
        return row.channelSocial?.connectionStatus ?? null;
      }
      return null;
  }
}

async function createTypedChannel(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: { tenantId: string; inboxId: string; channelType: ChannelType },
) {
  const { tenantId, inboxId, channelType } = input;
  switch (channelType) {
    case "whatsapp":
      await tx.channelWhatsapp.create({
        data: {
          id: newId("chw"),
          tenantId,
          inboxId,
          connectionStatus: "not_configured",
          messageTemplatesJson: "[]",
        },
      });
      return;
    case "web_widget": {
      const websiteToken = newOpaqueToken(24);
      const hmacPlain = newOpaqueToken(32);
      const hmacSecretCiphertext = await channelCredentialsVault.seal({
        hmac_secret: hmacPlain,
      });
      await tx.channelWebsiteWidget.create({
        data: {
          id: newId("cww"),
          tenantId,
          inboxId,
          websiteToken,
          hmacSecretCiphertext,
          allowedOriginsJson: JSON.stringify(["http://localhost:3000"]),
          preChatFieldsJson: JSON.stringify(DEFAULT_PRE_CHAT),
          continuity: "session",
          connectionStatus: "ready_stub",
        },
      });
      return;
    }
    case "email":
      await tx.channelEmail.create({
        data: {
          id: newId("cem"),
          tenantId,
          inboxId,
          provider: "smtp_imap",
          connectionStatus: "not_configured",
        },
      });
      return;
    case "sms":
      await tx.channelSms.create({
        data: {
          id: newId("csm"),
          tenantId,
          inboxId,
          provider: "twilio",
          connectionStatus: "not_configured",
        },
      });
      return;
    case "api":
      await tx.channelApi.create({
        data: {
          id: newId("cap"),
          tenantId,
          inboxId,
          connectionStatus: "not_configured",
        },
      });
      return;
    case "voice":
      await tx.channelVoice.create({
        data: {
          id: newId("cvo"),
          tenantId,
          inboxId,
          provider: "twilio_voice",
          connectionStatus: "not_configured",
        },
      });
      return;
    default:
      if (isSocialChannel(channelType)) {
        await tx.channelSocial.create({
          data: {
            id: newId("cso"),
            tenantId,
            inboxId,
            provider: channelType,
            connectionStatus: "not_configured",
          },
        });
        return;
      }
      throw new ApiError("validacao", `channel_type não suportado: ${channelType}`);
  }
}

export async function createInbox(
  session: SessionContext,
  input: { name: string; channel_type?: string },
) {
  assertSaasRole(session, "admin");
  if (!input.name.trim()) throw new ApiError("validacao", "Nome da caixa é obrigatório.");
  const channelType = (input.channel_type ?? "whatsapp") as ChannelType;
  assertChannelType(channelType);
  const inboxId = newId("inx");
  await db.$transaction(async (tx) => {
    await tx.inbox.create({
      data: {
        id: inboxId,
        tenantId: session.tenantId,
        name: input.name.trim(),
        channelType,
        lockToSingleConversation: channelType === "web_widget" ? true : undefined,
      },
    });
    await createTypedChannel(tx, {
      tenantId: session.tenantId,
      inboxId,
      channelType,
    });
    await tx.inboxMember.create({
      data: {
        id: newId("inm"),
        tenantId: session.tenantId,
        inboxId,
        userId: session.userId,
      },
    });
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "channel.updated",
    aggregateType: "inbox",
    aggregateId: inboxId,
    actorUserId: session.userId,
    payload: { inbox_id: inboxId, channel_type: channelType, created: true },
  });
  return getInbox(session, inboxId);
}

export async function getInbox(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.inbox.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      channelWhatsapp: true,
      channelWebsiteWidget: true,
      channelEmail: true,
      channelSocial: true,
      channelSms: true,
      channelApi: true,
      channelVoice: true,
    },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertInboxMember(session, id);
  return {
    ...inboxDto(row),
    connection_status: connectionStatusOf(row),
  };
}

export async function patchInbox(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    greeting?: string | null;
    ooo_message?: string | null;
    csat_enabled?: boolean;
    lock_to_single_conversation?: boolean;
    allow_auto_assign?: boolean;
    vendedor_see_all?: boolean;
    timezone?: string;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.inbox.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.inbox.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      greeting: input.greeting === undefined ? undefined : input.greeting,
      oooMessage: input.ooo_message === undefined ? undefined : input.ooo_message,
      csatEnabled: input.csat_enabled,
      lockToSingleConversation: input.lock_to_single_conversation,
      allowAutoAssign: input.allow_auto_assign,
      vendedorSeeAll: input.vendedor_see_all,
      timezone: input.timezone,
    },
  });
  return getInbox(session, id);
}

export async function getInboxMembers(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  const members = await db.inboxMember.findMany({
    where: { tenantId: session.tenantId, inboxId },
    include: { user: { select: { id: true, nome: true, email: true } } },
  });
  return {
    user_ids: members.map((m) => m.userId),
    members: members.map((m) => ({
      user_id: m.userId,
      nome: m.user.nome,
      email: m.user.email,
    })),
  };
}

export async function putInboxMembers(
  session: SessionContext,
  inboxId: string,
  userIds: string[],
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  const unique = [...new Set(userIds)];
  for (const uid of unique) {
    const mem = await db.membership.findFirst({
      where: { tenantId: session.tenantId, userId: uid, saasRole: { not: null } },
    });
    if (!mem) throw new ApiError("validacao", "Usuário inválido para a caixa.");
  }
  await db.$transaction(async (tx) => {
    await tx.inboxMember.deleteMany({ where: { tenantId: session.tenantId, inboxId } });
    for (const uid of unique) {
      await tx.inboxMember.create({
        data: {
          id: newId("inm"),
          tenantId: session.tenantId,
          inboxId,
          userId: uid,
        },
      });
    }
  });
  return getInboxMembers(session, inboxId);
}

export async function getChannel(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (session.saasRole !== "admin") {
    await assertInboxMember(session, inboxId);
  }
  return getChannelDto(session.tenantId, inboxId, inbox.channelType);
}

async function getChannelDto(tenantId: string, inboxId: string, channelType: string) {
  switch (channelType) {
    case "whatsapp": {
      const channel = await db.channelWhatsapp.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "whatsapp" as const,
        ...channelDto(channel),
        webhook_url: publicWhatsappWebhookUrl(inboxId),
        webhook_url_global: "/api/webhooks/whatsapp",
      };
    }
    case "web_widget": {
      const channel = await db.channelWebsiteWidget.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "web_widget" as const,
        id: channel.id,
        inbox_id: channel.inboxId,
        website_token: channel.websiteToken,
        hmac_secret_present: Boolean(channel.hmacSecretCiphertext),
        allowed_origins: JSON.parse(channel.allowedOriginsJson || "[]") as string[],
        pre_chat_fields: JSON.parse(channel.preChatFieldsJson || "[]") as unknown[],
        welcome_title: channel.welcomeTitle,
        widget_color: channel.widgetColor,
        continuity: channel.continuity,
        connection_status: channel.connectionStatus,
      };
    }
    case "email": {
      const channel = await db.channelEmail.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "email" as const,
        id: channel.id,
        inbox_id: channel.inboxId,
        provider: channel.provider,
        forward_to_email: channel.forwardToEmail,
        from_email_display: channel.fromEmailDisplay,
        email_template_id: channel.emailTemplateId,
        connection_status: channel.connectionStatus,
        secrets_present: Boolean(channel.secretsCiphertext),
        imap_password: channel.secretsCiphertext ? "••••••••" : null,
        smtp_password: channel.secretsCiphertext ? "••••••••" : null,
        oauth_token: channel.secretsCiphertext ? "••••••••" : null,
      };
    }
    case "sms": {
      const channel = await db.channelSms.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "sms" as const,
        id: channel.id,
        inbox_id: channel.inboxId,
        provider: channel.provider,
        from_number_display: channel.fromNumberDisplay,
        connection_status: channel.connectionStatus,
        secrets_present: Boolean(channel.secretsCiphertext),
        account_sid: channel.secretsCiphertext ? "••••••••" : null,
        auth_token: channel.secretsCiphertext ? "••••••••" : null,
      };
    }
    case "api": {
      const channel = await db.channelApi.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "api" as const,
        id: channel.id,
        inbox_id: channel.inboxId,
        token_prefix: channel.tokenPrefix,
        token_last4: channel.tokenLast4,
        callback_url: channel.callbackUrl,
        connection_status: channel.connectionStatus,
        token_present: Boolean(channel.apiAccessTokenHash),
      };
    }
    case "voice": {
      const channel = await db.channelVoice.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: "voice" as const,
        id: channel.id,
        inbox_id: channel.inboxId,
        provider: channel.provider,
        connection_status: channel.connectionStatus,
        secrets_present: Boolean(channel.secretsCiphertext),
        metadata: channel.metadataJson ? JSON.parse(channel.metadataJson) : null,
      };
    }
    default: {
      if (!isSocialChannel(channelType)) {
        throw new ApiError("nao_encontrado", "Não encontrado.");
      }
      const channel = await db.channelSocial.findFirst({ where: { tenantId, inboxId } });
      if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
      return {
        channel_type: channelType,
        id: channel.id,
        inbox_id: channel.inboxId,
        provider: channel.provider,
        external_page_or_bot_id: channel.externalPageOrBotId,
        connection_status: channel.connectionStatus,
        secrets_present: Boolean(channel.secretsCiphertext),
        access_token: channel.secretsCiphertext ? "••••••••" : null,
      };
    }
  }
}

export async function putChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  const status = normalizeConnectionStatus(
    input.connection_status === undefined ? undefined : String(input.connection_status),
  );
  if (status !== undefined) {
    input = { ...input, connection_status: status };
  }
  if (inbox.channelType !== "whatsapp") {
    rejectLiveNonWhatsapp(status);
  }

  switch (inbox.channelType) {
    case "whatsapp":
      await putWhatsappChannel(session, inboxId, input);
      break;
    case "web_widget":
      await putWidgetChannel(session, inboxId, input);
      break;
    case "email":
      await putEmailChannel(session, inboxId, input);
      break;
    case "sms":
      await putSmsChannel(session, inboxId, input);
      break;
    case "api":
      await putApiChannel(session, inboxId, input);
      break;
    case "voice":
      await putVoiceChannel(session, inboxId, input);
      break;
    default:
      if (isSocialChannel(inbox.channelType)) {
        await putSocialChannel(session, inboxId, input);
      } else {
        throw new ApiError("validacao", "Canal não suportado.");
      }
  }

  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "channel.updated",
    aggregateType: "inbox",
    aggregateId: inboxId,
    actorUserId: session.userId,
    payload: { inbox_id: inboxId, channel_type: inbox.channelType },
  });
  return getChannel(session, inboxId);
}

async function putWhatsappChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const secretsCiphertext = await sealSecretsMerge(channel.secretsCiphertext, {
    api_token: input.api_token as string | undefined,
    api_secret: input.api_secret as string | undefined,
    webhook_verify_token: input.webhook_verify_token as string | undefined,
  });
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  const nextSecrets = secretsCiphertext === undefined ? channel.secretsCiphertext : secretsCiphertext;
  const nextPhoneNumberId =
    input.phone_number_id === undefined
      ? channel.phoneNumberId
      : (input.phone_number_id as string | null);
  const nextBusinessAccountId =
    input.business_account_id === undefined
      ? channel.businessAccountId
      : (input.business_account_id as string | null);

  if (nextSecrets && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }
  if (connectionStatus === "live") {
    await assertWhatsappLiveReady({
      phoneNumberId: nextPhoneNumberId,
      businessAccountId: nextBusinessAccountId,
      secretsCiphertext: nextSecrets,
    });
  }
  await db.channelWhatsapp.update({
    where: { id: channel.id },
    data: {
      phoneE164Display:
        input.phone_e164_display === undefined
          ? undefined
          : (input.phone_e164_display as string | null),
      phoneNumberId:
        input.phone_number_id === undefined ? undefined : (input.phone_number_id as string | null),
      businessAccountId:
        input.business_account_id === undefined
          ? undefined
          : (input.business_account_id as string | null),
      secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      connectionStatus,
      provider: input.provider as "whatsapp_cloud" | "default" | undefined,
    },
  });
}

async function putWidgetChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelWebsiteWidget.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  let hmacSecretCiphertext = channel.hmacSecretCiphertext;
  if (typeof input.hmac_secret === "string" && input.hmac_secret !== UNCHANGED) {
    hmacSecretCiphertext = await channelCredentialsVault.seal({
      hmac_secret: input.hmac_secret,
    });
  }
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  if (channel.websiteToken && hmacSecretCiphertext && connectionStatus === "not_configured") {
    connectionStatus = "ready_stub";
  } else if (hmacSecretCiphertext && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }
  await db.channelWebsiteWidget.update({
    where: { id: channel.id },
    data: {
      hmacSecretCiphertext,
      allowedOriginsJson:
        input.allowed_origins === undefined
          ? undefined
          : JSON.stringify(input.allowed_origins ?? []),
      preChatFieldsJson:
        input.pre_chat_fields === undefined
          ? undefined
          : JSON.stringify(input.pre_chat_fields ?? []),
      welcomeTitle:
        input.welcome_title === undefined ? undefined : (input.welcome_title as string | null),
      widgetColor:
        input.widget_color === undefined ? undefined : (input.widget_color as string | null),
      continuity:
        input.continuity === undefined ? undefined : String(input.continuity ?? "session"),
      connectionStatus,
    },
  });
}

async function putEmailChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelEmail.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const secretsCiphertext = await sealSecretsMerge(channel.secretsCiphertext, {
    imap_password: input.imap_password as string | undefined,
    smtp_password: input.smtp_password as string | undefined,
    oauth_token: input.oauth_token as string | undefined,
  });
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  const nextSecrets = secretsCiphertext === undefined ? channel.secretsCiphertext : secretsCiphertext;
  if (nextSecrets && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }
  if (connectionStatus === "credentials_saved" || connectionStatus === "ready_stub") {
    // ready_stub allowed when credentials saved — admin may set explicitly
  }
  await db.channelEmail.update({
    where: { id: channel.id },
    data: {
      provider: input.provider === undefined ? undefined : String(input.provider),
      forwardToEmail:
        input.forward_to_email === undefined
          ? undefined
          : (input.forward_to_email as string | null),
      fromEmailDisplay:
        input.from_email_display === undefined
          ? undefined
          : (input.from_email_display as string | null),
      emailTemplateId:
        input.email_template_id === undefined
          ? undefined
          : (input.email_template_id as string | null),
      secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      connectionStatus,
    },
  });
}

async function putSmsChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelSms.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const secretsCiphertext = await sealSecretsMerge(channel.secretsCiphertext, {
    account_sid: input.account_sid as string | undefined,
    auth_token: input.auth_token as string | undefined,
  });
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  const nextSecrets = secretsCiphertext === undefined ? channel.secretsCiphertext : secretsCiphertext;
  if (nextSecrets && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }
  await db.channelSms.update({
    where: { id: channel.id },
    data: {
      provider: input.provider === undefined ? undefined : String(input.provider),
      fromNumberDisplay:
        input.from_number_display === undefined
          ? undefined
          : (input.from_number_display as string | null),
      secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      connectionStatus,
    },
  });
}

async function putApiChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelApi.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  let callbackUrl = channel.callbackUrl;
  if (input.callback_url !== undefined) {
    const raw = input.callback_url as string | null;
    if (raw) {
      const safe = await urlEgressGuard.assertSafeHttpsUrl(raw);
      callbackUrl = safe.href;
    } else {
      callbackUrl = null;
    }
  }
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  if (channel.apiAccessTokenHash && connectionStatus === "not_configured") {
    connectionStatus = "ready_stub";
  }
  await db.channelApi.update({
    where: { id: channel.id },
    data: {
      callbackUrl,
      connectionStatus,
    },
  });
}

async function putSocialChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelSocial.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const secretsCiphertext = await sealSecretsMerge(channel.secretsCiphertext, {
    access_token: input.access_token as string | undefined,
    bot_token: input.bot_token as string | undefined,
  });
  let connectionStatus =
    (input.connection_status as WaConnectionStatus | undefined) ?? channel.connectionStatus;
  const nextSecrets = secretsCiphertext === undefined ? channel.secretsCiphertext : secretsCiphertext;
  if (nextSecrets && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }
  await db.channelSocial.update({
    where: { id: channel.id },
    data: {
      externalPageOrBotId:
        input.external_page_or_bot_id === undefined
          ? undefined
          : (input.external_page_or_bot_id as string | null),
      secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      connectionStatus,
    },
  });
}

export async function getTemplates(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin");
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  return { items: JSON.parse(channel.messageTemplatesJson || "[]") as unknown[] };
}

export async function putTemplates(
  session: SessionContext,
  inboxId: string,
  templates: unknown[],
) {
  assertSaasRole(session, "admin");
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.channelWhatsapp.update({
    where: { id: channel.id },
    data: { messageTemplatesJson: JSON.stringify(templates ?? []) },
  });
  return getTemplates(session, inboxId);
}

export async function getWidgetConfig(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox || inbox.channelType !== "web_widget") {
    throw new ApiError("nao_encontrado", "Caixa web_widget não encontrada.");
  }
  return getChannel(session, inboxId);
}

export async function putWidgetConfig(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox || inbox.channelType !== "web_widget") {
    throw new ApiError("nao_encontrado", "Caixa web_widget não encontrada.");
  }
  return putChannel(session, inboxId, input);
}

export async function getWidgetSnippet(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin");
  const channel = await db.channelWebsiteWidget.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const snippet = `<script src="/widget.js" data-website-token="${channel.websiteToken}" async></script>`;
  return {
    website_token: channel.websiteToken,
    snippet,
  };
}

export async function rotateChannelToken(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");

  if (inbox.channelType === "web_widget") {
    const channel = await db.channelWebsiteWidget.findFirst({
      where: { tenantId: session.tenantId, inboxId },
    });
    if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
    const websiteToken = newOpaqueToken(24);
    const hmacPlain = newOpaqueToken(32);
    const hmacSecretCiphertext = await channelCredentialsVault.seal({
      hmac_secret: hmacPlain,
    });
    await db.channelWebsiteWidget.update({
      where: { id: channel.id },
      data: {
        websiteToken,
        hmacSecretCiphertext,
        connectionStatus: "ready_stub",
      },
    });
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "channel.updated",
      aggregateType: "inbox",
      aggregateId: inboxId,
      actorUserId: session.userId,
      payload: { inbox_id: inboxId, rotated: "website_token" },
    });
    return {
      channel_type: "web_widget" as const,
      website_token: websiteToken,
      hmac_secret: hmacPlain,
    };
  }

  if (inbox.channelType === "api") {
    const channel = await db.channelApi.findFirst({
      where: { tenantId: session.tenantId, inboxId },
    });
    if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
    const plaintext = newOpaqueToken(32);
    const { prefix, last4 } = tokenDisplay(plaintext);
    await db.channelApi.update({
      where: { id: channel.id },
      data: {
        apiAccessTokenHash: hashToken(plaintext),
        tokenPrefix: prefix,
        tokenLast4: last4,
        connectionStatus: "ready_stub",
      },
    });
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "channel.updated",
      aggregateType: "inbox",
      aggregateId: inboxId,
      actorUserId: session.userId,
      payload: { inbox_id: inboxId, rotated: "api_access_token" },
    });
    return {
      channel_type: "api" as const,
      api_access_token: plaintext,
      token_prefix: prefix,
      token_last4: last4,
    };
  }

  throw new ApiError("validacao", "Rotação de token só para web_widget ou api.");
}


async function putVoiceChannel(
  session: SessionContext,
  inboxId: string,
  input: Record<string, unknown>,
) {
  const channel = await db.channelVoice.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  const status = input.connection_status as WaConnectionStatus | undefined;
  rejectLiveNonWhatsapp(status);
  let secretsCiphertext: string | null | undefined = undefined;
  if (input.secrets && typeof input.secrets === "object") {
    secretsCiphertext = await sealSecretsMerge(
      channel.secretsCiphertext,
      input.secrets as Record<string, string | undefined>,
    );
  }
  const provider = input.provider as string | undefined;
  if (provider && provider !== "twilio_voice" && provider !== "wa_calling") {
    throw new ApiError("validacao", "provider de voz inválido.");
  }
  await db.channelVoice.update({
    where: { id: channel.id },
    data: {
      provider: provider,
      connectionStatus: status,
      secretsCiphertext: secretsCiphertext === undefined ? undefined : secretsCiphertext,
      metadataJson:
        input.metadata === undefined
          ? undefined
          : input.metadata
            ? JSON.stringify(input.metadata)
            : null,
    },
  });
}

export async function simulateChannelInbound(
  session: SessionContext,
  inboxId: string,
  input: {
    source_id?: string;
    phone_e164?: string;
    email?: string;
    body: string;
    contact_nome?: string;
  },
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!input.body?.trim()) throw new ApiError("validacao", "Mensagem obrigatória.");

  if (inbox.channelType === "web_widget") {
    throw new ApiError(
      "validacao",
      "Use as rotas /api/loja/widget/* para o canal web_widget.",
    );
  }

  if (inbox.channelType === "voice") {
    // Fall through to generic stub ingest with system note content if blank-ish
    if (!input.body.trim() || input.body.trim() === "chamada") {
      input = { ...input, body: "chamada simulada" };
    }
  }

  if (inbox.channelType === "whatsapp") {
    const phone = input.phone_e164?.trim();
    if (!phone) throw new ApiError("validacao", "phone_e164 obrigatório para WhatsApp.");
    const result = await channelSimulateInboundPort.ingestInbound({
      tenantId: session.tenantId,
      inboxId,
      phoneE164: phone,
      body: input.body.trim(),
    });
    return { conversation_id: result.conversationId, message_id: result.messageId };
  }

  // Generic stub ingest for email/social/sms/api — no provider HTTP.
  const sourceId =
    input.source_id?.trim() ||
    input.email?.trim() ||
    input.phone_e164?.trim() ||
    `sim:${newId("src")}`;
  const nome = input.contact_nome?.trim() || sourceId;

  let contact = await db.contact.findFirst({
    where: {
      tenantId: session.tenantId,
      mergedIntoId: null,
      OR: [
        ...(input.email ? [{ email: input.email.trim() }] : []),
        ...(input.phone_e164 ? [{ phoneE164: input.phone_e164.trim() }] : []),
      ],
    },
  });
  if (!contact) {
    contact = await db.contact.create({
      data: {
        id: newId("ct"),
        tenantId: session.tenantId,
        nome,
        email: input.email?.trim() ?? null,
        phoneE164: input.phone_e164?.trim() ?? null,
      },
    });
  }

  const existingCi = await db.contactInbox.findFirst({
    where: { tenantId: session.tenantId, inboxId, sourceId },
  });
  if (!existingCi) {
    await db.contactInbox.create({
      data: {
        id: newId("ci"),
        tenantId: session.tenantId,
        contactId: contact.id,
        inboxId,
        sourceId,
      },
    });
  }

  let conversation = await db.conversation.findFirst({
    where: {
      tenantId: session.tenantId,
      inboxId,
      contactId: contact.id,
      status: { in: ["open", "pending", "snoozed"] },
    },
    orderBy: { lastActivityAt: "desc" },
  });
  const now = new Date();
  let created = false;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        id: newId("cnv"),
        tenantId: session.tenantId,
        inboxId,
        contactId: contact.id,
        status: "open",
        lastActivityAt: now,
      },
    });
    created = true;
  } else {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastActivityAt: now },
    });
  }

  const messageId = newId("msg");
  await db.message.create({
    data: {
      id: messageId,
      tenantId: session.tenantId,
      conversationId: conversation.id,
      messageType: "incoming",
      private: false,
      content: input.body.trim(),
      contentType: "text",
      deliveryStatus: "delivered",
      simulated: true,
    },
  });

  if (created) {
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "conversation.created",
      aggregateType: "conversation",
      aggregateId: conversation.id,
      payload: { conversation_id: conversation.id, inbox_id: inboxId },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "message.created",
    aggregateType: "message",
    aggregateId: messageId,
    payload: {
      conversation_id: conversation.id,
      inbox_id: inboxId,
      message_id: messageId,
      message_type: "incoming",
      simulated_channel: inbox.channelType,
    },
  });

  if (inbox.channelType === "voice") {
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "voice.simulated",
      aggregateType: "conversation",
      aggregateId: conversation.id,
      actorUserId: session.userId,
      payload: { conversation_id: conversation.id, inbox_id: inboxId },
    });
  }

  return { conversation_id: conversation.id, message_id: messageId, contact_id: contact.id };
}


export async function putRequiredAttributesOnResolve(
  session: SessionContext,
  inboxId: string,
  input: { keys: string[] },
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!Array.isArray(input.keys)) throw new ApiError("validacao", "keys deve ser array.");
  const keys = input.keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  await db.inbox.update({
    where: { id: inboxId },
    data: { requiredAttributeKeysOnResolveJson: JSON.stringify(keys) },
  });
  return { inbox_id: inboxId, keys };
}
