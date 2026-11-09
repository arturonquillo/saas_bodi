import type { JobEnqueuePort, JobWorkerPort } from "@saas-frota/shared";
import { domainEventToAutomationEvent } from "@saas-frota/shared";
import { db } from "../db";
import { newId } from "../ids";

const WORKER_ID = `web_${process.pid}`;
const MAX_ATTEMPTS = 5;
const BODY_CAP = 256 * 1024;

export const jobEnqueuePort: JobEnqueuePort = {
  async enqueue(input) {
    const id = newId("job");
    await db.backgroundJob.create({
      data: {
        id,
        tenantId: input.tenantId,
        kind: input.kind,
        payloadJson: JSON.stringify(input.payload ?? {}),
        status: "pendente",
        runAfter: input.runAfter ?? new Date(),
      },
    });
    return { id };
  },
};

type JsonRecord = Record<string, unknown>;

async function deliverHttp(input: {
  url: string;
  headers: Record<string, string>;
  body: string;
}): Promise<{ status: number }> {
  const { urlEgressGuard } = await import("./egress");
  await urlEgressGuard.assertSafeHttpsUrl(input.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...input.headers,
      },
      body: input.body.slice(0, BODY_CAP),
      signal: controller.signal,
      redirect: "manual",
    });
    // Drain / cap body without storing PII
    await res.arrayBuffer().catch(() => undefined);
    if (res.status >= 300 && res.status < 400) {
      throw new Error(`redirect_bloqueado:${res.status}`);
    }
    if (res.status >= 400) {
      throw new Error(`http_${res.status}`);
    }
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

async function handleAutomationRun(payload: JsonRecord) {
  const {
    buildConversationEvalContext,
    evaluateConditions,
    runActions,
    systemSession,
    emitAutomationExecuted,
  } = await import("../crm/actions-runner");
  const ruleId = String(payload.rule_id ?? "");
  const tenantId = String(payload.tenant_id ?? "");
  const conversationId = payload.conversation_id ? String(payload.conversation_id) : null;
  const rule = await db.automationRule.findFirst({
    where: { id: ruleId, tenantId, active: true },
  });
  if (!rule) return;

  let conditions;
  let actions;
  try {
    conditions = JSON.parse(rule.conditionsJson);
    actions = JSON.parse(rule.actionsJson);
  } catch {
    return;
  }

  let ctx = (payload.eval_context as JsonRecord) ?? {};
  if (conversationId) {
    ctx = { ...ctx, ...(await buildConversationEvalContext(tenantId, conversationId)) };
  }
  if (payload.to === "resolved" || (ctx.status === "resolved" && payload.event_name === "conversation_resolved")) {
    ctx = { ...ctx, status: "resolved" };
  }
  if (!evaluateConditions(conditions, ctx)) return;
  if (!conversationId) return;

  const session = systemSession(tenantId, rule.createdByUserId);
  const result = await runActions({
    session,
    conversationId,
    actions,
    allowWebhook: true,
    source: "automation",
  });
  await emitAutomationExecuted(tenantId, ruleId, conversationId, result);
}

async function handleWebhookDeliver(payload: JsonRecord) {
  const { webhookSignatureHeader } = await import("../crm/webhook-signer");
  const { appendDomainEvent } = await import("../crm/events");
  const tenantId = String(payload.tenant_id ?? "");
  const webhookId = payload.webhook_id ? String(payload.webhook_id) : null;
  let url = payload.url ? String(payload.url) : null;
  const event = String(payload.event ?? "webhook.event");
  const bodyPayload = payload.payload ?? {};

  if (webhookId) {
    const wh = await db.webhook.findFirst({
      where: { id: webhookId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!wh || !wh.active) return;
    url = wh.url;
    if (!tenantId) {
      // recover tenant from row
      (payload as JsonRecord).tenant_id = wh.tenantId;
    }
  }
  const tid = String(payload.tenant_id ?? tenantId);
  if (!url) return;

  const tenant = await db.tenant.findUnique({ where: { id: tid } });
  const secret = tenant?.webhookSigningSecret;
  if (!secret) throw new Error("webhook_signing_secret ausente");

  const rawBody = JSON.stringify({ event, payload: bodyPayload });
  const signature = webhookSignatureHeader(secret, rawBody);
  try {
    await deliverHttp({
      url,
      headers: { "X-Cdf-Signature": signature },
      body: rawBody,
    });
    await appendDomainEvent(db, {
      tenantId: tid,
      type: "webhook.delivered",
      aggregateType: "webhook",
      aggregateId: webhookId ?? "ad_hoc",
      payload: { webhook_id: webhookId, event, hostname: new URL(url).hostname },
    });
  } catch (err) {
    await appendDomainEvent(db, {
      tenantId: tid,
      type: "webhook.failed",
      aggregateType: "webhook",
      aggregateId: webhookId ?? "ad_hoc",
      payload: {
        webhook_id: webhookId,
        event,
        error: err instanceof Error ? err.message.slice(0, 200) : "falha",
      },
    });
    throw err;
  }
}

async function handleBotDeliver(payload: JsonRecord) {
  const { appendDomainEvent } = await import("../crm/events");
  const tenantId = String(payload.tenant_id ?? "");
  const conversationId = String(payload.conversation_id ?? "");
  const messageId = payload.message_id ? String(payload.message_id) : null;
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conv?.botAgentBotId || conv.status !== "pending") return;
  const bot = await db.agentBot.findFirst({
    where: { id: conv.botAgentBotId, tenantId, active: true },
  });
  if (!bot) return;

  const eventName = String(payload.event ?? "message_created");
  const body = JSON.stringify({
    event: eventName,
    conversation_id: conversationId,
    message_id: messageId,
    payload: payload.payload ?? {},
  });
  await deliverHttp({
    url: bot.outgoingUrl,
    headers: { Authorization: `Bearer ${bot.token}` },
    body,
  });
  await appendDomainEvent(db, {
    tenantId,
    type: "bot.messaged",
    aggregateType: "conversation",
    aggregateId: conversationId,
    payload: { conversation_id: conversationId, bot_id: bot.id, message_id: messageId },
  });
}

async function handleCsatDeliver(payload: JsonRecord) {
  const { deliverCsat } = await import("../crm/csat");
  await deliverCsat({
    tenant_id: String(payload.tenant_id ?? ""),
    conversation_id: String(payload.conversation_id ?? ""),
  });
}

async function handleContactImport(payload: JsonRecord) {
  const { processContactImportBatch } = await import("../crm/merge-import");
  await processContactImportBatch(
    String(payload.batch_id ?? ""),
    String(payload.tenant_id ?? ""),
  );
}

async function handleRoundRobin(payload: JsonRecord) {
  const { pickRoundRobinAssignee } = await import("../crm/assignment");
  const { systemSession } = await import("../crm/actions-runner");
  const { patchConversa } = await import("../crm/conversations");
  const tenantId = String(payload.tenant_id ?? "");
  const conversationId = String(payload.conversation_id ?? "");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conv || conv.assigneeUserId) return;
  const next = await pickRoundRobinAssignee({ tenantId, inboxId: conv.inboxId });
  if (!next) return;
  const session = systemSession(tenantId, next);
  await patchConversa(session, conversationId, { assignee_user_id: next });
}

async function handleBalanced(payload: JsonRecord) {
  const { pickBalancedAssignee } = await import("../crm/assignment");
  const { systemSession } = await import("../crm/actions-runner");
  const { patchConversa } = await import("../crm/conversations");
  const tenantId = String(payload.tenant_id ?? "");
  const conversationId = String(payload.conversation_id ?? "");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conv || conv.assigneeUserId) return;
  const next = await pickBalancedAssignee({ tenantId, inboxId: conv.inboxId });
  if (!next) return;
  const session = systemSession(tenantId, next);
  await patchConversa(session, conversationId, { assignee_user_id: next });
}

async function handleSlaEvaluate(payload: JsonRecord) {
  const { evaluateSla } = await import("../crm/sla");
  await evaluateSla({
    tenant_id: String(payload.tenant_id ?? ""),
    conversation_id: payload.conversation_id
      ? String(payload.conversation_id)
      : undefined,
  });
}

async function handleDnsVerifyPortal(payload: JsonRecord) {
  const { dnsVerifyPort } = await import("./dns-verify");
  const portalId = String(payload.portal_id ?? "");
  const domain = String(payload.domain ?? "");
  const token = String(payload.token ?? "");
  const tenantId = String(payload.tenant_id ?? "");
  if (!portalId || !domain || !token) return;
  const result = await dnsVerifyPort.verifyTxt({ domain, expectedToken: token });
  if (result.verified) {
    await db.portal.updateMany({
      where: { id: portalId, tenantId },
      data: { customDomainVerified: true },
    });
  }
}

async function handleJob(kind: string, payload: unknown, tenantId: string): Promise<void> {
  const p = {
    ...((payload && typeof payload === "object" ? payload : {}) as JsonRecord),
    tenant_id:
      (payload as JsonRecord | null)?.tenant_id ??
      (payload as JsonRecord | null)?.tenantId ??
      tenantId,
  };
  switch (kind) {
    case "notification.email_stub":
      return;
    case "automation.run":
      await handleAutomationRun(p);
      return;
    case "webhook.deliver":
      await handleWebhookDeliver(p);
      return;
    case "bot.deliver":
      await handleBotDeliver(p);
      return;
    case "campaign.send_batch": {
      const { handleCampaignSendBatch } = await import("../crm/campaigns");
      const batch = p as JsonRecord;
      await handleCampaignSendBatch({
        tenant_id: String(batch.tenant_id ?? ""),
        campaign_id: String(batch.campaign_id ?? ""),
        cursor: batch.cursor != null ? String(batch.cursor) : undefined,
      });
      return;
    }
    case "report.rollup_daily":
      // Optional nightly materialization — live queries are enough for Phase C acceptance.
      return;
    case "csat.deliver":
      await handleCsatDeliver(p);
      return;
    case "contact.import_csv":
      await handleContactImport(p);
      return;
    case "assignment.round_robin":
      await handleRoundRobin(p);
      return;
    case "assignment.balanced":
      await handleBalanced(p);
      return;
    case "sla.evaluate":
      await handleSlaEvaluate(p);
      return;
    case "integration.deliver":
      // Stub no-op — no unpaid Slack/Linear/… HTTP.
      return;
    case "audit.prune": {
      const { pruneAudit } = await import("../crm/audit");
      const payload = p as { tenant_id?: string; days?: number };
      await pruneAudit(String(payload.tenant_id ?? tenantId), Number(payload.days ?? 90));
      return;
    }
    case "dns.verify_portal_domain":
      await handleDnsVerifyPortal(p);
      return;
    case "captain.suggest":
    case "captain.monitor_scan":
      // Optional — MVP suggest runs inline on POST.
      return;
    case "push.notify": {
      const { handlePushNotify } = await import("../crm/push");
      await handlePushNotify(p as { tenant_id?: string; user_id?: string; title?: string; body?: string });
      return;
    }
    case "email.channel_stub_deliver":
      // Stub — no SMTP; optional outbox row handled by caller.
      return;
    case "channel.simulate_social_ingest":
      // Optional job kind reserved; admin simulate runs inline in Phase D.
      return;
    default:
      return;
  }
}

/** Fan-in: enqueue automation.run + webhook.deliver for matching subscriptions. */
export async function fanInAfterDomainEvent(input: {
  id: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const autoEvent = domainEventToAutomationEvent(input.type);
  let eventNames: string[] = autoEvent ? [autoEvent] : [];
  if (input.type === "conversation.status_changed" && input.payload.to === "resolved") {
    eventNames = [...eventNames, "conversation_resolved"];
  }

  if (eventNames.length) {
    const rules = await db.automationRule.findMany({
      where: {
        tenantId: input.tenantId,
        active: true,
        eventName: { in: eventNames },
      },
      take: 20,
    });
    for (const rule of rules) {
      await jobEnqueuePort.enqueue({
        tenantId: input.tenantId,
        kind: "automation.run",
        payload: {
          tenant_id: input.tenantId,
          rule_id: rule.id,
          domain_event_id: input.id,
          event_name: rule.eventName,
          conversation_id: input.payload.conversation_id ?? input.payload.aggregate_id,
          to: input.payload.to,
          eval_context: input.payload,
        },
      });
    }
  }

  if (autoEvent || eventNames.includes("conversation_resolved")) {
    const subs = eventNames.length ? eventNames : [];
    if (subs.length) {
      const hooks = await db.webhook.findMany({
        where: { tenantId: input.tenantId, active: true },
      });
      for (const wh of hooks) {
        let subscriptions: string[] = [];
        try {
          subscriptions = JSON.parse(wh.subscriptionsJson) as string[];
        } catch {
          subscriptions = [];
        }
        const match = subs.some((s) => subscriptions.includes(s));
        if (!match) continue;
        if (wh.inboxId && input.payload.inbox_id && wh.inboxId !== input.payload.inbox_id) {
          continue;
        }
        await jobEnqueuePort.enqueue({
          tenantId: input.tenantId,
          kind: "webhook.deliver",
          payload: {
            tenant_id: input.tenantId,
            webhook_id: wh.id,
            domain_event_id: input.id,
            event: autoEvent ?? subs[0],
            payload: input.payload,
          },
        });
      }
    }
  }
}

export const jobWorkerPort: JobWorkerPort = {
  async tick(limit = 10) {
    const now = new Date();
    // Phase C: promote due scheduled campaigns before claiming jobs.
    try {
      const { promoteScheduledCampaigns } = await import("../crm/campaigns");
      await promoteScheduledCampaigns(20);
    } catch {
      // best-effort
    }
    const due = await db.backgroundJob.findMany({
      where: { status: "pendente", runAfter: { lte: now } },
      orderBy: { runAfter: "asc" },
      take: limit,
    });
    let processed = 0;
    for (const job of due) {
      const claimed = await db.backgroundJob.updateMany({
        where: { id: job.id, status: "pendente" },
        data: {
          status: "processando",
          lockedAt: now,
          lockedBy: WORKER_ID,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;
      try {
        const payload = JSON.parse(job.payloadJson) as unknown;
        await handleJob(job.kind, payload, job.tenantId);
        await db.backgroundJob.update({
          where: { id: job.id },
          data: { status: "concluido", lockedAt: null, lockedBy: null, lastError: null },
        });
        processed += 1;
      } catch (err) {
        const attempts = job.attempts + 1;
        const message = err instanceof Error ? err.message.slice(0, 500) : "falha";
        const dead = attempts >= MAX_ATTEMPTS;
        const backoffMs = Math.min(60_000, 2 ** attempts * 1000);
        await db.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: dead ? "morto" : "pendente",
            lastError: message,
            lockedAt: null,
            lockedBy: null,
            runAfter: dead ? now : new Date(Date.now() + backoffMs),
          },
        });
        processed += 1;
      }
    }
    return processed;
  },
};

let tickStarted = false;

/** Lazy in-process worker — start once per Node process. */
export function ensureJobWorkerStarted() {
  if (tickStarted || process.env.VITEST) return;
  tickStarted = true;
  const interval = setInterval(() => {
    void jobWorkerPort.tick(20).catch(() => undefined);
  }, 5_000);
  interval.unref?.();
}
