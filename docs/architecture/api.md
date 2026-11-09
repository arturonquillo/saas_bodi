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

### Phase C–E API (names reserved)

| Phase | Prefix / resources |
|---|---|
| **C** | `/campanhas`, `/central-ajuda/*`, `/relatorios/*` |
| **D** | channel types beyond WA; `/api/loja/widget/*` client messaging |
| **E** | `/sla`, `/auditoria`, `/integracoes`, Captain |

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
