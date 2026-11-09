import type { WhatsappIntent } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import {
  getConversa,
  listConversas,
  listMensagens,
  patchConversa,
  simularInbound,
} from "../crm/conversations";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { whatsappInboxSimulatePort } from "../ports/channel";

const INTENT_FROM_LABEL: Record<string, WhatsappIntent> = {
  "intent:cadastro": "cadastro",
  "intent:orcamento": "orcamento",
  "intent:info_empresa": "info_empresa",
  "intent:outro": "outro",
};

const INTENT_TO_LABEL: Record<WhatsappIntent, string> = {
  cadastro: "intent:cadastro",
  orcamento: "intent:orcamento",
  info_empresa: "intent:info_empresa",
  outro: "intent:outro",
};

function legacyStatus(status: string): "aberta" | "arquivada" {
  return status === "resolved" ? "arquivada" : "aberta";
}

function legacyDirection(messageType: string, isPrivate: boolean): string {
  if (messageType === "incoming") return "inbound";
  if (isPrivate) return "outbound_note";
  return "outbound_note";
}

/** Deprecated: maps Conversation → legacy inbox thread DTO for one-release dual-read. */
function threadDtoFromConversation(
  conv: Awaited<ReturnType<typeof listConversas>>["items"][number],
  messages?: Array<{
  id: string;
  message_type: string;
  private: boolean;
  content: string;
  simulated: boolean;
  created_at: string;
}>) {
  const intentLabel = conv.labels?.find((l) => l.title.startsWith("intent:"))?.title;
  return {
    id: conv.id,
    phone_e164: conv.contact?.phone_e164 ?? "",
    intent: intentLabel ? (INTENT_FROM_LABEL[intentLabel] ?? null) : null,
    cliente_id: conv.cliente_id,
    cadastro_request_id: conv.cadastro_request_id,
    orcamento_id: conv.orcamento_id,
    status: legacyStatus(conv.status),
    created_at: conv.created_at,
    updated_at: conv.updated_at,
    deprecated: true,
    crm_conversation_id: conv.id,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      direction: legacyDirection(m.message_type, m.private),
      body: m.content,
      simulated: m.simulated,
      created_at: m.created_at,
    })),
  };
}

export async function listInbox(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const page = await listConversas(session, url);
  return {
    items: page.items.map((c) => threadDtoFromConversation(c)),
    next_cursor: page.next_cursor,
    deprecated: true,
    migrate_to: "/api/saas/crm/conversas",
  };
}

export async function getInboxThread(session: SessionContext, threadId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const conv = await getConversa(session, threadId);
  const msgs = await listMensagens(
    session,
    threadId,
    new URL("http://localhost/?limit=100"),
  );
  return threadDtoFromConversation(conv, msgs.items);
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
  await patchConversa(session, threadId, {
    status: input.status === "arquivada" ? "resolved" : input.status === "aberta" ? "open" : undefined,
    cliente_id: input.cliente_id,
    cadastro_request_id: input.cadastro_request_id,
    orcamento_id: input.orcamento_id,
  });
  if (input.intent) {
    const labelTitle = INTENT_TO_LABEL[input.intent];
    const label = await db.label.findUnique({
      where: { tenantId_title: { tenantId: session.tenantId, title: labelTitle } },
    });
    if (label) {
      const { setConversationLabels } = await import("../crm/conversations");
      await setConversationLabels(session, threadId, [label.id], "add");
    }
  }
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
  const conv = await simularInbound(session, {
    phone_e164: input.phone_e164,
    body: input.body,
    intent_label: input.intent_hint ? (INTENT_TO_LABEL[input.intent_hint] as never) : undefined,
  });
  return getInboxThread(session, conv.id);
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
    conversation_id: result.threadId,
    message_id: result.messageId,
    whatsapp_comercial: tenant.whatsappComercial,
  };
}
