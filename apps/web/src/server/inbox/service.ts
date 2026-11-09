import type { WhatsappIntent } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { whatsappInboxSimulatePort } from "../ports/whatsapp-inbox";

function threadDto(row: {
  id: string;
  phoneE164: string;
  intent: string | null;
  clienteId: string | null;
  cadastroRequestId: string | null;
  orcamentoId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    direction: string;
    body: string;
    simulated: boolean;
    createdAt: Date;
  }>;
}) {
  return {
    id: row.id,
    phone_e164: row.phoneE164,
    intent: row.intent,
    cliente_id: row.clienteId,
    cadastro_request_id: row.cadastroRequestId,
    orcamento_id: row.orcamentoId,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    messages: (row.messages ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      simulated: m.simulated,
      created_at: m.createdAt.toISOString(),
    })),
  };
}

export async function listInbox(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.whatsappThread.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(threadDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getInboxThread(session: SessionContext, threadId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.whatsappThread.findFirst({
    where: { id: threadId, tenantId: session.tenantId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return threadDto(row);
}

export async function patchInboxThread(
  session: SessionContext,
  threadId: string,
  input: {
    intent?: WhatsappIntent | null;
    status?: "aberta" | "arquivada";
    cliente_id?: string | null;
    cadastro_request_id?: string | null;
    orcamento_id?: string | null;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.whatsappThread.findFirst({
    where: { id: threadId, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");

  if (input.cliente_id) {
    const c = await db.cliente.findFirst({
      where: { id: input.cliente_id, tenantId: session.tenantId },
    });
    if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (input.cadastro_request_id) {
    const c = await db.cadastroRequest.findFirst({
      where: { id: input.cadastro_request_id, tenantId: session.tenantId },
    });
    if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (input.orcamento_id) {
    const o = await db.orcamento.findFirst({
      where: { id: input.orcamento_id, tenantId: session.tenantId },
    });
    if (!o) throw new ApiError("nao_encontrado", "Não encontrado.");
  }

  await db.whatsappThread.update({
    where: { id: threadId },
    data: {
      intent: input.intent === undefined ? undefined : input.intent,
      status: input.status,
      clienteId: input.cliente_id === undefined ? undefined : input.cliente_id,
      cadastroRequestId:
        input.cadastro_request_id === undefined ? undefined : input.cadastro_request_id,
      orcamentoId: input.orcamento_id === undefined ? undefined : input.orcamento_id,
    },
  });
  return getInboxThread(session, threadId);
}

export async function simulateInbound(
  session: SessionContext,
  input: {
    phone_e164: string;
    body: string;
    intent_hint?: WhatsappIntent;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.phone_e164.trim() || !input.body.trim()) {
    throw new ApiError("validacao", "Telefone e mensagem são obrigatórios.");
  }
  const result = await whatsappInboxSimulatePort.ingestInbound({
    tenantId: session.tenantId,
    phoneE164: input.phone_e164.trim(),
    body: input.body.trim(),
    intentHint: input.intent_hint,
  });
  return getInboxThread(session, result.threadId);
}

export async function lojaWhatsappCta(input: {
  tenantSlug?: string;
  phone_e164?: string;
  body?: string;
  intent_hint?: WhatsappIntent;
}) {
  const { env } = await import("../env");
  const tenant = await db.tenant.findUnique({
    where: { slug: input.tenantSlug || env.defaultTenantSlug },
  });
  if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");
  const phone = input.phone_e164?.trim() || "+5500000000000";
  const body = input.body?.trim() || "Olá, vim pela loja Casa dos Frios.";
  const result = await whatsappInboxSimulatePort.ingestInbound({
    tenantId: tenant.id,
    phoneE164: phone,
    body,
    intentHint: input.intent_hint ?? "info_empresa",
  });
  return {
    thread_id: result.threadId,
    message_id: result.messageId,
    whatsapp_comercial: tenant.whatsappComercial,
  };
}
