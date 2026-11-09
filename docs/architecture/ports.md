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

## WhatsApp inbox simulator

```ts
interface WhatsappInboxSimulatePort {
  ingestInbound(input: {
    tenantId: string
    phoneE164: string
    body: string
    intentHint?: "cadastro" | "orcamento" | "info_empresa" | "outro"
  }): Promise<{ threadId: string; messageId: string }>;
}
```

MVP behavior:

- Admin SaaS action “simular mensagem” calls this port.
- Seed uses the same path to create sample threads.
- Optional Loja CTA demo hook may call it when explicitly enabled for demos; production wa.me link does not require Meta.
- **No** Meta webhook receiver in MVP. `WHATSAPP_INBOX_MODE=simulate`.

Intent tags may be set manually by admin/vendedor after ingest. Linking a thread to cadastro/orçamento is a SaaS write, not automatic magic beyond seed examples.

## Explicitly out of MVP ports

| Port | Status |
|---|---|
| Meta Cloud API inbound/outbound | forbidden until product approves paid integration |
| SMTP provider | optional later; stub outbox is enough |
| NF-e / SEFAZ | forbidden |
| Payment / PIX | forbidden |
| Inventory file parse / AI apply | deferred (no port required for MVP) |
| Account billing provider | deferred |
