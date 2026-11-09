import { requireSaasRole } from "@/server/authz/gates";
import { replayDomainEvents, subscribeCrmSse } from "@/server/crm/events";
import { ensureJobWorkerStarted } from "@/server/ports/jobs";
import { handleError } from "@/server/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    ensureJobWorkerStarted();
    const session = await requireSaasRole("admin", "vendedor");
    const lastEventId = req.headers.get("Last-Event-ID");
    const encoder = new TextEncoder();
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const sendRaw = (chunk: string) => {
          if (closed) return;
          controller.enqueue(encoder.encode(chunk));
        };
        const sendEvent = (event: string, data: unknown, id?: string) => {
          let out = "";
          if (id) out += `id: ${id}\n`;
          out += `event: ${event}\n`;
          out += `data: ${JSON.stringify(data)}\n\n`;
          sendRaw(out);
        };

        sendEvent("ready", {
          tenant_id: session.tenantId,
          user_id: session.userId,
          ts: new Date().toISOString(),
        });

        const replay = await replayDomainEvents({
          tenantId: session.tenantId,
          afterId: lastEventId,
        });
        for (const ev of replay) {
          sendEvent(ev.type, { id: ev.id, type: ev.type, ts: ev.ts, payload: ev.payload }, ev.id);
        }

        unsubscribe = subscribeCrmSse({
          tenantId: session.tenantId,
          userId: session.userId,
          send: (ev) => sendEvent(ev.type, ev, ev.id),
        });

        heartbeat = setInterval(() => sendRaw(": ping\n\n"), 15_000);
        heartbeat.unref?.();

        req.signal.addEventListener("abort", () => {
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

