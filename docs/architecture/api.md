# API

Base: `/api`. JSON envelope. pt-BR `message`. Types: `packages/shared`.

```ts
type ApiOk<T> = { data: T };
type ApiErr = { error: { code: string; message: string; details?: unknown } };
```

Pagination on lists: `?cursor=&limit=` (default 20, max 100) → `{ data: { items, next_cursor } }`.

Tenant on public Loja GETs: `?tenant=casa-dos-frios` or default env slug. Authenticated routes use session `tenantId` only.

## Error codes

| HTTP | `code` | When |
|---|---|---|
| 401 | `unauthenticated` | missing/expired session |
| 403 | `forbidden` | wrong surface or role |
| 403 | `cadastro_nao_aprovado` | Pedido/Venda/accept blocked by cadastro gate |
| 404 | `nao_encontrado` | unknown or **other tenant** (same body) |
| 409 | `transicao_ilegal` | status not allowed from current state |
| 409 | `estoque_insuficiente` | reserve would exceed available |
| 409 | `conflito` | e.g. second Venda, duplicate Pedido for Orçamento |
| 422 | `validacao` | Zod / business field |
| 422 | `checksum_invalido` | CNPJ módulo 11 |
| 422 | `moq_atacado` | qty &lt; `qtd_min_atacado` |
| 429 | `rate_limit` | public cadastro / CNPJ lookup / simulate abuse |
| 501 | `nao_implementado` | scaffold stub (remove as backend fills) |

Illegal transition by **role** while the state would be legal for someone else → **403** `forbidden`. Illegal **state** → **409** `transicao_ilegal`. Neither writes stock nor outbox.

## Public / identity

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{ ok: true }` |
| POST | `/api/identidade/cnpj` | public, rate-limit | `{ cnpj }` → registry or degrade; do not log full CNPJ |

## Loja — public

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/loja/tema` | public | tenant tokens |
| GET | `/api/loja/config` | public | `loja_modo`, `whatsapp_comercial` (masked/wa link inputs) |
| GET | `/api/loja/catalogo` | public | projection: `visivel_loja` + `available` + `preco_atacado` |
| GET | `/api/loja/produtos/:id` | public | 404 if hidden |
| POST | `/api/loja/cadastro` | public, rate-limit | creates CadastroRequest `pendente` |
| POST | `/api/loja/login` | public | customer membership |
| POST | `/api/loja/whatsapp-cta` | public, optional | may enqueue simulated inbound for demo; rate-limited |

Catalog item:

```ts
{
  id: string
  sku: string
  nome: string
  preco_atacado_centavos: number
  qtd_min_atacado: number
  available: number
  sem_estoque: boolean
}
```

## Loja — customer session

| Method | Path | Authz |
|---|---|---|
| POST | `/api/loja/logout` | customer |
| GET | `/api/loja/sessao` | customer |
| GET | `/api/loja/me/cadastro` | own cadastro/cliente status |
| GET | `/api/loja/orcamentos` | own |
| GET | `/api/loja/orcamentos/:id` | own; 404 else |
| POST | `/api/loja/orcamentos/:id/transicao` | own; `aceito` \| `recusado` from `enviado` only |
| GET | `/api/loja/pedidos` | own |
| GET | `/api/loja/pedidos/:id` | own |
| POST | `/api/loja/pedidos` | Cliente `aprovado` + `loja_modo=pedido_direto` |

`POST /api/loja/pedidos` body: `{ linhas: { sku_id, qty }[] }`. Server creates Pedido `confirmado`, freezes atacado prices, reserves stock, assigns `default_vendedor_user_id`. Reject guest, prospect, MOQ, hidden SKU, insufficient available, client `unit_price`.

`POST .../orcamentos/:id/transicao` with `aceito` runs cadastro gate; on success creates Pedido `confirmado`.

## SaaS — auth & admin

| Method | Path | Authz |
|---|---|---|
| POST | `/api/saas/login` | worker |
| POST | `/api/saas/logout` | session |
| GET | `/api/saas/sessao` | worker |
| GET | `/api/saas/usuarios` | admin |
| POST | `/api/saas/usuarios` | admin |
| PATCH | `/api/saas/usuarios/:id` | admin (deactivate / role within admin\|vendedor) |
| GET | `/api/saas/tema` | admin |
| PUT | `/api/saas/tema` | admin |
| GET | `/api/saas/config` | admin |
| PUT | `/api/saas/config` | admin (`canais_aviso`, `loja_modo`, profile fields) |
| GET | `/api/saas/avisos` | admin, vendedor (outbox list) |

## SaaS — cadastro

| Method | Path | Authz |
|---|---|---|
| GET | `/api/saas/cadastros` | admin, vendedor |
| GET | `/api/saas/cadastros/:id` | admin, vendedor |
| POST | `/api/saas/cadastros/:id/transicao` | admin, vendedor — `{ para: "aprovado" \| "recusado", motivo_recusa? }` |

Approve creates Cliente (+ Company/Contact links per [crm-chatwoot-parity.md](./crm-chatwoot-parity.md)), outbox notice. Refuse requires `motivo_recusa`.

## SaaS — CRM desk (Phase A)

Canonical Chatwoot-parity HTTP under `/api/saas/crm/*`. Full product inventory: `docs/product/chatwoot-parity.md`. Architecture: [crm-chatwoot-parity.md](./crm-chatwoot-parity.md).

**Legacy:** `/api/saas/inbox*` is **deprecated** at Phase A ship — redirect or thin proxy to CRM conversas for one release, then remove. No dual-write after migration.

### Inboxes & WhatsApp channel

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/inboxes` | admin, vendedor | list; vendedor: membership only |
| POST | `/api/saas/crm/inboxes` | **admin** | create inbox (+ channel stub) |
| GET | `/api/saas/crm/inboxes/:id` | admin, member | |
| PATCH | `/api/saas/crm/inboxes/:id` | **admin** | greeting, OOOH, flags, members replace via sub-route |
| GET/PUT | `/api/saas/crm/inboxes/:id/members` | **admin** | `{ user_ids: string[] }` |
| GET | `/api/saas/crm/inboxes/:id/channel` | **admin** | WA config; **secrets masked** |
| PUT | `/api/saas/crm/inboxes/:id/channel` | **admin** | credentials (encrypt); status ≤ `ready_stub`; reject `live` |
| GET/PUT | `/api/saas/crm/inboxes/:id/templates` | **admin** | stub `message_templates` JSON |
| POST | `/api/saas/crm/simular` | **admin** | `{ inbox_id?, phone_e164, body, intent_label? }` → Conversation + incoming Message |

### Conversas

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/conversas` | admin, vendedor | filters: `status`, `inbox_id`, `assignee`, `team_id`, `label`, `q`, `updated_since`, cursor |
| GET | `/api/saas/crm/conversas/:id` | admin, visible vendedor | includes contact, labels, commerce links |
| PATCH | `/api/saas/crm/conversas/:id` | admin, visible vendedor | status, priority, assignee, team, mute, snooze, commerce link ids |
| POST | `/api/saas/crm/conversas/bulk` | admin, vendedor | `{ ids, action, params }` assign/resolve/label/mute |
| GET | `/api/saas/crm/conversas/:id/mensagens` | same | cursor; `?after=` for poll |
| POST | `/api/saas/crm/conversas/:id/mensagens` | same | `{ content, private?, content_type? }` — outgoing stub delivery |
| POST | `/api/saas/crm/conversas/:id/labels` | same | `{ label_ids }` replace or add (document in shared types) |
| PUT | `/api/saas/crm/conversas/:id/draft` | same | agent draft body |
| GET | `/api/saas/crm/busca` | admin, vendedor | `?q=` conversations/contacts/messages |

Conversation status body values: `open` \| `pending` \| `snoozed` \| `resolved`. Priority: `low` \| `medium` \| `high` \| `urgent` \| null.

### Contatos & empresas

| Method | Path | Authz |
|---|---|---|
| GET/POST | `/api/saas/crm/contatos` | admin, vendedor |
| GET/PATCH | `/api/saas/crm/contatos/:id` | admin, vendedor |
| POST | `/api/saas/crm/contatos/:id/notas` | admin, vendedor |
| POST | `/api/saas/crm/contatos/:id/conversas` | admin, vendedor — start outbound on contactable inbox (WA stub) |
| GET/POST | `/api/saas/crm/empresas` | admin, vendedor |
| GET/PATCH | `/api/saas/crm/empresas/:id` | admin, vendedor |

### Labels, teams, canned, notifications, presence, realtime

| Method | Path | Authz |
|---|---|---|
| GET/POST | `/api/saas/crm/labels` | admin, vendedor (POST admin **or** both — lock: **both** may CRUD labels in A for parity speed; revisit E) |
| PATCH/DELETE | `/api/saas/crm/labels/:id` | same |
| GET/POST | `/api/saas/crm/teams` | **admin** POST; GET admin+vendedor |
| PATCH | `/api/saas/crm/teams/:id` | **admin** |
| GET/PUT | `/api/saas/crm/teams/:id/members` | **admin** |
| GET/POST | `/api/saas/crm/respostas-rapidas` | admin, vendedor |
| PATCH/DELETE | `/api/saas/crm/respostas-rapidas/:id` | admin, vendedor |
| GET | `/api/saas/crm/notificacoes` | self |
| POST | `/api/saas/crm/notificacoes/:id/ler` | self |
| GET/PUT | `/api/saas/crm/notificacoes/preferencias` | self |
| PATCH | `/api/saas/crm/perfil` | self — availability, signature |
| POST | `/api/saas/crm/presence` | admin, vendedor — see [jobs-realtime.md](./jobs-realtime.md) |
| GET | `/api/saas/crm/events/stream` | admin, vendedor — SSE |

### Phase B — operator power

All under `/api/saas/crm/*` unless noted. Authz detail: [authz.md](./authz.md). Execution: [jobs-realtime.md](./jobs-realtime.md). Product: Phase B rows in `docs/product/chatwoot-parity.md`.

#### Automações

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/automacoes` | **admin** | list / create rule |
| GET/PATCH/DELETE | `/api/saas/crm/automacoes/:id` | **admin** | |
| POST | `/api/saas/crm/automacoes/:id/clonar` | **admin** | optional convenience |
| POST | `/api/saas/crm/automacoes/:id/testar` | **admin** | dry-run conditions against sample payload; **no** side effects / no egress |

Body create/patch: `{ name, description?, event_name, conditions, actions, active }`.

#### Macros

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/macros` | admin, vendedor | public + own private |
| POST | `/api/saas/crm/macros` | admin (public); admin\|vendedor (private own) | |
| GET/PATCH/DELETE | `/api/saas/crm/macros/:id` | owner or admin; public mutate = **admin** | |
| POST | `/api/saas/crm/macros/:id/executar` | admin, vendedor (visible macro) | `{ conversation_ids: string[] }` → enqueue/apply actions |

#### Atributos customizados

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/atributos` | GET both; POST **admin** | `?model=contact\|conversation` |
| GET/PATCH/DELETE | `/api/saas/crm/atributos/:id` | PATCH/DELETE **admin** | |
| PATCH | `/api/saas/crm/conversas/:id/atributos` | admin, visible vendedor | `{ attributes: Record<string, unknown> }` merge keys |
| PATCH | `/api/saas/crm/contatos/:id/atributos` | admin, vendedor | same |

#### Bots

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/bots` | **admin** | `outgoing_url` validated (egress assert on write) |
| GET/PATCH/DELETE | `/api/saas/crm/bots/:id` | **admin** | token returned once on create; GET masked |
| GET/PUT | `/api/saas/crm/bots/:id/inboxes` | **admin** | `{ inbox_ids: string[] }` — B: max one bot per inbox |
| POST | `/api/saas/crm/conversas/:id/bot/handoff` | admin, visible vendedor | clear bot lock; status → `open` |

#### Webhooks

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/webhooks` | **admin** | account or `{ inbox_id }` |
| GET/PATCH/DELETE | `/api/saas/crm/webhooks/:id` | **admin** | |
| POST | `/api/saas/crm/webhooks/:id/testar` | **admin** | enqueue `webhook.deliver` sample; SSRF guard |
| POST | `/api/saas/crm/webhooks/segredo/rotacionar` | **admin** | rotate tenant signing secret; returns secret once |

#### Horários comerciais

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/inboxes/:id/horarios` | GET admin+member; PUT **admin** | replace week array + `timezone` |
| GET | `/api/saas/crm/inboxes/:id/horarios/estado` | admin, member | `{ open_now: boolean, next_open_at? }` |

#### Políticas de atribuição

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/inboxes/:id/politica-atribuicao` | GET admin+member; PUT **admin** | `{ kind: "round_robin", enabled }` |

#### CSAT

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/csat` | **admin** | list responses; filters `inbox_id`, `rating`, cursor |
| GET | `/api/saas/crm/csat/:id` | **admin** | |
| PATCH | `/api/saas/crm/inboxes/:id` | **admin** | already A — includes `csat_enabled` |
| GET | `/api/public/csat/:token` | public | survey page payload (tenant brand minimal); rate-limit |
| POST | `/api/public/csat/:token` | public | `{ rating, feedback_message? }` → `CsatResponse`; one-shot |

#### Filtros salvos, merge, CSV, menções, assinatura

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/filtros` | admin, vendedor | personal saved filters |
| PATCH/DELETE | `/api/saas/crm/filtros/:id` | owner | |
| POST | `/api/saas/crm/contatos/mesclar` | admin, vendedor | `{ survivor_id, loser_id }` |
| POST | `/api/saas/crm/contatos/importar` | admin, vendedor | multipart CSV → job; returns `batch_id` |
| GET | `/api/saas/crm/contatos/importar/:batch_id` | admin, vendedor | progress/stats |
| POST | `/api/saas/crm/contatos/importar/preview` | admin, vendedor | dry-run parse first N rows |
| PATCH | `/api/saas/crm/perfil` | self | A + `signature` text applied to outgoing non-private messages when set |

Mentions: no extra route — included in `POST .../mensagens` content; notifications via existing `/notificacoes`.

### Phase C — Campanhas, Central de Ajuda, Relatórios

All SaaS CRM paths below are under `/api/saas/crm` unless noted. **No Meta / SMS provider HTTP.** See [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) Phase C locks.

#### Campanhas

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/campanhas` | **admin** | list; filters `kind`, `status`, cursor |
| POST | `/api/saas/crm/campanhas` | **admin** | create `draft`; body: `title`, `kind` (`one_off`\|`ongoing`), `inbox_id?`, `channel` (`whatsapp`\|`sms`), `audience_label_ids`, `template_key?`, `message?`, `scheduled_at?`, ongoing display fields |
| GET | `/api/saas/crm/campanhas/:id` | **admin** | includes recipient stats when sent |
| PATCH | `/api/saas/crm/campanhas/:id` | **admin** | editable while `draft`\|`scheduled`; audience locked after `active` |
| DELETE | `/api/saas/crm/campanhas/:id` | **admin** | only `draft`\|`cancelled`; else **409** |
| POST | `/api/saas/crm/campanhas/:id/enviar` | **admin** | one_off: enqueue `campaign.send_batch`; ongoing: set `active` + `display_status=awaiting_widget` (no blast) |
| POST | `/api/saas/crm/campanhas/:id/cancelar` | **admin** | `scheduled`\|`active` → `cancelled`; stops further batch pages |
| GET | `/api/saas/crm/campanhas/:id/destinatarios` | **admin** | CampaignRecipient page; status `pendente`\|`enviado`\|`falha`\|`omitido` |

`enviar` on one_off without resolvable audience or missing stub template → **422** `validacao`. SMS channel still stub-outbox only.

#### Central de Ajuda (SaaS authoring)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/central-ajuda/portal` | **admin** | singleton portal for tenant; `slug`, `name`, `header_text?`, `enabled`, locale fixed `pt-BR` |
| GET/POST | `/api/saas/crm/central-ajuda/categorias` | **admin** | list/create; `name`, `slug`, `position`, `description?` |
| GET/PATCH/DELETE | `/api/saas/crm/central-ajuda/categorias/:id` | **admin** | delete only if no published articles (or cascade archive — **lock:** refuse with **409** if published children) |
| GET/POST | `/api/saas/crm/central-ajuda/artigos` | **admin** | list/create; filters `status`, `category_id` |
| GET/PATCH/DELETE | `/api/saas/crm/central-ajuda/artigos/:id` | **admin** | body: `title`, `slug`, `category_id`, `content_md`, `status` |
| POST | `/api/saas/crm/central-ajuda/artigos/:id/publicar` | **admin** | → `published`; sets `published_at` |
| POST | `/api/saas/crm/central-ajuda/artigos/:id/despublicar` | **admin** | → `draft` (or `archived` via PATCH) |

#### Central de Ajuda (public)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/public/central-ajuda/:portalSlug` | public | portal metadata if `enabled`; else 404 |
| GET | `/api/public/central-ajuda/:portalSlug/categorias` | public | categories with published article counts |
| GET | `/api/public/central-ajuda/:portalSlug/artigos` | public | **published** only; optional `category_slug`, search `q` |
| GET | `/api/public/central-ajuda/:portalSlug/artigos/:articleSlug` | public | published article body; draft → **404** |

Rate-limit public HC reads lightly per IP. No contact PII in payloads. Custom domain Host routing = Phase E (slug paths here remain; see Phase E HC dominio).

#### Relatórios

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/relatorios/visao-geral` | **admin** | overview totals + sparklines by day |
| GET | `/api/saas/crm/relatorios/conversas` | **admin** | conversation series |
| GET | `/api/saas/crm/relatorios/agentes` | **admin** | per-agent rows |
| GET | `/api/saas/crm/relatorios/labels` | **admin** | per-label rows |
| GET | `/api/saas/crm/relatorios/inboxes` | **admin** | per-inbox rows |
| GET | `/api/saas/crm/relatorios/equipes` | **admin** | per-team rows |
| GET | `/api/saas/crm/relatorios/csat` | **admin** | rating distribution + avg (from `CsatResponse`) |
| GET | `/api/saas/crm/relatorios/bots` | **admin** | bot.messaged / handoff aggregates |

Query params (all series): `from`, `to` (required ISO), `tz?` (default `America/Sao_Paulo`), `inbox_id?`, `team_id?` where applicable. Range > 90 days → **422**. Vendedor → **403**. SLA reports are **not** in C (omit routes or **501** until E).

### Phase D — Omnichannel channels + Loja widget

See [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) Phase D locks. **No Meta / social / SMS / SMTP provider HTTP.** Max channel `connection_status` = `ready_stub` (`live` → **501** `nao_implementado`).

#### Caixas de entrada — channel types (extends Phase A)

| Method | Path | Authz | Notes |
|---|---|---|---|
| POST | `/api/saas/crm/caixas` | **admin** | body includes `channel_type` ∈ D enum; creates Inbox + typed channel row (`not_configured`) |
| GET | `/api/saas/crm/caixas` | admin, vendedor | includes `channel_type`, `connection_status` |
| GET/PATCH | `/api/saas/crm/caixas/:id` | admin; vendedor read if member | |
| GET/PUT | `/api/saas/crm/caixas/:id/canal` | **admin** write; vendedor read membership | polymorphic channel config; secrets write-only / masked on GET |
| POST | `/api/saas/crm/caixas/:id/canal/simular` | **admin** | simulate inbound for that channel (WA + email + social + sms + api shapes); widget prefer Loja widget routes |
| POST | `/api/saas/crm/caixas/:id/canal/rotacionar-token` | **admin** | `web_widget` website_token or `api` access token; returns plaintext **once** |

`channel_type` create values: `whatsapp` \| `web_widget` \| `email` \| `facebook` \| `instagram` \| `tiktok` \| `twitter` \| `telegram` \| `line` \| `sms` \| `api`.

#### Widget config (SaaS)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/caixas/:id/widget` | **admin** | pre_chat_fields, allowed_origins, welcome copy, color; only if `channel_type=web_widget` |
| GET | `/api/saas/crm/caixas/:id/widget/snippet` | **admin** | embed snippet + public `website_token` (no hmac) |

#### Email templates (stub)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/modelos-email` | **admin** | branded layout stubs pt-BR |
| GET/PATCH/DELETE | `/api/saas/crm/modelos-email/:id` | **admin** | |

#### Browser push (agent)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/push/vapid-public` | admin, vendedor | public key or **404** if unset |
| POST | `/api/saas/crm/push/subscriptions` | self | `{ endpoint, keys }` |
| DELETE | `/api/saas/crm/push/subscriptions/:id` | self | |

#### Loja widget (public / session)

Tenant resolved from `website_token` only. Rate-limit per IP + token.

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/loja/widget/bootstrap` | public | `?website_token=`; greeting, pre_chat schema, inbox public id, active ongoing campaigns, theme hints |
| POST | `/api/loja/widget/sessao` | public | creates `WidgetSession`; returns `session_token` (+ cookie) |
| POST | `/api/loja/widget/pre-chat` | widget session | upsert Contact + ContactInbox; required fields |
| GET | `/api/loja/widget/conversa` | widget session | current conversation summary or null |
| GET | `/api/loja/widget/mensagens` | widget session | cursor / `?after=`; poll primary |
| POST | `/api/loja/widget/mensagens` | widget session | visitor message → Conversation + Message `incoming`; opens/creates thread |
| POST | `/api/loja/widget/typing` | widget session | optional typing ping → SaaS SSE |
| GET | `/api/loja/widget/events/stream` | widget session | optional SSE; same event vocabulary subset |
| GET | `/api/loja/widget/campanhas` | widget session or bootstrap token | active ongoing for this inbox |

Agent replies use existing `POST /api/saas/crm/conversas/:id/mensagens` — delivery fan-out to widget session.

#### Client API (API channel)

Bearer = inbox API token. Tenant from token. Rate-limit per token.

| Method | Path | Authz | Notes |
|---|---|---|---|
| POST | `/api/public/crm-client/mensagens` | API token | `{ source_id, content, content_type?, contact? }` upsert ContactInbox + message |
| GET | `/api/public/crm-client/conversas/:source_id/mensagens` | API token | list messages for that contact-inbox identity |
| POST | `/api/public/crm-client/conversas/:source_id/mensagens` | API token | alias create |

Interactive `content_type` (`input_select` \| `cards` \| `form`) allowed on widget + API conversations only — else **422**.

#### Ongoing campaign hook (extends C)

`POST /campanhas/:id/enviar` on `ongoing`: if target widget inbox `connection_status=ready_stub`, set `display_status=ready` + `active`; else keep `awaiting_widget`. Widget bootstrap/campanhas read only `active` + `ready`.

### Phase E — enterprise & AI

All under `/api/saas/crm/*` unless noted. Authz: [authz.md](./authz.md). Contracts: [crm-chatwoot-parity.md](./crm-chatwoot-parity.md). **No unpaid live Meta / Slack / IdP / telephony / Captain model** — stubs and `ready_stub` / `connected_stub` only.

#### SLA

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/sla/politicas` | **admin** | CRUD list/create `SlaPolicy` (FRT/NRT/RT seconds, name, active) |
| GET/PATCH/DELETE | `/api/saas/crm/sla/politicas/:id` | **admin** | |
| PUT | `/api/saas/crm/inboxes/:id/sla` | **admin** | `{ sla_policy_id \| null }` default policy for inbox |
| POST | `/api/saas/crm/conversas/:id/sla` | **admin** | `{ sla_policy_id }` apply / replace; upserts `ConversationSla` |
| DELETE | `/api/saas/crm/conversas/:id/sla` | **admin** | remove policy from conversation |
| GET | `/api/saas/crm/conversas/:id/sla` | admin, visible vendedor | timer status (due_ats, breaches, hits) |
| GET | `/api/saas/crm/relatorios/sla` | **admin** or `report_manage` | unlocks C’s 501; same `from`/`to`/`tz` as other reports |

Automation action vocabulary adds: `apply_sla` · `remove_sla` (Phase B runner extended).

#### Capacidade & assignment

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/capacidade` | **admin** | list/upsert `AgentCapacity` rows `{ user_id, max_open_conversations }` |
| PATCH | `/api/saas/crm/inboxes/:id/politica-atribuicao` | **admin** | extend B: `kind` `round_robin` \| `balanced`; `enabled` |

Job: `assignment.balanced` when kind is balanced (see [jobs-realtime.md](./jobs-realtime.md)).

#### Atributos obrigatórios no resolve

| Method | Path | Authz | Notes |
|---|---|---|---|
| PUT | `/api/saas/crm/inboxes/:id/atributos-obrigatorios` | **admin** | `{ keys: string[] }` custom attribute keys required before resolve |

`PATCH /conversas/:id` with `status=resolved` → **422** `validacao` if required keys missing on conversation `custom_attributes_json`.

#### Captain AI

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/captain/assistentes` | **admin** | named assistants (mode, prompt stub, active) |
| GET/PATCH/DELETE | `/api/saas/crm/captain/assistentes/:id` | **admin** | |
| POST | `/api/saas/crm/captain/sugerir` | admin, visible vendedor | `{ conversation_id, mode, assistant_id? }` → `CaptainSuggestion` via stub port |
| GET | `/api/saas/crm/captain/sugestoes` | admin, vendedor | filter `conversation_id`, status |
| POST | `/api/saas/crm/captain/sugestoes/:id/aceitar` | admin, visible vendedor | applies via desk domain services (message/labels/assign) — **not** silent Meta send |
| POST | `/api/saas/crm/captain/sugestoes/:id/descartar` | same | |
| GET | `/api/saas/crm/captain/status` | admin | `{ provider: "stub"\|"live_unlocked", enabled }` |

Default provider **stub**. Live model only if unlock env — tests assert stub + no Meta hosts.

#### Auditoria

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/auditoria` | **admin** or `audit_read` | cursor; filters `actor_user_id`, `action`, `from`, `to`, `aggregate_type` |
| GET | `/api/saas/crm/auditoria/:id` | **admin** or `audit_read` | |

#### Segurança — SAML / MFA

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/PUT | `/api/saas/crm/seguranca/saml` | **admin** | IdP metadata shape; cert sealed; status stub |
| POST | `/api/saas/crm/seguranca/saml/testar` | **admin** | fixture/stub verify — no live IdP required |
| GET | `/api/saas/auth/saml/metadata` | public | SP metadata XML for tenant (?tenant= slug) when SAML configured |
| POST | `/api/saas/auth/saml/acs` | public | ACS stub; live parse behind unlock |
| GET | `/api/saas/crm/seguranca/mfa` | self | enrollment status |
| POST | `/api/saas/crm/seguranca/mfa/iniciar` | self | returns secret **once** + otpauth URI |
| POST | `/api/saas/crm/seguranca/mfa/confirmar` | self | `{ code }` enables MFA |
| POST | `/api/saas/crm/seguranca/mfa/desativar` | self | `{ code }` or admin reset |
| POST | `/api/saas/crm/seguranca/mfa/admin-reset/:userId` | **admin** | disable user’s MFA |
| PUT | `/api/saas/crm/seguranca/politica` | **admin** | `{ mfa_required?, saml_enabled?, jit_provision? }` |
| POST | `/api/saas/login` | worker | extended: if MFA enabled → `{ mfa_required: true, mfa_token }` then `POST /api/saas/login/mfa` |

#### Papéis customizados

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/papeis` | **admin** | `CustomRole` + `permissions_json` |
| GET/PATCH/DELETE | `/api/saas/crm/papeis/:id` | **admin** | |
| PATCH | `/api/saas/usuarios/:id` | **admin** | extend: optional `custom_role_id` (still `saas_role` admin\|vendedor) |

Permission bits: see [authz.md](./authz.md). `report_manage` unlocks reports without full admin.

#### Integrações

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET | `/api/saas/crm/integracoes` | **admin** | catalog + install status per provider |
| GET/PUT | `/api/saas/crm/integracoes/:provider` | **admin** | credentials masked; status ≤ `connected_stub`; reject `live` |
| POST | `/api/saas/crm/integracoes/:provider/desconectar` | **admin** | clear secrets → `not_configured` |
| POST | `/api/saas/crm/integracoes/:provider/testar` | **admin** | stub ping — no unpaid provider HTTP |

Providers: `slack` \| `linear` \| `notion` \| `shopify` \| `stripe` \| `dialogflow` \| `google_translate` \| `dyte`.

#### Apps do painel (dashboard apps)

| Method | Path | Authz | Notes |
|---|---|---|---|
| GET/POST | `/api/saas/crm/apps-painel` | **admin** | `DashboardApp`; URL egress-guarded |
| GET/PATCH/DELETE | `/api/saas/crm/apps-painel/:id` | **admin** | |
| GET | `/api/saas/crm/conversas/:id/apps-painel` | admin, visible vendedor | apps enabled for that inbox |

#### CSAT review notes

| Method | Path | Authz | Notes |
|---|---|---|---|
| PATCH | `/api/saas/crm/csat/:id` | **admin** | `{ review_note }` — extends B CSAT read API |

#### Central de Ajuda — custom domain

| Method | Path | Authz | Notes |
|---|---|---|---|
| PUT | `/api/saas/crm/central-ajuda/portal/dominio` | **admin** | `{ custom_domain \| null }` |
| POST | `/api/saas/crm/central-ajuda/portal/dominio/verificar` | **admin** | enqueue/stub `DnsVerifyPort` |
| GET | `/api/public/central-ajuda/...` | public | also resolve tenant/portal by verified `Host` (E); slug routes remain |

#### Voice channel

| Method | Path | Authz | Notes |
|---|---|---|---|
| POST | `/api/saas/crm/inboxes` | **admin** | `channel_type=voice` allowed |
| GET/PUT | `/api/saas/crm/inboxes/:id/channel` | **admin** | `ChannelVoice` shape; ≤ `ready_stub`; reject `live` |
| POST | `/api/saas/crm/simular` | **admin** | voice inbox → conversation + system note “chamada simulada” |

#### Platform APIs (reserved)

| Method | Path | Authz | Notes |
|---|---|---|---|
| * | `/api/platform/*` | — | **501** `nao_implementado` — Account-era super-admin; not Casa seed acceptance |

Do not invent ad-hoc BFF routes outside this map — extend architecture first.

## SaaS — sales pipeline

| Method | Path | Authz |
|---|---|---|
| GET/POST | `/api/saas/orcamentos` | admin, vendedor |
| GET | `/api/saas/orcamentos/:id` | admin, vendedor |
| POST | `/api/saas/orcamentos/:id/transicao` | matrix |
| GET/POST | `/api/saas/pedidos` | admin, vendedor; POST requires Cliente aprovado |
| GET | `/api/saas/pedidos/:id` | admin, vendedor |
| POST | `/api/saas/pedidos/:id/transicao` | matrix + stock |
| POST | `/api/saas/pedidos/:id/faturar` | creates Venda `rascunho` |
| GET | `/api/saas/vendas` | admin, vendedor |
| GET | `/api/saas/vendas/:id` | admin, vendedor |
| POST | `/api/saas/vendas/:id/transicao` | `faturado` \| `cancelado` from `rascunho` |

`POST .../transicao` body: `{ para: <Status> }`. Side effects only after matrix + stock + cadastro checks succeed in one transaction: history + outbox + movements.

Direct Pedido create: `{ cliente_id, linhas: { sku_id, qty }[] }`.

## SaaS — catalog / stock

| Method | Path | Authz |
|---|---|---|
| GET | `/api/saas/estoque` | admin, vendedor (read) |
| GET | `/api/saas/estoque/:id` | same |
| GET | `/api/saas/estoque/:id/movimentos` | same |
| POST | `/api/saas/estoque` | admin (create SKU + balance) |
| PATCH | `/api/saas/estoque/:id` | admin |
| POST | `/api/saas/estoque/:id/ajuste` | admin |
| PATCH | `/api/saas/estoque/:id/visibilidade` | admin |

Estoque returns `on_hand`, `reserved`, `available` (computed), `visivel_loja`, `preco_atacado_centavos`. No second qty field. No import/AI routes in MVP.

## Session DTO

```ts
{
  user_id: string
  tenant_id: string
  tenant_slug: string
  surface: "loja" | "saas"
  saas_role: "admin" | "vendedor" | null
  is_customer: boolean
  cliente_status?: "aprovado" | "pendente" | null
  cnpj_last4?: string
}
```

No `account_owner`, no `subscription_status` in MVP session.
