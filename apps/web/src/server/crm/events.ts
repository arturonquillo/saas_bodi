import type { Prisma } from "@prisma/client";
import { newId } from "../ids";

type Tx = Prisma.TransactionClient | typeof import("../db").db;

export type DomainEventInput = {
  tenantId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
};

type SseListener = {
  tenantId: string;
  userId: string;
  send: (event: { id: string; type: string; ts: string; payload: unknown }) => void;
};

const listeners = new Set<SseListener>();

export function subscribeCrmSse(listener: SseListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function fanoutCrmEvent(event: {
  id: string;
  tenantId: string;
  type: string;
  createdAt: Date;
  payload: unknown;
}) {
  const payload = {
    id: event.id,
    type: event.type,
    ts: event.createdAt.toISOString(),
    payload: event.payload,
  };
  for (const l of listeners) {
    if (l.tenantId !== event.tenantId) continue;
    try {
      l.send(payload);
    } catch {
      // best-effort
    }
  }
}

export async function appendDomainEvent(tx: Tx, input: DomainEventInput) {
  const id = newId("evt");
  const createdAt = new Date();
  const payloadJson = JSON.stringify(input.payload);
  await tx.domainEvent.create({
    data: {
      id,
      tenantId: input.tenantId,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payloadJson,
      actorUserId: input.actorUserId ?? null,
      createdAt,
    },
  });
  // Fan-out + Phase B job fan-in after write (never egress on request path).
  queueMicrotask(() => {
    fanoutCrmEvent({
      id,
      tenantId: input.tenantId,
      type: input.type,
      createdAt,
      payload: input.payload,
    });
    void import("../ports/jobs")
      .then(({ fanInAfterDomainEvent }) =>
        fanInAfterDomainEvent({
          id,
          tenantId: input.tenantId,
          type: input.type,
          payload: input.payload,
        }),
      )
      .catch(() => undefined);
  });
  return { id, createdAt };
}

export async function replayDomainEvents(input: {
  tenantId: string;
  afterId?: string | null;
  since?: Date;
  limit?: number;
}) {
  const limit = Math.min(input.limit ?? 100, 100);
  const since = input.since ?? new Date(Date.now() - 5 * 60_000);
  const rows = await (await import("../db")).db.domainEvent.findMany({
    where: {
      tenantId: input.tenantId,
      createdAt: { gte: since },
      ...(input.afterId ? { id: { gt: input.afterId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    ts: r.createdAt.toISOString(),
    payload: JSON.parse(r.payloadJson) as unknown,
  }));
}
