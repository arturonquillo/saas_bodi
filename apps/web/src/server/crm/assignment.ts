import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { assertInboxMember } from "./visibility";

export function assignmentPolicyDto(row: {
  id: string;
  inboxId: string;
  kind: string;
  enabled: boolean;
  lastAssignedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    inbox_id: row.inboxId,
    kind: row.kind,
    enabled: row.enabled,
    last_assigned_user_id: row.lastAssignedUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getPoliticaAtribuicao(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertInboxMember(session, inboxId);
  const row = await db.assignmentPolicy.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (!row) {
    return {
      inbox_id: inboxId,
      kind: "round_robin",
      enabled: false,
      last_assigned_user_id: null,
    };
  }
  return assignmentPolicyDto(row);
}

export async function putPoliticaAtribuicao(
  session: SessionContext,
  inboxId: string,
  input: { kind?: "round_robin"; enabled: boolean },
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  const kind = input.kind ?? "round_robin";
  if (kind !== "round_robin") {
    throw new ApiError("validacao", "Somente round_robin na Fase B.");
  }
  const existing = await db.assignmentPolicy.findFirst({
    where: { tenantId: session.tenantId, inboxId },
  });
  if (existing) {
    await db.assignmentPolicy.update({
      where: { id: existing.id },
      data: { kind, enabled: input.enabled },
    });
  } else {
    await db.assignmentPolicy.create({
      data: {
        id: newId("asp"),
        tenantId: session.tenantId,
        inboxId,
        kind,
        enabled: input.enabled,
      },
    });
  }
  return getPoliticaAtribuicao(session, inboxId);
}

/** Pick next online inbox member after lastAssignedUserId cursor. */
export async function pickRoundRobinAssignee(input: {
  tenantId: string;
  inboxId: string;
}): Promise<string | null> {
  const policy = await db.assignmentPolicy.findFirst({
    where: { tenantId: input.tenantId, inboxId: input.inboxId },
  });
  if (!policy?.enabled) return null;

  const inbox = await db.inbox.findFirst({
    where: { id: input.inboxId, tenantId: input.tenantId },
  });
  if (!inbox?.allowAutoAssign) return null;

  const members = await db.inboxMember.findMany({
    where: { tenantId: input.tenantId, inboxId: input.inboxId },
    include: { user: { select: { id: true, availability: true, ativo: true } } },
    orderBy: { userId: "asc" },
  });
  const online = members
    .filter((m) => m.user.ativo && m.user.availability === "online")
    .map((m) => m.userId);
  if (!online.length) return null;

  let idx = 0;
  if (policy.lastAssignedUserId) {
    const lastIdx = online.indexOf(policy.lastAssignedUserId);
    idx = lastIdx >= 0 ? (lastIdx + 1) % online.length : 0;
  }
  const next = online[idx]!;
  await db.assignmentPolicy.update({
    where: { id: policy.id },
    data: { lastAssignedUserId: next },
  });
  return next;
}
