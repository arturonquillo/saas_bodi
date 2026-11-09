import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";
import { runActions, type ActionNode } from "./actions-runner";
import { assertConversationVisible } from "./visibility";

function parseActions(raw: string): ActionNode[] {
  try {
    return JSON.parse(raw) as ActionNode[];
  } catch {
    return [];
  }
}

export function macroDto(row: {
  id: string;
  name: string;
  actionsJson: string;
  visibility: string;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    actions: parseActions(row.actionsJson),
    visibility: row.visibility,
    owner_user_id: row.ownerUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function assertVisibleMacro(
  session: SessionContext,
  row: { visibility: string; ownerUserId: string | null },
) {
  if (row.visibility === "public") return;
  if (row.ownerUserId === session.userId || session.saasRole === "admin") return;
  throw new ApiError("nao_encontrado", "Não encontrado.");
}

function assertCanMutate(
  session: SessionContext,
  row: { visibility: string; ownerUserId: string | null },
) {
  if (row.visibility === "public") {
    assertSaasRole(session, "admin");
    return;
  }
  if (session.saasRole === "admin") return;
  if (row.ownerUserId !== session.userId) {
    throw new ApiError("nao_encontrado", "Não encontrado.");
  }
}

export async function listMacros(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const rows = await db.macro.findMany({
    where: {
      tenantId: session.tenantId,
      OR: [{ visibility: "public" }, { ownerUserId: session.userId }],
    },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(macroDto) };
}

export async function createMacro(
  session: SessionContext,
  input: {
    name: string;
    actions?: ActionNode[];
    visibility?: "public" | "private";
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const visibility = input.visibility ?? "private";
  if (visibility === "public") assertSaasRole(session, "admin");
  const actions = input.actions ?? [];
  if (actions.some((a) => a.action_name === "send_webhook")) {
    throw new ApiError("validacao", "Macros não podem usar send_webhook.");
  }
  const id = newId("mcr");
  await db.macro.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      actionsJson: JSON.stringify(actions),
      visibility,
      ownerUserId: visibility === "private" ? session.userId : null,
    },
  });
  return getMacro(session, id);
}

export async function getMacro(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.macro.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  assertVisibleMacro(session, row);
  return macroDto(row);
}

export async function patchMacro(
  session: SessionContext,
  id: string,
  input: { name?: string; actions?: ActionNode[]; visibility?: "public" | "private" },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.macro.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  assertCanMutate(session, row);
  if (input.visibility === "public") assertSaasRole(session, "admin");
  if (input.actions?.some((a) => a.action_name === "send_webhook")) {
    throw new ApiError("validacao", "Macros não podem usar send_webhook.");
  }
  const nextVisibility = input.visibility ?? row.visibility;
  await db.macro.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      actionsJson: input.actions === undefined ? undefined : JSON.stringify(input.actions),
      visibility: input.visibility,
      ownerUserId: nextVisibility === "private" ? (row.ownerUserId ?? session.userId) : null,
    },
  });
  return getMacro(session, id);
}

export async function deleteMacro(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.macro.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  assertCanMutate(session, row);
  await db.macro.delete({ where: { id } });
  return { id, deleted: true };
}

export async function executarMacro(
  session: SessionContext,
  id: string,
  conversationIds: string[],
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.macro.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  assertVisibleMacro(session, row);
  if (!conversationIds?.length) throw new ApiError("validacao", "Informe conversation_ids.");
  const actions = parseActions(row.actionsJson);
  const results = [];
  for (const conversationId of conversationIds) {
    const conv = await db.conversation.findFirst({
      where: { id: conversationId, tenantId: session.tenantId },
      include: { inbox: { select: { vendedorSeeAll: true } } },
    });
    if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
    await assertConversationVisible(session, conv);
    const result = await runActions({
      session,
      conversationId,
      actions,
      allowWebhook: false,
      source: "macro",
    });
    results.push({ conversation_id: conversationId, ...result });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "macro.executed",
    aggregateType: "macro",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { macro_id: id, conversation_ids: conversationIds, results },
  });
  return { macro_id: id, results };
}
