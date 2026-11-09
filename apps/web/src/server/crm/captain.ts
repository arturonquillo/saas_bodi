import { CAPTAIN_MODES, type CaptainMode } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { captainAiPort } from "../ports/captain-ai";
import { appendDomainEvent } from "./events";
import { assertConversationVisible } from "./visibility";
import { postMensagem, patchConversa, setConversationLabels } from "./conversations";

export function assistantDto(row: {
  id: string;
  name: string;
  mode: string;
  systemPromptStub: string | null;
  active: boolean;
  configJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let config: unknown = null;
  try {
    config = row.configJson ? JSON.parse(row.configJson) : null;
  } catch {
    config = null;
  }
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    system_prompt_stub: row.systemPromptStub,
    active: row.active,
    config,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function suggestionDto(row: {
  id: string;
  conversationId: string;
  assistantId: string | null;
  mode: string;
  status: string;
  proposalJson: string;
  createdBy: string;
  actorUserId: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}) {
  let proposal: unknown = {};
  try {
    proposal = JSON.parse(row.proposalJson || "{}");
  } catch {
    proposal = {};
  }
  return {
    id: row.id,
    conversation_id: row.conversationId,
    assistant_id: row.assistantId,
    mode: row.mode,
    status: row.status,
    proposal,
    created_by: row.createdBy,
    actor_user_id: row.actorUserId,
    resolved_by_user_id: row.resolvedByUserId,
    resolved_at: row.resolvedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

function assertMode(mode: string): CaptainMode {
  if (!(CAPTAIN_MODES as readonly string[]).includes(mode)) {
    throw new ApiError("validacao", `mode inválido: ${mode}`);
  }
  return mode as CaptainMode;
}

export async function captainStatus(session: SessionContext) {
  assertSaasRole(session, "admin");
  const unlocked =
    process.env.CAPTAIN_PROVIDER_ENABLED === "true" &&
    Boolean(process.env.CAPTAIN_PROVIDER_API_KEY?.trim());
  return {
    provider: unlocked ? ("live_unlocked" as const) : ("stub" as const),
    enabled: true,
  };
}

export async function listAssistentes(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.captainAssistant.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(assistantDto) };
}

export async function createAssistente(
  session: SessionContext,
  input: {
    name: string;
    mode: string;
    system_prompt_stub?: string | null;
    active?: boolean;
    config?: Record<string, unknown> | null;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const mode = assertMode(input.mode);
  const id = newId("cpa");
  await db.captainAssistant.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      mode,
      systemPromptStub: input.system_prompt_stub ?? null,
      active: input.active !== false,
      configJson: input.config ? JSON.stringify(input.config) : null,
    },
  });
  return getAssistente(session, id);
}

export async function getAssistente(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.captainAssistant.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return assistantDto(row);
}

export async function patchAssistente(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    mode?: string;
    system_prompt_stub?: string | null;
    active?: boolean;
    config?: Record<string, unknown> | null;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.captainAssistant.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.captainAssistant.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      mode: input.mode ? assertMode(input.mode) : undefined,
      systemPromptStub:
        input.system_prompt_stub === undefined ? undefined : input.system_prompt_stub,
      active: input.active,
      configJson:
        input.config === undefined
          ? undefined
          : input.config
            ? JSON.stringify(input.config)
            : null,
    },
  });
  return getAssistente(session, id);
}

export async function deleteAssistente(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.captainAssistant.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.captainAssistant.delete({ where: { id } });
  return { ok: true };
}

export async function sugerirCaptain(
  session: SessionContext,
  input: { conversation_id: string; mode: string; assistant_id?: string },
) {
  assertSaasRole(session, "admin", "vendedor");
  const mode = assertMode(input.mode);
  const conv = await db.conversation.findFirst({
    where: { id: input.conversation_id, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, conv);

  let promptStub: string | undefined;
  if (input.assistant_id) {
    const asst = await db.captainAssistant.findFirst({
      where: { id: input.assistant_id, tenantId: session.tenantId },
    });
    if (!asst) throw new ApiError("nao_encontrado", "Assistente não encontrado.");
    promptStub = asst.systemPromptStub ?? undefined;
  }

  const result = await captainAiPort.suggest({
    tenantId: session.tenantId,
    conversationId: conv.id,
    mode,
    assistantId: input.assistant_id,
    promptStub,
  });

  const id = newId("cps");
  await db.captainSuggestion.create({
    data: {
      id,
      tenantId: session.tenantId,
      conversationId: conv.id,
      assistantId: input.assistant_id ?? null,
      mode,
      status: "pending",
      proposalJson: JSON.stringify(result.proposal),
      createdBy: "agent",
      actorUserId: session.userId,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "captain.suggestion_created",
    aggregateType: "captain_suggestion",
    aggregateId: id,
    actorUserId: session.userId,
    payload: {
      conversation_id: conv.id,
      suggestion_id: id,
      mode,
      provider: result.provider,
    },
  });
  const row = await db.captainSuggestion.findUniqueOrThrow({ where: { id } });
  return { ...suggestionDto(row), provider: result.provider };
}

export async function listSugestoes(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const conversationId = url.searchParams.get("conversation_id");
  const status = url.searchParams.get("status");
  const rows = await db.captainSuggestion.findMany({
    where: {
      tenantId: session.tenantId,
      ...(conversationId ? { conversationId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { items: rows.map(suggestionDto) };
}

export async function aceitarSugestao(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.captainSuggestion.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "pending") {
    throw new ApiError("validacao", "Sugestão já resolvida.");
  }
  const conv = await db.conversation.findFirst({
    where: { id: row.conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, conv);

  let proposal: Record<string, unknown> = {};
  try {
    proposal = JSON.parse(row.proposalJson || "{}") as Record<string, unknown>;
  } catch {
    proposal = {};
  }

  // Apply via existing desk APIs — never silent Meta send.
  if (typeof proposal.reply === "string" && proposal.reply.trim()) {
    await postMensagem(session, conv.id, {
      content: proposal.reply.trim(),
      private: false,
    });
  }
  if (Array.isArray(proposal.labels) && proposal.labels.length) {
    const labelTitles = proposal.labels.filter((x): x is string => typeof x === "string");
    if (labelTitles.length) {
      const labels = await db.label.findMany({
        where: { tenantId: session.tenantId, title: { in: labelTitles } },
      });
      if (labels.length) {
        await setConversationLabels(
          session,
          conv.id,
          labels.map((l) => l.id),
          "add",
        );
      }
    }
  }
  if (typeof proposal.priority === "string") {
    const p = proposal.priority as "low" | "medium" | "high" | "urgent";
    if (["low", "medium", "high", "urgent"].includes(p)) {
      await patchConversa(session, conv.id, { priority: p });
    }
  }

  await db.captainSuggestion.update({
    where: { id },
    data: {
      status: "accepted",
      resolvedByUserId: session.userId,
      resolvedAt: new Date(),
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "captain.suggestion_accepted",
    aggregateType: "captain_suggestion",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { suggestion_id: id, conversation_id: conv.id },
  });
  const updated = await db.captainSuggestion.findUniqueOrThrow({ where: { id } });
  return suggestionDto(updated);
}

export async function descartarSugestao(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.captainSuggestion.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "pending") {
    throw new ApiError("validacao", "Sugestão já resolvida.");
  }
  const conv = await db.conversation.findFirst({
    where: { id: row.conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, conv);

  await db.captainSuggestion.update({
    where: { id },
    data: {
      status: "dismissed",
      resolvedByUserId: session.userId,
      resolvedAt: new Date(),
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "captain.suggestion_dismissed",
    aggregateType: "captain_suggestion",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { suggestion_id: id, conversation_id: conv.id },
  });
  const updated = await db.captainSuggestion.findUniqueOrThrow({ where: { id } });
  return suggestionDto(updated);
}
