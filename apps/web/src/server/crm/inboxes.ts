import type { WaConnectionStatus } from "@saas-frota/shared";
import { WA_CONNECTION_MAX_PHASE_A } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { channelDto, inboxDto } from "./dto";
import { assertInboxMember } from "./visibility";
import { ensureJobWorkerStarted } from "../ports/jobs";

const UNCHANGED = "__unchanged__";

const STATUS_RANK: Record<WaConnectionStatus, number> = {
  not_configured: 0,
  credentials_saved: 1,
  ready_stub: 2,
  live: 3,
};

export async function listInboxes(session: SessionContext) {
  ensureJobWorkerStarted();
  assertSaasRole(session, "admin", "vendedor");
  if (session.saasRole === "admin") {
    const rows = await db.inbox.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "asc" },
    });
    return { items: rows.map(inboxDto) };
  }
  const memberships = await db.inboxMember.findMany({
    where: { tenantId: session.tenantId, userId: session.userId },
    include: { inbox: true },
  });
  return { items: memberships.map((m) => inboxDto(m.inbox)) };
}

export async function createInbox(
  session: SessionContext,
  input: { name: string; channel_type?: "whatsapp" },
) {
  assertSaasRole(session, "admin");
  if (!input.name.trim()) throw new ApiError("validacao", "Nome da caixa é obrigatório.");
  const channelType = input.channel_type ?? "whatsapp";
  if (channelType !== "whatsapp") {
    throw new ApiError("validacao", "Somente canal whatsapp na Fase A.");
  }
  const inboxId = newId("inx");
  await db.$transaction(async (tx) => {
    await tx.inbox.create({
      data: {
        id: inboxId,
        tenantId: session.tenantId,
        name: input.name.trim(),
        channelType: "whatsapp",
      },
    });
    await tx.channelWhatsapp.create({
      data: {
        id: newId("chw"),
        tenantId: session.tenantId,
        inboxId,
        connectionStatus: "not_configured",
        messageTemplatesJson: "[]",
      },
    });
    // Admin creator is a member
    await tx.inboxMember.create({
      data: {
        id: newId("inm"),
        tenantId: session.tenantId,
        inboxId,
        userId: session.userId,
      },
    });
  });
  return getInbox(session, inboxId);
}

export async function getInbox(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.inbox.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertInboxMember(session, id);
  return inboxDto(row);
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
  assertSaasRole(session, "admin");
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");
  return channelDto(channel);
}

export async function putChannel(
  session: SessionContext,
  inboxId: string,
  input: {
    phone_e164_display?: string | null;
    phone_number_id?: string | null;
    business_account_id?: string | null;
    api_token?: string;
    api_secret?: string;
    webhook_verify_token?: string;
    connection_status?: WaConnectionStatus;
    provider?: "whatsapp_cloud" | "default";
  },
) {
  assertSaasRole(session, "admin");
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Não encontrado.");

  if (input.connection_status === "live") {
    throw new ApiError(
      "validacao",
      "Status live não está disponível até a integração Meta ser liberada.",
    );
  }
  if (
    input.connection_status &&
    STATUS_RANK[input.connection_status] > STATUS_RANK[WA_CONNECTION_MAX_PHASE_A]
  ) {
    throw new ApiError("validacao", "Status de conexão acima de ready_stub não permitido.");
  }

  let secretsCiphertext = channel.secretsCiphertext;
  const wantsSecretWrite =
    (input.api_token && input.api_token !== UNCHANGED) ||
    (input.api_secret && input.api_secret !== UNCHANGED) ||
    (input.webhook_verify_token && input.webhook_verify_token !== UNCHANGED);

  if (wantsSecretWrite) {
    let existing: Record<string, string> = {};
    if (channel.secretsCiphertext) {
      existing = await channelCredentialsVault.open(channel.secretsCiphertext);
    }
    const next = {
      api_token:
        input.api_token && input.api_token !== UNCHANGED
          ? input.api_token
          : (existing.api_token ?? ""),
      api_secret:
        input.api_secret && input.api_secret !== UNCHANGED
          ? input.api_secret
          : (existing.api_secret ?? ""),
      webhook_verify_token:
        input.webhook_verify_token && input.webhook_verify_token !== UNCHANGED
          ? input.webhook_verify_token
          : (existing.webhook_verify_token ?? ""),
    };
    secretsCiphertext = await channelCredentialsVault.seal(next);
  }

  let connectionStatus = input.connection_status ?? channel.connectionStatus;
  if (secretsCiphertext && connectionStatus === "not_configured") {
    connectionStatus = "credentials_saved";
  }

  await db.channelWhatsapp.update({
    where: { id: channel.id },
    data: {
      phoneE164Display:
        input.phone_e164_display === undefined ? undefined : input.phone_e164_display,
      phoneNumberId: input.phone_number_id === undefined ? undefined : input.phone_number_id,
      businessAccountId:
        input.business_account_id === undefined ? undefined : input.business_account_id,
      secretsCiphertext,
      connectionStatus,
      provider: input.provider,
    },
  });
  return getChannel(session, inboxId);
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
