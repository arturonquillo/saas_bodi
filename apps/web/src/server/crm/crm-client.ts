import { INTERACTIVE_CONTENT_TYPES } from "@saas-frota/shared";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";
import { messageDto } from "./dto";
import { hashToken } from "./tokens";
import { ensureJobWorkerStarted } from "../ports/jobs";

type ApiChannelContext = {
  tenantId: string;
  inboxId: string;
  channelId: string;
};

export async function resolveApiBearer(req: Request): Promise<ApiChannelContext> {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new ApiError("unauthenticated", "Bearer token obrigatório.");
  const token = match[1].trim();
  const channel = await db.channelApi.findFirst({
    where: { apiAccessTokenHash: hashToken(token) },
  });
  if (!channel || !channel.apiAccessTokenHash) {
    throw new ApiError("unauthenticated", "Token inválido.");
  }
  return {
    tenantId: channel.tenantId,
    inboxId: channel.inboxId,
    channelId: channel.id,
  };
}

async function upsertContactInbox(
  ctx: ApiChannelContext,
  input: {
    source_id: string;
    contact?: { nome?: string; email?: string; phone_e164?: string };
  },
) {
  const sourceId = input.source_id.trim();
  if (!sourceId) throw new ApiError("validacao", "source_id obrigatório.");

  let ci = await db.contactInbox.findFirst({
    where: {
      tenantId: ctx.tenantId,
      inboxId: ctx.inboxId,
      sourceId,
    },
    include: { contact: true },
  });

  if (!ci) {
    const contact = await db.contact.create({
      data: {
        id: newId("ct"),
        tenantId: ctx.tenantId,
        nome: input.contact?.nome?.trim() || sourceId,
        email: input.contact?.email?.trim() || null,
        phoneE164: input.contact?.phone_e164?.trim() || null,
      },
    });
    ci = await db.contactInbox.create({
      data: {
        id: newId("ci"),
        tenantId: ctx.tenantId,
        contactId: contact.id,
        inboxId: ctx.inboxId,
        sourceId,
      },
      include: { contact: true },
    });
  } else if (input.contact) {
    await db.contact.update({
      where: { id: ci.contactId },
      data: {
        nome: input.contact.nome?.trim() || undefined,
        email: input.contact.email === undefined ? undefined : input.contact.email,
        phoneE164:
          input.contact.phone_e164 === undefined ? undefined : input.contact.phone_e164,
      },
    });
  }

  return ci;
}

async function ensureOpenConversation(ctx: ApiChannelContext, contactId: string) {
  const inbox = await db.inbox.findFirstOrThrow({
    where: { id: ctx.inboxId, tenantId: ctx.tenantId },
  });
  let conversation = await db.conversation.findFirst({
    where: {
      tenantId: ctx.tenantId,
      inboxId: ctx.inboxId,
      contactId,
      status: { in: ["open", "pending", "snoozed"] },
    },
    orderBy: { lastActivityAt: "desc" },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        id: newId("cnv"),
        tenantId: ctx.tenantId,
        inboxId: ctx.inboxId,
        contactId,
        status: "open",
        lastActivityAt: new Date(),
      },
    });
    await appendDomainEvent(db, {
      tenantId: ctx.tenantId,
      type: "conversation.created",
      aggregateType: "conversation",
      aggregateId: conversation.id,
      payload: {
        conversation_id: conversation.id,
        inbox_id: ctx.inboxId,
        source: "api_channel",
      },
    });
  } else if (inbox.lockToSingleConversation === false) {
    // keep existing open
  }
  return conversation;
}

function assertContentType(contentType: string | undefined) {
  const ct = contentType ?? "text";
  const allowed = ["text", "attachment", ...INTERACTIVE_CONTENT_TYPES];
  if (!allowed.includes(ct as (typeof allowed)[number])) {
    throw new ApiError("validacao", `content_type inválido: ${ct}`);
  }
  return ct as "text" | "attachment" | "input_select" | "cards" | "form";
}

export async function postCrmClientMessage(
  req: Request,
  input: {
    source_id: string;
    content: string;
    content_type?: string;
    contact?: { nome?: string; email?: string; phone_e164?: string };
  },
) {
  ensureJobWorkerStarted();
  const ctx = await resolveApiBearer(req);
  if (!input.content?.trim()) throw new ApiError("validacao", "Conteúdo obrigatório.");
  const contentType = assertContentType(input.content_type);
  const ci = await upsertContactInbox(ctx, input);
  const conversation = await ensureOpenConversation(ctx, ci.contactId);
  const messageId = newId("msg");
  await db.message.create({
    data: {
      id: messageId,
      tenantId: ctx.tenantId,
      conversationId: conversation.id,
      messageType: "incoming",
      private: false,
      content: input.content.trim(),
      contentType,
      deliveryStatus: "delivered",
      simulated: false,
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastActivityAt: new Date() },
  });
  await appendDomainEvent(db, {
    tenantId: ctx.tenantId,
    type: "message.created",
    aggregateType: "message",
    aggregateId: messageId,
    payload: {
      conversation_id: conversation.id,
      inbox_id: ctx.inboxId,
      message_id: messageId,
      message_type: "incoming",
      source: "api_channel",
      source_id: input.source_id,
    },
  });
  const msg = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  return {
    conversation_id: conversation.id,
    source_id: input.source_id,
    message: messageDto(msg),
  };
}

export async function listCrmClientMessages(req: Request, sourceId: string, url: URL) {
  const ctx = await resolveApiBearer(req);
  const ci = await db.contactInbox.findFirst({
    where: {
      tenantId: ctx.tenantId,
      inboxId: ctx.inboxId,
      sourceId: decodeURIComponent(sourceId),
    },
  });
  if (!ci) throw new ApiError("nao_encontrado", "Conversa não encontrada.");
  const conversation = await db.conversation.findFirst({
    where: {
      tenantId: ctx.tenantId,
      inboxId: ctx.inboxId,
      contactId: ci.contactId,
    },
    orderBy: { lastActivityAt: "desc" },
  });
  if (!conversation) return { items: [] };
  const after = url.searchParams.get("after");
  const rows = await db.message.findMany({
    where: {
      tenantId: ctx.tenantId,
      conversationId: conversation.id,
      private: false,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return {
    conversation_id: conversation.id,
    items: rows.map(messageDto),
  };
}

export async function postCrmClientConversationMessage(
  req: Request,
  sourceId: string,
  input: {
    content: string;
    content_type?: string;
    contact?: { nome?: string; email?: string; phone_e164?: string };
  },
) {
  return postCrmClientMessage(req, {
    source_id: decodeURIComponent(sourceId),
    content: input.content,
    content_type: input.content_type,
    contact: input.contact,
  });
}
