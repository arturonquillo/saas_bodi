# Jobs and realtime

Locked for Chatwoot-parity CRM. Product: `docs/product/chatwoot-parity.md`. Overview: [crm-chatwoot-parity.md](./crm-chatwoot-parity.md).

## Realtime — Phase A: SSE

### Why SSE

Single Next.js process, cookie auth, mostly server→agent fan-out (new messages, assignment, presence). SSE avoids WebSocket upgrade/sticky-session complexity on the MVP host. Bidirectional needs are tiny (typing/viewing) and map cleanly to short POSTs.

### Endpoints

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/events/stream` | admin, vendedor | `text/event-stream`; tenant from session |
| POST | `/api/saas/crm/presence` | admin, vendedor | `{ conversation_id?, state: "viewing"\|"typing"\|"online"\|"busy"\|"offline" }` |
| GET | `/api/saas/crm/conversas` | admin, vendedor | supports `?updated_since=` ISO for poll fallback |

### Stream contract

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- First event: `event: ready` with `{ tenant_id, user_id, ts }`.
- Heartbeat comment every 15s (`: ping`) so proxies keep the socket.
- Data events:

```ts
type CrmSseEvent = {
  id: string           // domain_events.id or ephemeral presence id
  type: string         // e.g. conversation.updated, message.created, agent.viewing
  ts: string           // ISO
  payload: unknown     // no full CNPJ / no WA secrets
}
```

- Filter: only events for `session.tenantId`. Vendedor streams may further filter to visible conversations (same authz as list).
- Client sends `Last-Event-ID` when reconnecting; server replays from `domain_events` (capped, e.g. last 100 or 5 minutes).

### Presence / collision

- `POST /presence` with `conversation_id` + `viewing` upserts `agent_presences` (`user_id`, `conversation_id`, `expires_at` ≈ now+25s).
- Server emits `agent.viewing` to other agents on that conversation.
- UI shows “X está visualizando” when another presence row is unexpired.
- Typing: same table or ephemeral event only (no durable row required); TTL ≤ 5s.

### Fallback

If SSE errors, client polls `GET /api/saas/crm/conversas?updated_since=` and `GET .../conversas/:id/mensagens?after=` every 15s. Acceptance may use either path.

### Explicitly not Phase A

- WebSocket server.
- Browser push (Phase D).
- Cross-tenant multiplexed streams.

## Domain events

Append-only, tenant-scoped. Written in the **same transaction** as the mutating domain write when the write is conversational/CRM.

| Column | Notes |
|---|---|
| `id` | cuid (SSE `id`) |
| `tenant_id` | required |
| `type` | dotted name |
| `aggregate_type` / `aggregate_id` | e.g. `conversation`, id |
| `payload_json` | redacted |
| `actor_user_id` | nullable |
| `created_at` | |

Indexes: `(tenant_id, created_at)`, `(tenant_id, aggregate_type, aggregate_id)`.

Retention: keep ≥ 7 days locally; prune job optional later. Not a substitute for audit_events (Phase E).

## Background jobs

### Tables

**`background_jobs`**

| Column | Notes |
|---|---|
| `id` | cuid |
| `tenant_id` | required (system jobs use a reserved tenant or null only for cross-tenant prune — MVP: always tenant) |
| `kind` | `automation.run` \| `webhook.deliver` \| `bot.deliver` \| `campaign.send_batch` \| `csat.deliver` \| `notification.email_stub` \| … |
| `payload_json` | ids + params; no secrets |
| `status` | `pendente` \| `processando` \| `concluido` \| `falha` \| `morto` |
| `attempts` | int |
| `run_after` | datetime |
| `locked_at` / `locked_by` | worker lease |
| `last_error` | string? truncated; never include response bodies with PII dumps |
| `created_at` / `updated_at` | |

Index: `(status, run_after)`, `(tenant_id, kind, status)`.

### Worker

Phase A/B MVP: **in-process tick** started from server instrumentation (or lazy on first CRM request):

1. Every N seconds, claim due rows (`status=pendente`, `run_after <= now`) with lease.
2. Dispatch by `kind` to port handlers.
3. Success → `concluido`; failure → backoff `run_after`, increment attempts; after max (e.g. 5) → `morto`.

Interface:

```ts
interface JobEnqueuePort {
  enqueue(input: {
    tenantId: string
    kind: string
    payload: unknown
    runAfter?: Date
  }): Promise<{ id: string }>
}

interface JobWorkerPort {
  tick(limit?: number): Promise<number> // jobs processed
}
```

Phase A may only enqueue optional `notification.email_stub` for agent notification prefs; automations/webhooks/bots must not execute until Phase B UI exists — but the table + worker **must** exist so B does not redesign.

### Phase B job consumers

| Kind | Handler contract |
|---|---|
| `automation.run` | Load rule; evaluate `conditions_json` against event payload + reloaded conversation/contact; run ordered actions via domain services; `send_webhook` → enqueue `webhook.deliver`; emit `automation.executed` |
| `webhook.deliver` | `UrlEgressGuardPort.assertSafeHttpsUrl`; POST JSON `{ event, payload }` with `X-Cdf-Signature: sha256=<hmac>`; timeouts 3s connect / 10s total; body cap 256 KiB; success → `webhook.delivered`, else retry then `webhook.failed` |
| `bot.deliver` | Same egress rules; POST Chatwoot-shaped event (`message_created` / `conversation_status_changed`) + `Authorization: Bearer <bot.token>`; if conversation no longer bot-pending, no-op |
| `csat.deliver` | Create opaque `csat_token` on conversation; insert `notification_outbox` `category=csat` (WA stub template + survey URL); mark `csat_sent_at`; emit `csat.requested` |
| `contact.import_csv` | Parse rows; upsert Contact by phone/email; stats on batch; emit `contact.imported` |
| `assignment.round_robin` | Pick next online inbox member after `last_assigned_user_id`; assign; update cursor |

**Fan-in rule:** after CRM mutation commits and `domain_events` row exists, a small dispatcher (same tick or post-commit hook) enqueues `automation.run` for each **active** matching rule and `webhook.deliver` for matching subscriptions. Never call egress in the HTTP handler.

**Idempotency:** job payload includes `domain_event_id` + `rule_id` / `webhook_id`; unique processing key or status check prevents double-apply on retry when actions are non-idempotent (prefer upsert-style actions).

### SSRF / egress (webhook & bot kinds)

Before any outbound HTTP from a job **and** before persisting a new bot/webhook URL:

1. Parse URL; scheme `https` only (http forbidden except loopback **test** harness with `EGRESS_ALLOW_HTTP_LOOPBACK=true` in test env only).
2. Resolve DNS; reject if any address is loopback, link-local, RFC1918, `0.0.0.0`, multicast, or cloud metadata (`169.254.169.254`).
3. Connect with pinned timeout; **do not** follow redirects to a re-resolved private target (re-run guard on each redirect hop, max 3).
4. Cap response read size (e.g. 256 KiB).
5. Log host + status only — not full URL query secrets, not body.

```ts
interface UrlEgressGuardPort {
  assertSafeHttpsUrl(url: string): Promise<{ href: string; hostname: string }>
}
```

Webhook HMAC:

```ts
interface WebhookSignerPort {
  sign(secret: string, rawBody: string): string  // hex sha256 HMAC
}
```

## Outbox interaction

Commerce `notification_outbox` stays synchronous mark-enviado via `StubOutboxTransport` after commit (existing MVP). Campaign/CSAT/agent-email stubs **may** enqueue a job that writes outbox rows then calls the same transport — still no Meta/SMTP.

Phase B CSAT: `csat.deliver` → outbox `category=csat`, template key `crm.csat_survey`; recipient = contact WhatsApp/email per channel stub; **no** Meta template sync.

## Performance notes

- SSE: one connection per open desk tab; expect tens of agents max per seed tenant — fan-out in memory per process is enough.
- Multi-instance deploy later needs a pub/sub (Postgres LISTEN/Redis); document as Phase E/ops — **not** required for Casa seed demo.
- `domain_events` inserts must not fail the parent transaction on SSE fan-out errors; fan-out is best-effort after commit (read events by id).
