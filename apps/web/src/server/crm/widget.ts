import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { appendDomainEvent, fanoutCrmEvent, subscribeCrmSse } from "./events";
import { conversationDto, messageDto } from "./dto";
import { hashToken, newOpaqueToken } from "./tokens";
import { ensureJobWorkerStarted } from "../ports/jobs";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "cdf_widget_session";

type PreChatField = {
  name: string;
  type: string;
  label_pt: string;
  required: boolean;
};

type WidgetChannel = {
  id: string;
  tenantId: string;
  inboxId: string;
  websiteToken: string;
  hmacSecretCiphertext: string | null;
  allowedOriginsJson: string;
  preChatFieldsJson: string;
  welcomeTitle: string | null;
  widgetColor: string | null;
  continuity: string;
  connectionStatus: string;
};

type WidgetSessionRow = {
  id: string;
  tenantId: string;
  inboxId: string;
  websiteToken: string;
  sessionTokenHash: string;
  contactId: string | null;
  conversationId: string | null;
  preChatJson: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
};

export function parseWidgetSessionToken(req: Request): string | null {
  const header = req.headers.get("x-widget-session")?.trim();
  if (header) return header;
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function widgetSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

async function loadWidgetByToken(websiteToken: string): Promise<{
  channel: WidgetChannel;
  inbox: {
    id: string;
    tenantId: string;
    greeting: string | null;
    oooMessage: string | null;
    lockToSingleConversation: boolean;
    name: string;
  };
}> {
  const channel = await db.channelWebsiteWidget.findFirst({
    where: { websiteToken },
  });
  if (!channel) throw new ApiError("nao_encontrado", "Widget não encontrado.");
  const inbox = await db.inbox.findFirst({
    where: { id: channel.inboxId, tenantId: channel.tenantId },
  });
  if (!inbox) throw new ApiError("nao_encontrado", "Widget não encontrado.");
  return { channel, inbox };
}

function assertOriginAllowed(channel: WidgetChannel, origin: string | null) {
  let allowed: string[] = [];
  try {
    allowed = JSON.parse(channel.allowedOriginsJson || "[]") as string[];
  } catch {
    allowed = [];
  }
  if (!allowed.length) return;
  if (!origin) throw new ApiError("forbidden", "Origin obrigatória.");
  const ok = allowed.some((a) => a === "*" || a === origin || origin.startsWith(a));
  if (!ok) throw new ApiError("forbidden", "Origin não permitida.");
}

async function hmacSecret(channel: WidgetChannel): Promise<string> {
  if (!channel.hmacSecretCiphertext) {
    throw new ApiError("validacao", "Widget sem hmac configurado.");
  }
  const opened = await channelCredentialsVault.open(channel.hmacSecretCiphertext);
  return opened.hmac_secret ?? "";
}

function signSessionPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function bootstrapWidget(input: {
  websiteToken: string;
  origin?: string | null;
}) {
  ensureJobWorkerStarted();
  const { channel, inbox } = await loadWidgetByToken(input.websiteToken);
  assertOriginAllowed(channel, input.origin ?? null);

  const campaigns = await listActiveOngoingForInbox(channel.tenantId, inbox.id);
  for (const c of campaigns) {
    if (c.display_status !== "ready") {
      await db.campaign.update({
        where: { id: c.id },
        data: { displayStatus: "ready" },
      });
      await appendDomainEvent(db, {
        tenantId: channel.tenantId,
        type: "campaign.displayed",
        aggregateType: "campaign",
        aggregateId: c.id,
        payload: { campaign_id: c.id, inbox_id: inbox.id },
      });
      c.display_status = "ready";
    }
  }

  return {
    inbox_id: inbox.id,
    website_token: channel.websiteToken,
    greeting: inbox.greeting,
    ooo_message: inbox.oooMessage,
    welcome_title: channel.welcomeTitle,
    widget_color: channel.widgetColor,
    pre_chat_fields: JSON.parse(channel.preChatFieldsJson || "[]") as PreChatField[],
    continuity: channel.continuity,
    campaigns,
  };
}

async function listActiveOngoingForInbox(tenantId: string, inboxId: string) {
  const rows = await db.campaign.findMany({
    where: {
      tenantId,
      kind: "ongoing",
      status: "active",
      OR: [{ inboxId }, { inboxId: null }],
      displayStatus: { in: ["ready", "awaiting_widget"] },
    },
    orderBy: { createdAt: "desc" },
  });
  // Only serve ready; awaiting_widget may be flipped by bootstrap when widget ready.
  return rows
    .filter((r) => r.displayStatus === "ready" || r.displayStatus === "awaiting_widget")
    .filter((r) => !r.inboxId || r.inboxId === inboxId)
    .map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      display_status: r.displayStatus,
    }));
}

export async function createWidgetSession(input: {
  websiteToken: string;
  origin?: string | null;
}) {
  const { channel, inbox } = await loadWidgetByToken(input.websiteToken);
  assertOriginAllowed(channel, input.origin ?? null);
  const sessionToken = newOpaqueToken(32);
  const secret = await hmacSecret(channel);
  const signed = `${sessionToken}.${signSessionPayload(secret, sessionToken)}`;
  const id = newId("wses");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.widgetSession.create({
    data: {
      id,
      tenantId: channel.tenantId,
      inboxId: inbox.id,
      websiteToken: channel.websiteToken,
      sessionTokenHash: hashToken(signed),
      expiresAt,
    },
  });
  await appendDomainEvent(db, {
    tenantId: channel.tenantId,
    type: "widget.session_started",
    aggregateType: "widget_session",
    aggregateId: id,
    payload: { session_id: id, inbox_id: inbox.id },
  });
  return {
    session_token: signed,
    expires_at: expiresAt.toISOString(),
    inbox_id: inbox.id,
  };
}

async function resolveSession(sessionToken: string): Promise<{
  session: WidgetSessionRow;
  channel: WidgetChannel;
  inbox: { id: string; tenantId: string; lockToSingleConversation: boolean; greeting: string | null };
}> {
  if (!sessionToken) throw new ApiError("unauthenticated", "Sessão do widget ausente.");
  const hash = hashToken(sessionToken);
  const session = await db.widgetSession.findFirst({
    where: { sessionTokenHash: hash },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new ApiError("unauthenticated", "Sessão do widget inválida.");
  }
  const { channel, inbox } = await loadWidgetByToken(session.websiteToken);
  const [raw, sig] = sessionToken.split(".");
  if (!raw || !sig) throw new ApiError("unauthenticated", "Sessão do widget inválida.");
  const secret = await hmacSecret(channel);
  const expected = signSessionPayload(secret, raw);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError("unauthenticated", "Sessão do widget inválida.");
  }
  await db.widgetSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return { session, channel, inbox };
}

export async function requireWidgetSession(req: Request) {
  const token = parseWidgetSessionToken(req);
  if (!token) throw new ApiError("unauthenticated", "Sessão do widget ausente.");
  return resolveSession(token);
}

export async function submitPreChat(
  req: Request,
  input: { fields: Record<string, string> },
) {
  const { session, channel, inbox } = await requireWidgetSession(req);
  const origin = req.headers.get("origin");
  assertOriginAllowed(channel, origin);

  let schema: PreChatField[] = [];
  try {
    schema = JSON.parse(channel.preChatFieldsJson || "[]") as PreChatField[];
  } catch {
    schema = [];
  }
  for (const field of schema) {
    if (field.required && !String(input.fields?.[field.name] ?? "").trim()) {
      throw new ApiError("validacao", `Campo obrigatório: ${field.label_pt || field.name}`);
    }
  }

  const nome = String(input.fields?.nome ?? "").trim() || "Visitante";
  const email = String(input.fields?.email ?? "").trim() || null;
  const phone = String(input.fields?.telefone ?? input.fields?.phone ?? "").trim() || null;

  let contact = session.contactId
    ? await db.contact.findFirst({
        where: { id: session.contactId, tenantId: session.tenantId, mergedIntoId: null },
      })
    : null;

  if (!contact && email) {
    contact = await db.contact.findFirst({
      where: { tenantId: session.tenantId, email, mergedIntoId: null },
    });
  }
  if (!contact) {
    contact = await db.contact.create({
      data: {
        id: newId("ct"),
        tenantId: session.tenantId,
        nome,
        email,
        phoneE164: phone,
      },
    });
  } else {
    contact = await db.contact.update({
      where: { id: contact.id },
      data: {
        nome: nome || contact.nome,
        email: email ?? contact.email,
        phoneE164: phone ?? contact.phoneE164,
      },
    });
  }

  const sourceId = email
    ? `email:${email.toLowerCase()}`
    : `widget:${session.id}`;
  const existingCi = await db.contactInbox.findFirst({
    where: { tenantId: session.tenantId, inboxId: inbox.id, sourceId },
  });
  if (!existingCi) {
    await db.contactInbox.create({
      data: {
        id: newId("ci"),
        tenantId: session.tenantId,
        contactId: contact.id,
        inboxId: inbox.id,
        sourceId,
      },
    });
  }

  await db.widgetSession.update({
    where: { id: session.id },
    data: {
      contactId: contact.id,
      preChatJson: JSON.stringify(input.fields ?? {}),
    },
  });

  return {
    contact_id: contact.id,
    source_id: sourceId,
    pre_chat: input.fields ?? {},
  };
}

async function ensureConversation(session: WidgetSessionRow, inbox: {
  id: string;
  tenantId: string;
  lockToSingleConversation: boolean;
}) {
  if (!session.contactId) {
    throw new ApiError("validacao", "Envie o pré-chat antes de mensagens.");
  }
  if (session.conversationId) {
    const existing = await db.conversation.findFirst({
      where: { id: session.conversationId, tenantId: session.tenantId },
    });
    if (existing && existing.status !== "resolved") return existing;
    if (existing && inbox.lockToSingleConversation && existing.status === "resolved") {
      const reopened = await db.conversation.update({
        where: { id: existing.id },
        data: { status: "open", lastActivityAt: new Date() },
      });
      return reopened;
    }
  }

  if (inbox.lockToSingleConversation) {
    const latest = await db.conversation.findFirst({
      where: {
        tenantId: session.tenantId,
        inboxId: inbox.id,
        contactId: session.contactId,
        status: { in: ["open", "pending", "snoozed"] },
      },
      orderBy: { lastActivityAt: "desc" },
    });
    if (latest) {
      await db.widgetSession.update({
        where: { id: session.id },
        data: { conversationId: latest.id },
      });
      return latest;
    }
  }

  const conversation = await db.conversation.create({
    data: {
      id: newId("cnv"),
      tenantId: session.tenantId,
      inboxId: inbox.id,
      contactId: session.contactId,
      status: "open",
      lastActivityAt: new Date(),
    },
  });
  await db.widgetSession.update({
    where: { id: session.id },
    data: { conversationId: conversation.id },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "conversation.created",
    aggregateType: "conversation",
    aggregateId: conversation.id,
    payload: {
      conversation_id: conversation.id,
      inbox_id: inbox.id,
      source: "widget",
    },
  });
  return conversation;
}

export async function getWidgetConversation(req: Request) {
  const { session, inbox } = await requireWidgetSession(req);
  if (!session.conversationId && !session.contactId) {
    return { conversation: null };
  }
  if (session.conversationId) {
    const row = await db.conversation.findFirst({
      where: { id: session.conversationId, tenantId: session.tenantId },
      include: { contact: true, labels: { include: { label: true } } },
    });
    return { conversation: row ? conversationDto(row) : null };
  }
  if (inbox.lockToSingleConversation && session.contactId) {
    const row = await db.conversation.findFirst({
      where: {
        tenantId: session.tenantId,
        inboxId: inbox.id,
        contactId: session.contactId,
      },
      orderBy: { lastActivityAt: "desc" },
      include: { contact: true, labels: { include: { label: true } } },
    });
    return { conversation: row ? conversationDto(row) : null };
  }
  return { conversation: null };
}

export async function listWidgetMessages(req: Request, url: URL) {
  const { session, inbox } = await requireWidgetSession(req);
  const conversation = await ensureConversation(session, inbox).catch(() => null);
  if (!conversation) return { items: [], next_cursor: null };
  const after = url.searchParams.get("after");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const rows = await db.message.findMany({
    where: {
      tenantId: session.tenantId,
      conversationId: conversation.id,
      private: false,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(messageDto),
    next_cursor: rows.length > limit ? page[page.length - 1]!.createdAt.toISOString() : null,
  };
}

export async function postWidgetMessage(
  req: Request,
  input: { content: string; content_type?: string },
) {
  const { session, channel, inbox } = await requireWidgetSession(req);
  assertOriginAllowed(channel, req.headers.get("origin"));
  if (!input.content?.trim()) throw new ApiError("validacao", "Conteúdo obrigatório.");

  // Ensure pre-chat done
  if (!session.contactId) {
    throw new ApiError("validacao", "Envie o pré-chat antes de mensagens.");
  }

  const contentType = input.content_type ?? "text";
  if (
    contentType !== "text" &&
    contentType !== "attachment" &&
    contentType !== "input_select" &&
    contentType !== "cards" &&
    contentType !== "form"
  ) {
    throw new ApiError("validacao", "content_type inválido.");
  }

  const conversation = await ensureConversation(session, inbox);
  const messageId = newId("msg");
  await db.message.create({
    data: {
      id: messageId,
      tenantId: session.tenantId,
      conversationId: conversation.id,
      messageType: "incoming",
      private: false,
      content: input.content.trim(),
      contentType: contentType as "text" | "attachment" | "input_select" | "cards" | "form",
      deliveryStatus: "delivered",
      simulated: false,
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastActivityAt: new Date() },
  });

  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "message.created",
    aggregateType: "message",
    aggregateId: messageId,
    payload: {
      conversation_id: conversation.id,
      inbox_id: inbox.id,
      message_id: messageId,
      message_type: "incoming",
      source: "widget",
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "widget.message_created",
    aggregateType: "message",
    aggregateId: messageId,
    payload: {
      conversation_id: conversation.id,
      session_id: session.id,
      message_id: messageId,
    },
  });

  const msg = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  return messageDto(msg);
}

export async function postWidgetTyping(req: Request) {
  const { session } = await requireWidgetSession(req);
  if (!session.conversationId) return { ok: true };
  const evt = await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "agent.typing",
    aggregateType: "conversation",
    aggregateId: session.conversationId,
    payload: {
      conversation_id: session.conversationId,
      source: "widget",
      session_id: session.id,
    },
  });
  fanoutCrmEvent({
    id: evt.id,
    tenantId: session.tenantId,
    type: "agent.typing",
    createdAt: evt.createdAt,
    payload: {
      conversation_id: session.conversationId,
      source: "widget",
    },
  });
  return { ok: true };
}

export async function listWidgetCampaigns(req: Request, websiteToken?: string | null) {
  let tenantId: string;
  let inboxId: string;
  const token = parseWidgetSessionToken(req);
  if (token) {
    const { session, inbox } = await resolveSession(token);
    tenantId = session.tenantId;
    inboxId = inbox.id;
  } else if (websiteToken) {
    const { channel, inbox } = await loadWidgetByToken(websiteToken);
    tenantId = channel.tenantId;
    inboxId = inbox.id;
  } else {
    throw new ApiError("unauthenticated", "Token ou sessão necessários.");
  }
  const items = await listActiveOngoingForInbox(tenantId, inboxId);
  return {
    items: items.filter((i) => i.display_status === "ready"),
  };
}

export function createWidgetSseStream(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      void (async () => {
        try {
          const { session } = await requireWidgetSession(req);
          const send = (event: { id: string; type: string; ts: string; payload: unknown }) => {
            if (closed) return;
            const payload = event.payload as Record<string, unknown> | null;
            const convId = payload && typeof payload === "object" ? payload.conversation_id : null;
            if (
              session.conversationId &&
              convId &&
              convId !== session.conversationId &&
              event.type !== "widget.session_started"
            ) {
              return;
            }
            controller.enqueue(
              encoder.encode(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
            );
          };
          unsubscribe = subscribeCrmSse({
            tenantId: session.tenantId,
            userId: `widget:${session.id}`,
            send,
          });
          controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`));
        } catch (err) {
          closed = true;
          controller.error(err);
        }
      })();
    },
    cancel() {
      closed = true;
      unsubscribe?.();
    },
  });

  return stream;
}
