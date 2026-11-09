import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";

export function capacityDto(row: {
  id: string;
  userId: string;
  maxOpenConversations: number;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    user_id: row.userId,
    max_open_conversations: row.maxOpenConversations,
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listCapacidade(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.agentCapacity.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { userId: "asc" },
  });
  return { items: rows.map(capacityDto) };
}

export async function putCapacidade(
  session: SessionContext,
  input: { items: Array<{ user_id: string; max_open_conversations: number }> },
) {
  assertSaasRole(session, "admin");
  if (!Array.isArray(input.items)) {
    throw new ApiError("validacao", "items obrigatório.");
  }
  const results = [];
  for (const item of input.items) {
    if (!item.user_id) throw new ApiError("validacao", "user_id obrigatório.");
    if (!Number.isInteger(item.max_open_conversations) || item.max_open_conversations < 1) {
      throw new ApiError("validacao", "max_open_conversations deve ser inteiro ≥ 1.");
    }
    const mem = await db.membership.findFirst({
      where: {
        tenantId: session.tenantId,
        userId: item.user_id,
        saasRole: { not: null },
      },
    });
    if (!mem) throw new ApiError("validacao", "Usuário inválido.");
    const existing = await db.agentCapacity.findFirst({
      where: { tenantId: session.tenantId, userId: item.user_id },
    });
    if (existing) {
      await db.agentCapacity.update({
        where: { id: existing.id },
        data: { maxOpenConversations: item.max_open_conversations },
      });
      results.push(await db.agentCapacity.findUniqueOrThrow({ where: { id: existing.id } }));
    } else {
      const id = newId("cap");
      results.push(
        await db.agentCapacity.create({
          data: {
            id,
            tenantId: session.tenantId,
            userId: item.user_id,
            maxOpenConversations: item.max_open_conversations,
          },
        }),
      );
    }
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "capacity.updated",
    aggregateType: "tenant",
    aggregateId: session.tenantId,
    actorUserId: session.userId,
    payload: { count: results.length },
  });
  return { items: results.map(capacityDto) };
}
