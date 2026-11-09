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
       1──* Company
       1──* Contact ──? Cliente ──? User (loja login)
                   ──* ContactInbox
       1──* Inbox ──? ChannelWhatsapp
                 ──* InboxMember
                 ──* Conversation ──* Message
                                 ──* ConversationLabel ── Label
       1──* Team ──* TeamMember
       1──* CannedResponse
       1──* AgentNotification / AgentNotificationSetting
       1──* AgentPresence
       1──* DomainEvent
       1──* BackgroundJob
       1──* Orcamento ──* OrcamentoLine ──* OrcamentoStatusHistory
       1──* PedidoVenda ──* PedidoLine ──* PedidoStatusHistory
                      ──? VendaFaturamento ──* VendaStatusHistory
       1──* Sku 1──1 InventoryBalance
                1──* InventoryMovement
       1──* NotificationOutbox
       1──* Campaign ──* CampaignRecipient ── Contact
       1──* Portal ──* Category ──* Article
       1──* Session
```

**Phase A CRM** replaces `WhatsappThread` / `WhatsappMessage` (migrate in place — see [crm-chatwoot-parity.md](./crm-chatwoot-parity.md)). **Phase B** entities (AutomationRule, Macro, CustomAttributeDefinition, AgentBot, Webhook, WorkingHour, AssignmentPolicy, CsatResponse, CustomFilter) are fully contracted below. **Phase C** entities (Campaign, CampaignRecipient, Portal, Category, Article; optional ReportSnapshot) are fully contracted below — implement when that phase starts. Phase D+ remain sketched.

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

### Company (Phase A CRM)

CNPJ organization graph — shared by Contacts and Cliente. Not a second people DB.

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `cnpj_digits` / `cnpj_last4` | string | never log full |
| `cnpj_registro_pendente` | bool | |
| `razao_social` | string | |
| `nome_fantasia` | string? | |
| unique | `(tenant_id, cnpj_digits)` | |

### Contact (Phase A CRM)

CRM person. Prospects and WA chats exist here without being Cliente.

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `nome` | string | |
| `email` | string? | |
| `phone_e164` | string? | indexed; BR E.164 |
| `company_id` | fk? | |
| `cliente_id` | fk? | set when commerce-approved |
| `cadastro_request_id` | fk? | |
| `notas` | string? | free-text |
| `created_at` / `updated_at` | datetime | |

### ContactInbox

| Column | Notes |
|---|---|
| `tenant_id`, `contact_id`, `inbox_id` | |
| `source_id` | channel identity (WA = phone E.164) |
| unique | `(tenant_id, inbox_id, source_id)` |

### Cliente

Created on cadastro `aprovado` (or seeded). **Commerce gate only** — not the CRM contact graph.

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `user_id` | fk? | loja login user when credentials exist |
| `company_id` | fk? | Phase A: link to Company by CNPJ |
| `primary_contact_id` | fk? | Phase A: Contact for this buyer |
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

CadastroRequest gains `contact_id?` and `conversation_id?` (replaces `thread_id` after migration).

### Inbox + ChannelWhatsapp (Phase A)

| Inbox | Notes |
|---|---|
| `tenant_id`, `name`, `channel_type` | Phase A: `whatsapp` (D+: email, api, web_widget, …) |
| `greeting` / `ooo_message` | string? |
| `csat_enabled` | bool default false |
| `lock_to_single_conversation` | bool |
| `allow_auto_assign` | bool |
| `vendedor_see_all` | bool default false |

One **default** WhatsApp inbox per tenant (seed). `ChannelWhatsapp` 1:1:

| Column | Notes |
|---|---|
| `provider` | `whatsapp_cloud` \| `default` |
| `phone_e164_display` | routing/display |
| `phone_number_id` / `business_account_id` | plaintext metadata |
| `secrets_ciphertext` | AES-256-GCM envelope — api_key/token, api_secret, webhook_verify_token |
| `connection_status` | `not_configured` \| `credentials_saved` \| `ready_stub` \| `live` |
| `message_templates_json` | stub template cache (editable) |

`live` is **unreachable** until product unlocks Meta.

### Conversation / Message (Phase A — evolves WhatsappThread/Message)

| Conversation | Notes |
|---|---|
| `tenant_id`, `inbox_id`, `contact_id` | required |
| `status` | `open` \| `pending` \| `snoozed` \| `resolved` |
| `priority` | `low` \| `medium` \| `high` \| `urgent` \| null |
| `assignee_user_id` / `team_id` | nullable |
| `snoozed_until` | datetime? |
| `muted` | bool |
| `cliente_id` / `cadastro_request_id` / `orcamento_id` | commerce deep-links |
| `last_activity_at` | for sort |
| `created_at` / `updated_at` | |

| Message | Notes |
|---|---|
| `tenant_id`, `conversation_id` | |
| `message_type` | `incoming` \| `outgoing` \| `activity` |
| `private` | bool — private notes |
| `content` | text |
| `content_type` | `text` \| `attachment` (metadata only in A) |
| `attachment_meta_json` | filename, mime, size, storage key — no execute |
| `sender_user_id` | agent when outgoing/note |
| `delivery_status` | `queued` \| `sent` \| `delivered` \| `read` \| `failed` — stub for WA |
| `simulated` | bool |
| `created_at` | |

Legacy map: thread `aberta`→`open`, `arquivada`→`resolved`; message `inbound`→`incoming`; `outbound_note`→`outgoing` + `private=true`. Intent enum → system **Label** on conversation. No Meta message ids while stubbed.

### Label / Team / InboxMember / CannedResponse

| Entity | Notes |
|---|---|
| **Label** | `tenant_id`, `title`, `color`, `show_on_sidebar`; system titles `intent:cadastro` etc. seeded |
| **ConversationLabel** / **ContactLabel** | M2M |
| **Team** | `tenant_id`, `name` |
| **TeamMember** | `team_id`, `user_id` |
| **InboxMember** | `inbox_id`, `user_id` |
| **CannedResponse** | `short_code`, `content` with `{{contact.nome}}` etc.; tenant-scoped |

### Agent notifications & presence

| Entity | Notes |
|---|---|
| **AgentNotificationSetting** | per user: assigned / unassigned / conversation activity booleans; email via outbox stub optional |
| **AgentNotification** | `user_id`, `type`, `title`, `body`, `conversation_id?`, `read_at?` |
| **AgentPresence** | `user_id`, `conversation_id?`, `state`, `expires_at` |
| User profile extras | `availability` `online`\|`busy`\|`offline`; `signature` text? (signature UI may trail to B) |

### DomainEvent / BackgroundJob

See [jobs-realtime.md](./jobs-realtime.md). Both tenant-scoped. Phase A writes events on CRM mutations; job worker present; automation kinds idle until B.

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
| `recipient_role` | `customer` \| `vendedor` \| `agent` | `agent` for CRM desk emails |
| `recipient` | string | PII |
| `template_key` | string | e.g. `cadastro.aprovado`, `orcamento.status`, `pedido.status`, `venda.faturado`, `campaign.wa_one_off` |
| `category` | `commerce` \| `campaign` \| `crm_agent` \| `csat` \| `agent_email` | default `commerce`; Phase C campaigns use `campaign` |
| `campaign_id` | fk? | null until Phase C |
| `payload_json` | string | ids + status — **no full tax ID** |
| `status` | `pendente` \| `enviado` \| `falha` | |
| `orcamento_id` / `pedido_id` / `venda_id` / `cadastro_request_id` / `conversation_id` | fk? | |
| `created_at` | | |

Commerce notification UX lists `category = commerce` (and null-treated-as-commerce during migration). Do not mix campaign blasts into that list without a filter.

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
| `companies` | unique `(tenant_id, cnpj_digits)` |
| `contacts` | `(tenant_id, phone_e164)`; `(tenant_id, email)`; `(tenant_id, cliente_id)` |
| `contact_inboxes` | unique `(tenant_id, inbox_id, source_id)` |
| `inboxes` | `(tenant_id, channel_type)` |
| `conversations` | `(tenant_id, status, last_activity_at)`; `(tenant_id, assignee_user_id)`; `(tenant_id, inbox_id)`; `(tenant_id, contact_id)` |
| `messages` | `(tenant_id, conversation_id, created_at)` |
| `labels` | unique `(tenant_id, title)` |
| `teams` / `team_members` / `inbox_members` | tenant + parent fks |
| `canned_responses` | unique `(tenant_id, short_code)` |
| `domain_events` | `(tenant_id, created_at)` |
| `background_jobs` | `(status, run_after)`; `(tenant_id, kind, status)` |
| `orcamentos` | `(tenant_id, status)`; `(tenant_id, cliente_id)` |
| `pedidos_venda` | `(tenant_id, status)`; `(tenant_id, cliente_id)`; unique `orcamento_id` |
| `vendas_faturamento` | `(tenant_id, status)`; partial unique non-cancelled per `pedido_id` |
| `skus` | unique `(tenant_id, codigo)`; `(tenant_id, visivel_loja)` |
| `inventory_balances` | `(tenant_id)` |
| `inventory_movements` | `(tenant_id, sku_id, created_at)` |
| `notification_outbox` | `(tenant_id, status)`; `(tenant_id, category, status)` |
| `sessions` | unique `token_hash` |

Legacy `whatsapp_threads` / `whatsapp_messages` indexes are removed after Phase A migration.

List endpoints paginated (cursor + limit, default 20, max 100). Catalog: one join Sku↔Balance, no N+1.

## Phase B entities (operator power)

Implement in Phase B migrations. Vocabulary and execution: [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) Phase B. All rows `tenant_id`-scoped unless noted.

### Contact / Conversation — attribute bag (Phase B column)

| Column | Notes |
|---|---|
| `custom_attributes_json` | object map `attribute_key → value`; validated against definitions on write |
| Conversation also | `bot_agent_bot_id?` — set while bot owns (`pending`); cleared on handoff |
| Conversation also | `csat_token?` / `csat_sent_at?` — opaque survey token once |

### AutomationRule

| Column | Notes |
|---|---|
| `tenant_id`, `name`, `description?` | |
| `event_name` | see Phase B vocabulary |
| `conditions_json` | `{ operator: "and", values: [{ attribute_key, filter_operator, values[] }] }` |
| `actions_json` | ordered `{ action_name, action_params }[]` |
| `active` | bool |
| `created_by_user_id` | |
| unique | none beyond id; soft cap 20 active in domain |

### Macro

| Column | Notes |
|---|---|
| `tenant_id`, `name`, `actions_json` | same action shape as automations (no `send_webhook` in macros for B — lock: webhook only via AutomationRule / Webhook entity) |
| `visibility` | `public` \| `private` |
| `owner_user_id` | required when `private`; null when public |

### CustomAttributeDefinition

| Column | Notes |
|---|---|
| `tenant_id` | |
| `attribute_model` | `contact` \| `conversation` |
| `attribute_display_type` | `text` \| `number` \| `link` \| `date` \| `list` \| `checkbox` |
| `attribute_key` | slug; unique `(tenant_id, attribute_model, attribute_key)` |
| `attribute_display_name` | pt-BR label |
| `default_value_json?` | |
| `attribute_values_json?` | list options when type=`list` |
| seed keys (commerce) | e.g. `conversation.orcamento_id_ref` optional display; prefer existing FK columns for commerce — custom attrs for free-form ops fields |

### AgentBot + AgentBotInbox

| AgentBot | Notes |
|---|---|
| `tenant_id`, `name`, `description?` | |
| `outgoing_url` | https webhook; validated by egress guard on save **and** deliver |
| `token` | random; sent as bearer to bot; never logged full |
| `active` | bool |

| AgentBotInbox | Notes |
|---|---|
| `agent_bot_id`, `inbox_id` | unique `(inbox_id)` — one bot per inbox in B |
| On incoming | if linked + active → keep/set conversation `pending`, set `bot_agent_bot_id`, enqueue `bot.deliver` |

### Webhook

| Column | Notes |
|---|---|
| `tenant_id`, `url` | https; egress guard |
| `name?` | |
| `subscriptions_json` | string[] of event names (same as automation events + `message_created`, …) |
| `inbox_id?` | null = account-level; set = inbox-scoped |
| `active` | bool |

Tenant row gains `webhook_signing_secret` (or separate secrets table) — generated; admin rotate; used for HMAC.

### WorkingHour

| Column | Notes |
|---|---|
| `inbox_id`, `day_of_week` | 0=Sunday … 6=Saturday (Chatwoot parity) |
| `closed_all_day` / `open_all_day` | bool |
| `open_hour` / `open_minutes` / `close_hour` / `close_minutes` | ints when not all-day |
| Inbox | `timezone` IANA; `ooo_message` / `greeting` already Phase A |

### AssignmentPolicy

| Column | Notes |
|---|---|
| `inbox_id` | 1:1 optional |
| `kind` | `round_robin` only in B (`balanced` / capacity = E) |
| `enabled` | bool |
| `last_assigned_user_id?` | cursor for RR |

### CsatResponse

| Column | Notes |
|---|---|
| `tenant_id`, `conversation_id`, `inbox_id`, `contact_id?` | |
| `rating` | int 1–5 |
| `feedback_message?` | text |
| `assigned_agent_id?` | snapshot at resolve |
| `submitted_at` | |
| unique | `(conversation_id)` — one CSAT per conversation in B |

### CustomFilter

| Column | Notes |
|---|---|
| `tenant_id`, `user_id`, `name` | |
| `filter_type` | `conversation` \| `contact` |
| `query_json` | saved filter AST (status, labels, assignee, attribute predicates) |
| visibility | personal only in B (shared folders = E if needed) |

### ContactMerge / import (ops, not long-lived tables required)

- Merge: domain transaction — surviving `contact_id`, re-point conversations, contact_inboxes, labels, notes; loser soft-deleted or `merged_into_id`.
- CSV import: ephemeral `background_jobs` payload + optional `contact_import_batches` (`id`, `status`, `stats_json`) for UI progress.

### Mentions

No new table required: parse message content for mention markers → insert `AgentNotification` (`type=mention`). Optional `message_mentions (message_id, user_id)` for query — nice-to-have in B.

## Phase C entities (growth & insight)

See [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) Phase C locks. Implement with Phase C — not before.

### Campaign

| Column | Notes |
|---|---|
| `tenant_id`, `title`, `description?` | |
| `kind` | `one_off` \| `ongoing` |
| `status` | `draft` \| `scheduled` \| `active` \| `completed` \| `cancelled` |
| `inbox_id?` | required for `one_off` WA/SMS; optional for ongoing |
| `channel` | `whatsapp` \| `sms` (both stub send in C) |
| `audience_label_ids_json` | string[] of Label ids — OR match on Contact labels |
| `template_key?` | must exist in channel stub `message_templates_json` for one_off |
| `message?` | ongoing website copy / fallback body |
| `scheduled_at?` | when `scheduled` |
| `display_status?` | ongoing: `awaiting_widget` \| `ready` (ready only after Phase D widget); null for one_off |
| `started_at?`, `completed_at?` | |
| `created_by_user_id` | admin |
| `stats_json?` | `{ targeted, enviado, falha }` denormalized after batch |

Indexes: `(tenant_id, status)`, `(tenant_id, kind)`.

### CampaignRecipient

| Column | Notes |
|---|---|
| `tenant_id`, `campaign_id`, `contact_id` | |
| `status` | `pendente` \| `enviado` \| `falha` \| `omitido` |
| `outbox_id?` | fk notification_outbox when written |
| `error?` | truncated; no PII dumps |
| unique | `(campaign_id, contact_id)` — send idempotency |

### Portal (Help Center)

| Column | Notes |
|---|---|
| `tenant_id` | unique among **enabled** portals — C lock: at most one `enabled=true` per tenant |
| `name`, `slug` | `slug` unique per tenant |
| `header_text?`, `homepage_md?` | |
| `locale` | fixed `pt-BR` in C |
| `enabled` | bool |
| `custom_domain?` | **null / ignored until E** — do not route on it in C |

### Category (Help Center)

| Column | Notes |
|---|---|
| `tenant_id`, `portal_id`, `name`, `slug` | slug unique per portal |
| `description?`, `position` | int |
| `parent_category_id?` | optional nesting; MVP may stay flat |

### Article

| Column | Notes |
|---|---|
| `tenant_id`, `portal_id`, `category_id` | |
| `title`, `slug` | slug unique per portal |
| `content_md` | source |
| `content_html?` | sanitized render cache |
| `status` | `draft` \| `published` \| `archived` |
| `author_user_id` | |
| `published_at?` | |
| `position?` | |

Indexes: `(portal_id, status)`, `(portal_id, slug)`.

### ReportSnapshot (optional)

| Column | Notes |
|---|---|
| `tenant_id`, `series`, `bucket_date`, `dims_json`, `metrics_json` | |
| unique | `(tenant_id, series, bucket_date, dims_hash)` |

Not required for Phase C acceptance if live queries are fast enough on seed scale.

### NotificationOutbox (Phase C usage)

Already has `category` + `campaign_id` (see outbox section above). Campaign writers **must** set both; commerce readers filter `category = commerce`.

## Phase D–E entities (sketch)

| Phase | Entities |
|---|---|
| **D** | Additional `channel_*` tables; `WidgetConfig`; client messaging API identities; ongoing campaign display linkage |
| **E** | `SlaPolicy`; `AuditEvent`; Captain/AI ports; SAML config; custom role tables; balanced capacity; HC custom domain routing; CSAT review notes |

## What must not exist (MVP + parity)

- Second stock / `store_stocks` table.
- Meta webhook tables as **source of truth** for messages (stub simulate + outbox only until unlock).
- Parallel write path to legacy `whatsapp_threads` after Conversation migration.
- NF-e, PIX, payment capture tables.
- Account billing tables driving ops entitlement.
- AI inventory import batches.
- CPF / varejo price path as a sales channel.
- Plaintext storage of WA access tokens / app secrets.
- Storing bot/webhook response bodies with full PII in `last_error` / logs.
