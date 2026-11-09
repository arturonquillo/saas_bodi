import type { JobEnqueuePort, JobWorkerPort } from "@saas-frota/shared";
import { db } from "../db";
import { newId } from "../ids";

const WORKER_ID = `web_${process.pid}`;
const MAX_ATTEMPTS = 5;

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

async function handleJob(kind: string, _payload: unknown): Promise<void> {
  // Phase A: idle consumers for automation/webhook/bot; optional email stub no-op.
  switch (kind) {
    case "notification.email_stub":
      return;
    case "automation.run":
    case "webhook.deliver":
    case "bot.deliver":
    case "campaign.send_batch":
    case "csat.deliver":
      // Phase B+ execution — acknowledge without side effects in A.
      return;
    default:
      return;
  }
}

export const jobWorkerPort: JobWorkerPort = {
  async tick(limit = 10) {
    const now = new Date();
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
        await handleJob(job.kind, payload);
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
