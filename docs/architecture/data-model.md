# Data model

SQLite today (`prisma/schema.prisma`). Every operational table has `tenant_id`. There is **one** inventory ledger. Loja availability is computed, never stored as a second quantity.

Money is **integer centavos**. Tax IDs are digits-only; persist last-4 for masking; **never log the full value**.

`available` is always `max(0, on_hand - reserved)`. Do not add `available` as a persisted column.

This model **replaces** the former single `Order` (`novo`→`entregue`) machine and Account entitlement fields. Backend migrations for the pivot may drop or migrate legacy tables; the target schema is below.

## Entities

```
Tenant 1──1 Theme
       1──* Membership ──1 User
       1──* CadastroRequest
       1──* Cliente ──? User (loja login)
       1──* WhatsappThread ──* WhatsappMessage
       1──* Orcamento ──* OrcamentoLine ──* OrcamentoStatusHistory
       1──* PedidoVenda ──* PedidoLine ──* PedidoStatusHistory
                      ──? VendaFaturamento ──* VendaStatusHistory
       1──* Sku 1──1 InventoryBalance
                1──* InventoryMovement
       1──* NotificationOutbox
       1──* Session
```

No `InventoryImportBatch` in MVP. No Account / subscription tables required for ops.

### Tenant

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `slug` | string unique | seed: `casa-dos-frios` |
| `razao_social` | string | |
| `nome_fantasia` | string | brand-facing; seed “Casa dos Frios” |
| `cnpj_digits` | string | tenant company CNPJ; mask in UI |
| `cnpj_last4` | string | |
| `whatsapp_comercial` | string? | E.164; wa.me + outbox |
| `canais_aviso` | `email` \| `whatsapp` \| `ambos` | seed: `whatsapp` |
| `loja_modo` | `pedido_direto` \| `orcamento` | default `pedido_direto` |
| `default_vendedor_user_id` | fk User | Loja pedidos attributed here |
| `created_at` | datetime | |

Do **not** gate ops on `subscription_status` in MVP. If a legacy column remains in DB during migration, ignore it (always treat seed as operational).

### Theme (1:1 tenant)

| Column | Type | Seed |
|---|---|---|
| `tenant_id` | pk/fk | |
| `marca` | string | `Casa dos Frios` |
| `primary` | hex | design-owned; non-default |
| `accent` | hex | design-owned |
| `background` | hex | design-owned |
| `logo_url` | string? | null until real asset (placeholder OK) |

### User

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `email` | string unique | MVP: globally unique |
| `password_hash` | string | |
| `nome` | string | |
| `whatsapp` | string? | PII; E.164 |
| `ativo` | bool | deactivate without delete |
| `created_at` | datetime | |

### Membership

One row per user per tenant. MVP SaaS roles only.

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `tenant_id` | fk | |
| `user_id` | fk | |
| `saas_role` | `admin` \| `vendedor` \| null | null for loja-only clientes |
| `is_customer` | bool | Loja customer session |
| unique | `(tenant_id, user_id)` | |

No `account_owner`. No `estoquista` / `entregador` / `supervisor` in MVP enums.

### CadastroRequest (Solicitação de cadastro)

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `cnpj_digits` | string | never log full |
| `cnpj_last4` | string | |
| `cnpj_registro_pendente` | bool | registry degrade |
| `razao_social` | string | from registry when ok |
| `contato_nome` | string | |
| `email` | string | |
| `whatsapp` | string | E.164 |
| `status` | `pendente` \| `aprovado` \| `recusado` | |
| `motivo_recusa` | string? | required when `recusado` |
| `source` | `loja` \| `whatsapp` \| `saas` | |
| `thread_id` | fk? | optional inbox link |
| `cliente_id` | fk? | set on approve |
| `reviewed_by_user_id` | fk? | |
| `created_at` / `updated_at` | datetime | |

Unique active CNPJ per tenant: at most one non-`recusado` request (or unique `(tenant_id, cnpj_digits)` with business rules preventing duplicate `pendente`/`aprovado`).

### Cliente

Created on cadastro `aprovado` (or seeded).

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `user_id` | fk? | loja login user when credentials exist |
| `cnpj_digits` / `cnpj_last4` | string | |
| `cnpj_registro_pendente` | bool | |
| `razao_social` | string | |
| `contato_nome` | string | |
| `email` | string | |
| `whatsapp` | string | |
| `status` | `aprovado` | MVP: only approved clientes; refuse does not create |
| `cadastro_request_id` | fk? | |
| unique | `(tenant_id, cnpj_digits)` | |

MVP does **not** sell to CPF-only customers. No `document_type` varejo path.

### WhatsappThread / WhatsappMessage (simulated inbox)

| Thread | Notes |
|---|---|
| `tenant_id`, `phone_e164` | identity of chat |
| `intent` | `cadastro` \| `orcamento` \| `info_empresa` \| `outro` \| null |
| `cliente_id` / `cadastro_request_id` / `orcamento_id` | optional links |
| `status` | `aberta` \| `arquivada` |

| Message | Notes |
|---|---|
| `direction` | `inbound` \| `outbound_note` |
| `body` | text |
| `simulated` | bool — true for admin “simular mensagem” |
| `created_at` | |

No Meta message ids in MVP.

### Orcamento

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `cliente_id` | fk? | may be null for prospect; accept blocked until aprovado |
| `cadastro_request_id` | fk? | |
| `vendedor_user_id` | fk | |
| `status` | see machine | |
| `valido_ate` | datetime? | required before `enviado` |
| `channel` | `saas` \| `whatsapp` \| `loja` | |
| `pedido_id` | fk? | set when accept creates Pedido |
| `created_at` / `updated_at` | | |

### OrcamentoLine

Snapshot: `sku_id`, `codigo_snapshot`, `nome_snapshot`, `qty`, `unit_price_centavos` (frozen `preco_atacado`), `notas?`. Client unit prices discarded.

### PedidoVenda

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `cliente_id` | fk | **must** be aprovado cliente |
| `vendedor_user_id` | fk | |
| `orcamento_id` | fk? | unique when set — one Pedido per Orçamento |
| `channel` | `loja` \| `saas` \| `orcamento` | |
| `status` | see machine | |
| `created_at` / `updated_at` | | |

### PedidoLine

Same snapshot pattern as orçamento lines. Server sets unit price from SKU `preco_atacado_centavos` (+ MOQ check).

### VendaFaturamento (stub)

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `pedido_id` | fk | unique among non-`cancelado` |
| `status` | `rascunho` \| `faturado` \| `cancelado` | |
| `created_by_user_id` | fk | |
| `created_at` / `updated_at` | | |

No NF-e number, SEFAZ protocol, or payment columns.

### Status history tables

`orcamento_status_histories`, `pedido_status_histories`, `venda_status_histories`: every transition appends one row (`from`, `to`, `actor_user_id`, `created_at`). That write triggers outbox enqueue (except silent create→`rascunho` where product says so).

### Sku

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `codigo` | string | unique per tenant |
| `nome` | string | |
| `preco_atacado_centavos` | int | MVP list price |
| `qtd_min_atacado` | int | default 1 |
| `visivel_loja` | bool | projection filter |

No `preco_varejo` required for MVP (may omit or leave unused).

### InventoryBalance — **the only ledger**

1:1 with Sku. Loja does not have another quantity table.

| Column | Type | Notes |
|---|---|---|
| `sku_id` | pk/fk | |
| `tenant_id` | fk | denormalized |
| `on_hand` | int ≥ 0 | |
| `reserved` | int ≥ 0 | |
| invariant | `reserved ≤ on_hand` | |

### InventoryMovement

Append-only. Types in MVP: `reserve` \| `release` \| `consume` \| `adjust`. No `import_apply`.

### NotificationOutbox

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `channel` | `email` \| `whatsapp` | |
| `recipient_role` | `customer` \| `vendedor` | |
| `recipient` | string | PII |
| `template_key` | string | e.g. `cadastro.aprovado`, `orcamento.status`, `pedido.status`, `venda.faturado` |
| `payload_json` | string | ids + status — **no full tax ID** |
| `status` | `pendente` \| `enviado` \| `falha` | |
| `orcamento_id` / `pedido_id` / `venda_id` / `cadastro_request_id` | fk? | |
| `created_at` | | |

### Session

| Column | Notes |
|---|---|
| `token_hash` | lookup |
| `user_id`, `tenant_id` | |
| `surface` | `loja` \| `saas` |
| `expires_at` | |

## Status machines

Product matrices in `docs/product/spec.md` are authoritative. Summary for implementers:

### Orçamento

`rascunho` → `enviado` → `aceito` | `recusado` | `expirado` | `cancelado`; also `rascunho` → `cancelado`.

On `aceito`: **if** linked cliente/cadastro is `aprovado`, create Pedido `confirmado` (+ reserve) in the same transaction; else reject transition with cadastro gate error (orçamento may stay `enviado`).

### Pedido de venda

`confirmado` → `em_separacao` → `despachado` → `entregue`; cancel from `confirmado` / `em_separacao` only.

| Stock | When |
|---|---|
| **reserve** | create → `confirmado` |
| **release** | cancel before `despachado` |
| **consume** | → `despachado` |

### Venda / Faturamento

`rascunho` → `faturado` | `cancelado`. Create only when Pedido is not `cancelado` and no other non-cancelled Venda exists.

Illegal transition by **role** → **403**. Illegal **state** → **409**. Neither writes stock nor outbox.

## Stock movement math

- **reserve**: `reserved += qty`; fail whole tx if any line `qty > available` or MOQ fail.
- **release**: `reserved -= qty`.
- **consume**: `on_hand -= qty`, `reserved -= qty`.
- **adjust**: admin only; reason required; reject if new `on_hand < reserved`.

Loja projection: SKU listed iff `visivel_loja`; shown qty = `available`. Zero available → cannot buy. Toggling visibility does not touch ledger.

## Indexes

| Table | Index |
|---|---|
| `tenants` | unique `slug` |
| `memberships` | unique `(tenant_id, user_id)`; `(tenant_id, saas_role)` |
| `cadastro_requests` | `(tenant_id, status)`; `(tenant_id, cnpj_digits)` |
| `clientes` | unique `(tenant_id, cnpj_digits)`; `(tenant_id, user_id)` |
| `whatsapp_threads` | `(tenant_id, phone_e164)`; `(tenant_id, intent)` |
| `orcamentos` | `(tenant_id, status)`; `(tenant_id, cliente_id)` |
| `pedidos_venda` | `(tenant_id, status)`; `(tenant_id, cliente_id)`; unique `orcamento_id` |
| `vendas_faturamento` | `(tenant_id, status)`; partial unique non-cancelled per `pedido_id` |
| `skus` | unique `(tenant_id, codigo)`; `(tenant_id, visivel_loja)` |
| `inventory_balances` | `(tenant_id)` |
| `inventory_movements` | `(tenant_id, sku_id, created_at)` |
| `notification_outbox` | `(tenant_id, status)` |
| `sessions` | unique `token_hash` |

List endpoints paginated (cursor + limit, default 20, max 100). Catalog: one join Sku↔Balance, no N+1.

## What must not exist (MVP)

- Second stock / `store_stocks` table.
- Meta webhook tables as source of truth.
- NF-e, PIX, payment capture tables.
- Account billing tables driving ops entitlement.
- AI inventory import batches.
- CPF / varejo price path as a sales channel.
