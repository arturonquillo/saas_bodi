import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";
import { recordAudit } from "./audit";
import { assertConversationVisible } from "./visibility";
import { jobEnqueuePort } from "../ports/jobs";

export function slaPolicyDto(row: {
  id: string;
  name: string;
  frtSeconds: number;
  nrtSeconds: number;
  rtSeconds: number;
  active: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    frt_seconds: row.frtSeconds,
    nrt_seconds: row.nrtSeconds,
    rt_seconds: row.rtSeconds,
    active: row.active,
    description: row.description,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function conversationSlaDto(row: {
  id: string;
  conversationId: string;
  slaPolicyId: string;
  frtDueAt: Date;
  nrtDueAt: Date | null;
  rtDueAt: Date;
  frtHitAt: Date | null;
  nrtHitAt: Date | null;
  rtHitAt: Date | null;
  frtBreached: boolean;
  nrtBreached: boolean;
  rtBreached: boolean;
  appliedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    sla_policy_id: row.slaPolicyId,
    frt_due_at: row.frtDueAt.toISOString(),
    nrt_due_at: row.nrtDueAt?.toISOString() ?? null,
    rt_due_at: row.rtDueAt.toISOString(),
    frt_hit_at: row.frtHitAt?.toISOString() ?? null,
    nrt_hit_at: row.nrtHitAt?.toISOString() ?? null,
    rt_hit_at: row.rtHitAt?.toISOString() ?? null,
    frt_breached: row.frtBreached,
    nrt_breached: row.nrtBreached,
    rt_breached: row.rtBreached,
    applied_at: row.appliedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listSlaPolicies(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.slaPolicy.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(slaPolicyDto) };
}

export async function createSlaPolicy(
  session: SessionContext,
  input: {
    name: string;
    frt_seconds: number;
    nrt_seconds: number;
    rt_seconds: number;
    active?: boolean;
    description?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  for (const [k, v] of [
    ["frt_seconds", input.frt_seconds],
    ["nrt_seconds", input.nrt_seconds],
    ["rt_seconds", input.rt_seconds],
  ] as const) {
    if (!Number.isInteger(v) || v < 1) {
      throw new ApiError("validacao", `${k} deve ser inteiro ≥ 1.`);
    }
  }
  const id = newId("sla");
  await db.slaPolicy.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      frtSeconds: input.frt_seconds,
      nrtSeconds: input.nrt_seconds,
      rtSeconds: input.rt_seconds,
      active: input.active !== false,
      description: input.description ?? null,
    },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "sla.policy_created",
    aggregateType: "sla_policy",
    aggregateId: id,
    payload: { name: input.name.trim() },
  });
  return getSlaPolicy(session, id);
}

export async function getSlaPolicy(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.slaPolicy.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return slaPolicyDto(row);
}

export async function patchSlaPolicy(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    frt_seconds?: number;
    nrt_seconds?: number;
    rt_seconds?: number;
    active?: boolean;
    description?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.slaPolicy.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.slaPolicy.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      frtSeconds: input.frt_seconds,
      nrtSeconds: input.nrt_seconds,
      rtSeconds: input.rt_seconds,
      active: input.active,
      description: input.description === undefined ? undefined : input.description,
    },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "sla.policy_updated",
    aggregateType: "sla_policy",
    aggregateId: id,
    payload: {},
  });
  return getSlaPolicy(session, id);
}

export async function deleteSlaPolicy(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.slaPolicy.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.slaPolicy.delete({ where: { id } });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "sla.policy_deleted",
    aggregateType: "sla_policy",
    aggregateId: id,
    payload: { name: row.name },
  });
  return { ok: true };
}

export async function putInboxDefaultSla(
  session: SessionContext,
  inboxId: string,
  input: { sla_policy_id: string | null },
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({
    where: { id: inboxId, tenantId: session.tenantId },
  });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.sla_policy_id) {
    const policy = await db.slaPolicy.findFirst({
      where: { id: input.sla_policy_id, tenantId: session.tenantId, active: true },
    });
    if (!policy) throw new ApiError("nao_encontrado", "Política SLA não encontrada.");
  }
  await db.inbox.update({
    where: { id: inboxId },
    data: { defaultSlaPolicyId: input.sla_policy_id },
  });
  return {
    inbox_id: inboxId,
    sla_policy_id: input.sla_policy_id,
  };
}

export async function applyConversationSla(
  session: SessionContext,
  conversationId: string,
  slaPolicyId: string,
) {
  assertSaasRole(session, "admin");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  const policy = await db.slaPolicy.findFirst({
    where: { id: slaPolicyId, tenantId: session.tenantId, active: true },
  });
  if (!policy) throw new ApiError("nao_encontrado", "Política SLA não encontrada.");

  const now = new Date();
  const frtDueAt = new Date(now.getTime() + policy.frtSeconds * 1000);
  const nrtDueAt = new Date(now.getTime() + policy.nrtSeconds * 1000);
  const rtDueAt = new Date(now.getTime() + policy.rtSeconds * 1000);

  const existing = await db.conversationSla.findUnique({
    where: { conversationId },
  });
  if (existing) {
    await db.conversationSla.update({
      where: { id: existing.id },
      data: {
        slaPolicyId: policy.id,
        frtDueAt,
        nrtDueAt,
        rtDueAt,
        frtHitAt: null,
        nrtHitAt: null,
        rtHitAt: null,
        frtBreached: false,
        nrtBreached: false,
        rtBreached: false,
        appliedAt: now,
      },
    });
  } else {
    await db.conversationSla.create({
      data: {
        id: newId("csl"),
        tenantId: session.tenantId,
        conversationId,
        slaPolicyId: policy.id,
        frtDueAt,
        nrtDueAt,
        rtDueAt,
        appliedAt: now,
      },
    });
  }
  await db.conversation.update({
    where: { id: conversationId },
    data: { slaPolicyId: policy.id },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "sla.applied",
    aggregateType: "conversation",
    aggregateId: conversationId,
    actorUserId: session.userId,
    payload: { conversation_id: conversationId, sla_policy_id: policy.id },
  });
  await jobEnqueuePort.enqueue({
    tenantId: session.tenantId,
    kind: "sla.evaluate",
    payload: { tenant_id: session.tenantId, conversation_id: conversationId },
  });
  return getConversationSla(session, conversationId);
}

export async function removeConversationSla(session: SessionContext, conversationId: string) {
  assertSaasRole(session, "admin");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.conversationSla.deleteMany({
    where: { tenantId: session.tenantId, conversationId },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { slaPolicyId: null },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "sla.removed",
    aggregateType: "conversation",
    aggregateId: conversationId,
    actorUserId: session.userId,
    payload: { conversation_id: conversationId },
  });
  return { ok: true };
}

export async function getConversationSla(session: SessionContext, conversationId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, conv);
  const row = await db.conversationSla.findFirst({
    where: { tenantId: session.tenantId, conversationId },
  });
  if (!row) {
    return {
      conversation_id: conversationId,
      sla_policy_id: conv.slaPolicyId,
      timer: null,
    };
  }
  return {
    conversation_id: conversationId,
    sla_policy_id: row.slaPolicyId,
    timer: conversationSlaDto(row),
  };
}

/** Job / event consumer: update hit/breach flags for one or all active timers. */
export async function evaluateSla(payload: {
  tenant_id: string;
  conversation_id?: string;
}) {
  const tenantId = payload.tenant_id;
  const rows = await db.conversationSla.findMany({
    where: {
      tenantId,
      ...(payload.conversation_id ? { conversationId: payload.conversation_id } : {}),
    },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              messageType: true,
              private: true,
              createdAt: true,
              senderUserId: true,
            },
          },
        },
      },
    },
  });
  const now = new Date();
  for (const row of rows) {
    const msgs = row.conversation.messages;
    const firstOutgoing = msgs.find(
      (m) => m.messageType === "outgoing" && !m.private && m.senderUserId,
    );
    let frtHitAt = row.frtHitAt;
    let nrtHitAt = row.nrtHitAt;
    let rtHitAt = row.rtHitAt;
    let frtBreached = row.frtBreached;
    let nrtBreached = row.nrtBreached;
    let rtBreached = row.rtBreached;

    if (!frtHitAt && firstOutgoing) {
      frtHitAt = firstOutgoing.createdAt;
      if (firstOutgoing.createdAt <= row.frtDueAt) {
        await appendDomainEvent(db, {
          tenantId,
          type: "sla.hit",
          aggregateType: "conversation",
          aggregateId: row.conversationId,
          payload: { metric: "frt", conversation_id: row.conversationId },
        });
      }
    }
    if (!frtHitAt && now > row.frtDueAt && !frtBreached) {
      frtBreached = true;
      await appendDomainEvent(db, {
        tenantId,
        type: "sla.breached",
        aggregateType: "conversation",
        aggregateId: row.conversationId,
        payload: { metric: "frt", conversation_id: row.conversationId },
      });
    }

    // NRT: after last contact incoming while open, next agent outgoing
    if (row.conversation.status !== "resolved") {
      const lastIncoming = [...msgs].reverse().find((m) => m.messageType === "incoming");
      if (lastIncoming && row.nrtDueAt) {
        const nextOutgoing = msgs.find(
          (m) =>
            m.messageType === "outgoing" &&
            !m.private &&
            m.senderUserId &&
            m.createdAt > lastIncoming.createdAt,
        );
        if (!nrtHitAt && nextOutgoing) {
          nrtHitAt = nextOutgoing.createdAt;
          if (nextOutgoing.createdAt <= row.nrtDueAt) {
            await appendDomainEvent(db, {
              tenantId,
              type: "sla.hit",
              aggregateType: "conversation",
              aggregateId: row.conversationId,
              payload: { metric: "nrt", conversation_id: row.conversationId },
            });
          }
        }
        if (!nrtHitAt && now > row.nrtDueAt && !nrtBreached) {
          nrtBreached = true;
          await appendDomainEvent(db, {
            tenantId,
            type: "sla.breached",
            aggregateType: "conversation",
            aggregateId: row.conversationId,
            payload: { metric: "nrt", conversation_id: row.conversationId },
          });
        }
      }
    }

    if (row.conversation.status === "resolved") {
      if (!rtHitAt) {
        rtHitAt = row.conversation.updatedAt;
        if (rtHitAt <= row.rtDueAt) {
          await appendDomainEvent(db, {
            tenantId,
            type: "sla.hit",
            aggregateType: "conversation",
            aggregateId: row.conversationId,
            payload: { metric: "rt", conversation_id: row.conversationId },
          });
        }
      }
    } else if (now > row.rtDueAt && !rtBreached) {
      rtBreached = true;
      await appendDomainEvent(db, {
        tenantId,
        type: "sla.breached",
        aggregateType: "conversation",
        aggregateId: row.conversationId,
        payload: { metric: "rt", conversation_id: row.conversationId },
      });
    }

    // Threshold warning (~80% of FRT window elapsed, not yet hit/breached)
    if (!frtHitAt && !frtBreached) {
      const windowMs = row.frtDueAt.getTime() - row.appliedAt.getTime();
      const elapsed = now.getTime() - row.appliedAt.getTime();
      if (windowMs > 0 && elapsed / windowMs >= 0.8) {
        await appendDomainEvent(db, {
          tenantId,
          type: "sla.threshold_warning",
          aggregateType: "conversation",
          aggregateId: row.conversationId,
          payload: { metric: "frt", conversation_id: row.conversationId },
        });
      }
    }

    await db.conversationSla.update({
      where: { id: row.id },
      data: { frtHitAt, nrtHitAt, rtHitAt, frtBreached, nrtBreached, rtBreached },
    });
  }
}
