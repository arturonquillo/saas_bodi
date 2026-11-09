import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";
import { ensureJobWorkerStarted, jobEnqueuePort } from "../ports/jobs";

function subscriptionDto(row: {
  id: string;
  endpoint: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    endpoint: row.endpoint,
    created_at: row.createdAt.toISOString(),
  };
}

export async function getVapidPublic(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const key = env.vapidPublicKey?.trim();
  if (!key) throw new ApiError("nao_encontrado", "Push não configurado.");
  return { public_key: key };
}

export async function createPushSubscription(
  session: SessionContext,
  input: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  assertSaasRole(session, "admin", "vendedor");
  ensureJobWorkerStarted();
  if (!input.endpoint?.trim() || !input.keys?.p256dh || !input.keys?.auth) {
    throw new ApiError("validacao", "endpoint e keys são obrigatórios.");
  }
  const existing = await db.pushSubscription.findFirst({
    where: {
      tenantId: session.tenantId,
      userId: session.userId,
      endpoint: input.endpoint.trim(),
    },
  });
  let row;
  if (existing) {
    row = await db.pushSubscription.update({
      where: { id: existing.id },
      data: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  } else {
    row = await db.pushSubscription.create({
      data: {
        id: newId("push"),
        tenantId: session.tenantId,
        userId: session.userId,
        endpoint: input.endpoint.trim(),
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "push.subscribed",
    aggregateType: "push_subscription",
    aggregateId: row.id,
    actorUserId: session.userId,
    payload: { subscription_id: row.id, user_id: session.userId },
  });
  return subscriptionDto(row);
}

export async function deletePushSubscription(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.pushSubscription.findFirst({
    where: { id, tenantId: session.tenantId, userId: session.userId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.pushSubscription.delete({ where: { id } });
  return { id, deleted: true };
}

/** Stub: enqueue push.notify — worker no-ops without VAPID / never blocks desk. */
export async function enqueuePushNotify(input: {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
}) {
  if (!env.vapidPublicKey?.trim()) return;
  await jobEnqueuePort.enqueue({
    tenantId: input.tenantId,
    kind: "push.notify",
    payload: {
      tenant_id: input.tenantId,
      user_id: input.userId,
      title: input.title,
      body: input.body,
    },
  });
}

export async function handlePushNotify(payload: {
  tenant_id?: string;
  user_id?: string;
  title?: string;
  body?: string;
}) {
  // No Web Push HTTP in Phase D — fail closed silently if keys missing.
  if (!env.vapidPublicKey?.trim() || !env.vapidPrivateKey?.trim()) {
    if (payload.tenant_id) {
      await appendDomainEvent(db, {
        tenantId: payload.tenant_id,
        type: "push.failed",
        aggregateType: "push",
        aggregateId: payload.user_id ?? "unknown",
        payload: { reason: "vapid_missing", user_id: payload.user_id ?? null },
      });
    }
    return;
  }
  // Keys present but delivery still stubbed — no provider HTTP.
  return;
}
