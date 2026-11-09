# Ports

Adapters the backend fills. Product forbids silently replacing stubs with unpaid provider integrations.

Interfaces live in `packages/shared` (types) and `apps/web/src/server/ports/` (impl). Domain code depends on the interface only.

## CNPJ registry

Checksum (módulo 11) **always** runs in-process (`packages/shared` `isValidCnpj`). The registry is extra. CPF helpers may remain in shared for later varejo; MVP cadastro path is CNPJ-only.

```ts
type CnpjRegistryResult =
  | { ok: true; razaoSocial: string }
  | { ok: false; reason: "not_found" | "unavailable" };

interface CnpjRegistryPort {
  lookup(cnpjDigits: string): Promise<CnpjRegistryResult>;
}
```

Recommended live adapter: [BrasilAPI CNPJ](https://brasilapi.com.br/api/cnpj/v1/{cnpj}) with a short timeout (3s).

| Outcome | Cadastro |
|---|---|
| checksum fail | 422 `checksum_invalido` — stop |
| registry ok | save; `cnpj_registro_pendente = false`; store `razao_social` |
| not_found or timeout/5xx | checksum passed → allow; **warn** in UX; `cnpj_registro_pendente = true` |

`CNPJ_REGISTRY_ENABLED=false` (default local): adapter returns `unavailable` so the degrade path is demonstrable. Tests inject a mock port; they still must run checksum.

Rate-limit `POST /api/identidade/cnpj` and public cadastro per IP.

Never log the CNPJ digits passed into the port (hash or last4 only).

## Notification outbox

```ts
type OutboxChannel = "email" | "whatsapp";

interface OutboxTransportPort {
  send(row: {
    id: string
    channel: OutboxChannel
    recipient: string
    templateKey: string
    payload: unknown
  }): Promise<void>;
}
```

MVP `StubOutboxTransport`: mark the row `enviado` without calling Meta or SMTP.

On every **successful** notifying event (same transaction as history / cadastro decision):

1. Resolve tenant `canais_aviso`.
2. Insert outbox rows for **customer** and **vendedor** (seller).
3. If `ambos`, two channels each. If `email` or `whatsapp`, one channel each.
4. After commit, adapter may flip `pendente` → `enviado`.

Silent exception: create → Orçamento `rascunho` and create → Venda `rascunho` do **not** notify (product). Notify on `faturado`, cadastro approve/refuse, and all other Orçamento/Pedido status changes.

Payload includes document id + new status — **no full tax ID**.

## WhatsApp / channel ports (Chatwoot-parity)

Phase A evolves the simulator onto Conversation. Prefer these names; keep a deprecated alias to `WhatsappInboxSimulatePort` only during migration.

```ts
interface ChannelSimulateInboundPort {
  ingestInbound(input: {
    tenantId: string
    inboxId?: string          // default WA inbox if omitted
    phoneE164: string
    body: string
    intentLabel?: "intent:cadastro" | "intent:orcamento" | "intent:info_empresa" | "intent:outro"
  }): Promise<{ conversationId: string; messageId: string; contactId: string }>
}

interface ChannelSendPort {
  sendOutgoing(input: {
    tenantId: string
    inboxId: string
    conversationId: string
    messageId: string
    toE164: string
    body: string
  }): Promise<{ deliveryStatus: "queued" | "sent" | "failed" }>
}

interface ChannelCredentialsVaultPort {
  seal(secrets: Record<string, string>): Promise<string>      // ciphertext blob
  open(ciphertext: string): Promise<Record<string, string>>   // never log
  mask(secretsPresent: boolean): { secrets_present: boolean }
}
```

Behavior:

- Admin “simular mensagem” / seed / optional Loja CTA → `ChannelSimulateInboundPort` (upsert Contact + ContactInbox + Conversation + Message; apply intent label).
- Agent outgoing messages → `StubChannelSendPort` marks `delivery_status=sent` without Meta HTTP.
- `WHATSAPP_INBOX_MODE=simulate` (no Meta webhook receiver).
- `ChannelCredentialsVaultPort` uses AES-256-GCM + `CREDENTIALS_ENCRYPTION_KEY` ([crm-chatwoot-parity.md](./crm-chatwoot-parity.md)).

## Jobs / egress

```ts
interface JobEnqueuePort { /* see jobs-realtime.md */ }
interface JobWorkerPort { tick(limit?: number): Promise<number> }

interface UrlEgressGuardPort {
  assertSafeHttpsUrl(url: string): Promise<{ href: string; hostname: string }>
}
```

Required before Phase B webhook/bot actions. Phase A may ship no-op consumers; Phase B wires real deliver handlers.

```ts
interface WebhookSignerPort {
  sign(secret: string, rawBody: string): string
}

interface AutomationActionPort {
  apply(input: {
    tenantId: string
    conversationId: string
    actions: Array<{ action_name: string; action_params: unknown }>
    actorUserId?: string
  }): Promise<{ applied: number; enqueuedJobs: string[] }>
}
```

`AutomationActionPort` reuses assign/label/status/message domain services; egress actions only enqueue jobs.

## Outbox category (Phase B CSAT + Phase C campaigns)

`OutboxTransportPort` unchanged. Writers set `category`: `commerce` (default) \| `campaign` \| `crm_agent` \| `csat` \| `agent_email`. Campaign WA one-offs may enqueue outbox with `category=campaign` and stub templates — **no** Meta template submission API.

## Campaign send (Phase C)

```ts
interface CampaignSendPort {
  /** Resolve audience + write StubOutboxTransport only. Never Meta/Twilio. */
  enqueueBatch(input: {
    tenantId: string
    campaignId: string
    cursor?: string
    limit: number
  }): Promise<{ processed: number; done: boolean; nextCursor?: string }>
}
```

Implementation lives behind `campaign.send_batch` job. Ongoing website display is **not** a send port in C (`display_status=awaiting_widget` until Phase D widget).

## Explicitly forbidden / deferred ports

| Port | Status |
|---|---|
| Meta Cloud API inbound/outbound | forbidden until product approves paid integration |
| SMTP provider | optional later; stub outbox is enough |
| NF-e / SEFAZ | forbidden |
| Payment / PIX | forbidden |
| Inventory file parse / AI apply | deferred (no port required for MVP) |
| Account billing provider | deferred |
| Captain / model provider | Phase E |
| Live channel providers (FB, IG, Telegram, …) | Phase D stubs only until paid unlock |
