import { randomBytes } from "node:crypto";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { stubOutboxTransport } from "../ports/outbox";
import { appendDomainEvent } from "./events";

export function csatDto(row: {
  id: string;
  conversationId: string;
  inboxId: string;
  contactId: string | null;
  rating: number;
  feedbackMessage: string | null;
  assignedAgentId: string | null;
  submittedAt: Date;
}) {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    inbox_id: row.inboxId,
    contact_id: row.contactId,
    rating: row.rating,
    feedback_message: row.feedbackMessage,
    assigned_agent_id: row.assignedAgentId,
    submitted_at: row.submittedAt.toISOString(),
  };
}

export async function listCsat(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const inboxId = url.searchParams.get("inbox_id");
  const ratingRaw = url.searchParams.get("rating");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const rows = await db.csatResponse.findMany({
    where: {
      tenantId: session.tenantId,
      ...(inboxId ? { inboxId } : {}),
      ...(rating != null && !Number.isNaN(rating) ? { rating } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(csatDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getCsat(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.csatResponse.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return csatDto(row);
}

export async function getPublicCsat(token: string) {
  if (!token?.trim()) throw new ApiError("nao_encontrado", "Não encontrado.");
  const conv = await db.conversation.findFirst({
    where: { csatToken: token },
    include: {
      tenant: { include: { theme: true } },
      inbox: true,
      contact: true,
    },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  const existing = await db.csatResponse.findUnique({
    where: { conversationId: conv.id },
  });
  return {
    token,
    conversation_id: conv.id,
    tenant: {
      nome_fantasia: conv.tenant.nomeFantasia,
      marca: conv.tenant.theme?.marca ?? conv.tenant.nomeFantasia,
    },
    already_submitted: Boolean(existing),
    contact_nome: conv.contact.nome,
  };
}

export async function submitPublicCsat(
  token: string,
  input: { rating: number; feedback_message?: string | null },
) {
  if (!token?.trim()) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ApiError("validacao", "rating deve ser 1–5.");
  }
  const conv = await db.conversation.findFirst({
    where: { csatToken: token },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  const existing = await db.csatResponse.findUnique({
    where: { conversationId: conv.id },
  });
  if (existing) throw new ApiError("validacao", "CSAT já enviado.");
  const id = newId("cst");
  await db.csatResponse.create({
    data: {
      id,
      tenantId: conv.tenantId,
      conversationId: conv.id,
      inboxId: conv.inboxId,
      contactId: conv.contactId,
      rating: input.rating,
      feedbackMessage: input.feedback_message?.trim() || null,
      assignedAgentId: conv.assigneeUserId,
    },
  });
  await appendDomainEvent(db, {
    tenantId: conv.tenantId,
    type: "csat.submitted",
    aggregateType: "csat_response",
    aggregateId: id,
    payload: {
      conversation_id: conv.id,
      rating: input.rating,
      csat_response_id: id,
    },
  });
  const row = await db.csatResponse.findUniqueOrThrow({ where: { id } });
  return csatDto(row);
}

/** Job consumer: create token + outbox category=csat. */
export async function deliverCsat(payload: {
  tenant_id: string;
  conversation_id: string;
}) {
  const conv = await db.conversation.findFirst({
    where: { id: payload.conversation_id, tenantId: payload.tenant_id },
    include: { contact: true, inbox: true },
  });
  if (!conv) return;
  if (!conv.inbox.csatEnabled) return;
  if (conv.csatSentAt && conv.csatToken) return;

  const token = conv.csatToken ?? randomBytes(24).toString("hex");
  await db.conversation.update({
    where: { id: conv.id },
    data: {
      csatToken: token,
      csatSentAt: new Date(),
    },
  });

  const recipient = conv.contact.phoneE164 || conv.contact.email || "unknown";
  const outboxId = newId("out");
  await db.notificationOutbox.create({
    data: {
      id: outboxId,
      tenantId: conv.tenantId,
      channel: conv.contact.phoneE164 ? "whatsapp" : "email",
      recipientRole: "customer",
      recipient,
      templateKey: "crm.csat_survey",
      category: "csat",
      conversationId: conv.id,
      payloadJson: JSON.stringify({
        conversation_id: conv.id,
        csat_token: token,
        survey_path: `/api/public/csat/${token}`,
      }),
      status: "pendente",
    },
  });
  await stubOutboxTransport.send({
    id: outboxId,
    channel: conv.contact.phoneE164 ? "whatsapp" : "email",
    recipient,
    templateKey: "crm.csat_survey",
    payload: { csat_token: token },
  });
  await appendDomainEvent(db, {
    tenantId: conv.tenantId,
    type: "csat.requested",
    aggregateType: "conversation",
    aggregateId: conv.id,
    payload: { conversation_id: conv.id, csat_token: token },
  });
}
