import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { urlEgressGuard } from "../ports/egress";
import { jobEnqueuePort } from "../ports/jobs";
import { newWebhookSigningSecret } from "./webhook-signer";

function parseSubs(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function webhookDto(row: {
  id: string;
  url: string;
  name: string | null;
  subscriptionsJson: string;
  inboxId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    subscriptions: parseSubs(row.subscriptionsJson),
    inbox_id: row.inboxId,
    active: row.active,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listWebhooks(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.webhook.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });
  return { items: rows.map(webhookDto) };
}

export async function createWebhook(
  session: SessionContext,
  input: {
    url: string;
    name?: string | null;
    subscriptions?: string[];
    inbox_id?: string | null;
    active?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const safe = await urlEgressGuard.assertSafeHttpsUrl(input.url);
  if (input.inbox_id) {
    const inbox = await db.inbox.findFirst({
      where: { id: input.inbox_id, tenantId: session.tenantId },
    });
    if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  if (!tenant.webhookSigningSecret) {
    await db.tenant.update({
      where: { id: session.tenantId },
      data: { webhookSigningSecret: newWebhookSigningSecret() },
    });
  }
  const id = newId("whk");
  await db.webhook.create({
    data: {
      id,
      tenantId: session.tenantId,
      url: safe.href,
      name: input.name ?? null,
      subscriptionsJson: JSON.stringify(input.subscriptions ?? []),
      inboxId: input.inbox_id ?? null,
      active: input.active !== false,
    },
  });
  return getWebhook(session, id);
}

export async function getWebhook(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.webhook.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return webhookDto(row);
}

export async function patchWebhook(
  session: SessionContext,
  id: string,
  input: {
    url?: string;
    name?: string | null;
    subscriptions?: string[];
    inbox_id?: string | null;
    active?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.webhook.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  let url = row.url;
  if (input.url) {
    const safe = await urlEgressGuard.assertSafeHttpsUrl(input.url);
    url = safe.href;
  }
  if (input.inbox_id) {
    const inbox = await db.inbox.findFirst({
      where: { id: input.inbox_id, tenantId: session.tenantId },
    });
    if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  await db.webhook.update({
    where: { id },
    data: {
      url,
      name: input.name === undefined ? undefined : input.name,
      subscriptionsJson:
        input.subscriptions === undefined ? undefined : JSON.stringify(input.subscriptions),
      inboxId: input.inbox_id === undefined ? undefined : input.inbox_id,
      active: input.active,
    },
  });
  return getWebhook(session, id);
}

export async function deleteWebhook(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.webhook.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.webhook.delete({ where: { id } });
  return { id, deleted: true };
}

export async function testarWebhook(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.webhook.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await urlEgressGuard.assertSafeHttpsUrl(row.url);
  const { id: jobId } = await jobEnqueuePort.enqueue({
    tenantId: session.tenantId,
    kind: "webhook.deliver",
    payload: {
      webhook_id: id,
      event: "webhook.test",
      payload: { test: true, webhook_id: id },
    },
  });
  return { job_id: jobId, enqueued: true };
}

export async function rotacionarSegredoWebhook(session: SessionContext) {
  assertSaasRole(session, "admin");
  const secret = newWebhookSigningSecret();
  await db.tenant.update({
    where: { id: session.tenantId },
    data: { webhookSigningSecret: secret },
  });
  return { webhook_signing_secret: secret };
}
