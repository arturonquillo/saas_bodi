# Architecture — Chatwoot-parity CRM desk

Contracts for evolving the simulated WhatsApp inbox into a **native Chatwoot-parity desk**. Product inventory and phases: `docs/product/chatwoot-parity.md`. Do not reopen locked product decisions here.

**Rule:** one CRM desk. Do **not** ship a second inbox product alongside `whatsapp_threads`. Phase A migrates that model in place.

Companion docs: [data-model.md](./data-model.md), [api.md](./api.md), [authz.md](./authz.md), [threats.md](./threats.md), [ports.md](./ports.md), [jobs-realtime.md](./jobs-realtime.md), [stack.md](./stack.md), [seed.md](./seed.md).

## Module map (CRM)

| Module | Responsibility | Phase |
|---|---|---|
| **Inbox + Channel** | Polymorphic channel config; default WhatsApp inbox per tenant | A |
| **Conversation** | Evolves `WhatsappThread`; statuses, assignee, team, priority, mute/snooze | A |
| **Message** | Evolves `WhatsappMessage`; private notes, attachments metadata, delivery stub | A |
| **Contact + ContactInbox** | CRM person graph; WA `source_id`; links commerce | A |
| **Company** | CNPJ org; shared with cadastro/`Cliente` | A |
| **Label** | System intent labels + custom; conversation/contact tagging | A |
| **Team / InboxMember** | Team membership; inbox agent membership | A |
| **CannedResponse** | `/shortcode` + `{{vars}}` | A |
| **AgentNotification** | In-app prefs + rows; email via outbox stub | A |
| **AgentPresence** | Availability + collision viewing (SSE) | A |
| **DomainEvent + Job** | Event bus skeleton; workers for B+ | A skeleton / B execute |
| **Automation / Macro / Bot / Webhook** | Rules, action sequences, outbound hooks | B |
| **CustomAttribute / Filter / CSAT / Hours / AssignmentPolicy** | Operator power | B |
| **Campaign / HelpCenter / Reports** | Growth & insight | C |
| **Non-WA channels + Loja widget** | Omnichannel expand | D |
| **Captain / SLA / SAML / Audit / Integrations** | Enterprise | E |

Commerce modules (Cadastro, Cliente, Orçamento, Pedido, Venda, Stock, Theme) stay authoritative. CRM **links** to them; it does not replace status machines or the stock ledger.

## Locked decisions (five product blockers)

### 1. Contact vs Cliente identity

**Decision: Contact + Company + link to `Cliente` — not a single merged table.**

| Entity | Owns | Does not own |
|---|---|---|
| **Contact** | CRM person: nome, emails, phones, notes, labels, conversations | Commerce gate, CNPJ uniqueness for Pedido |
| **Company** | CNPJ org (`cnpj_digits` unique per tenant), razao_social, linked Contacts | Pedido eligibility |
| **Cliente** | Approved commerce buyer projection; cadastro gate for Pedido/Venda | Inbox routing, labels, agent notes |

**Links (Phase A):**

- `Contact.cliente_id?` — set when cadastro is `aprovado` (or seed Cliente).
- `Contact.company_id?` — set when Contact is tied to a CNPJ org.
- `Cliente.company_id?` + `Cliente.primary_contact_id?` — back-links; `Cliente` remains the **only** gate for Pedido create / Orçamento→Pedido / Venda.
- `CadastroRequest.contact_id?` — created/linked on cadastro submit or WA intent; on approve: upsert Company by CNPJ, upsert/link Contact, create Cliente, set FKs.

**Why not merge:** prospects and info-only WA chats need Contact without Cliente; Pedido authz must stay a thin commerce check on `Cliente.status = aprovado`. Merging would force every phone into the sales gate or duplicate gate logic.

**Migration:** seed threads → Contact by `phone_e164` + Conversation; existing `cliente_id` / `cadastro_request_id` / `orcamento_id` become Conversation commerce links **and** Contact FKs where present.

### 2. Realtime transport

**Decision: SSE (Server-Sent Events) for Phase A** — see [jobs-realtime.md](./jobs-realtime.md).

- Stream: `GET /api/saas/crm/events/stream` (auth cookie; tenant-scoped).
- Presence / typing / “viewing”: short `POST` heartbeats; server fans out via SSE.
- Fallback: client poll `GET /api/saas/crm/conversas?updated_since=` every 15s if SSE drops.
- **Not** WebSocket in Phase A (Next.js route-handler + single-process demo; avoid sticky upgrade complexity). Revisit only if Phase D widget needs bidirectional media signaling.

### 3. Automation / bot webhook host + SSRF

**Decision: queued jobs + strict egress policy** — full execution in Phase B; Phase A ships `domain_events` + `background_jobs` tables and a tick worker so B does not redesign transport.

| Concern | Rule |
|---|---|
| Execution | Never run automation/bot/webhook HTTP on the request thread; enqueue `background_jobs` |
| Worker | In-process interval tick in the Next Node server (MVP); same interface later swaps to external worker |
| Bot / account webhook URL | `https` only; DNS resolve; **block** loopback, link-local, private RFC1918, metadata IPs; no HTTP redirects to blocked ranges; 3s connect / 10s total timeout; response body capped |
| Secrets | Outbound webhooks sign with tenant webhook secret (HMAC); never echo bot URLs with credentials in logs |

SSRF policy interface: `UrlEgressGuardPort` in [ports.md](./ports.md).

### 4. WhatsApp credential encryption

**Decision: application-level AES-256-GCM** for secret slots in channel `provider_config`.

| Item | Rule |
|---|---|
| Key | Env `CREDENTIALS_ENCRYPTION_KEY` — 32-byte key, base64-encoded (required in any shared host; dev may use `.env.example` placeholder) |
| Stored shape | `{ alg: "aes-256-gcm", iv, tag, ciphertext }` JSON in DB column; non-secret fields (`phone_number_id`, `business_account_id`, display phone) may stay plaintext beside ciphertext blob **or** inside an envelope with `secrets` encrypted sub-object — prefer **envelope**: plaintext metadata columns + `secrets_ciphertext` |
| API GET | Never return raw secrets; return `secrets_present: true` + masked placeholders |
| API PUT | Accept new plaintext secrets **or** omit / send `"__unchanged__"` to keep existing |
| Logs | Never log provider_config, tokens, verify tokens |

Connection status enum (product): `not_configured` \| `credentials_saved` \| `ready_stub` \| `live`. API **rejects** transitions to `live` until product unlocks Meta (`501` / domain guard). Phase A max reachable: `ready_stub`.

### 5. Campaign → outbox typing (Phase C contract)

**Decision: yes — campaigns enqueue `notification_outbox` with explicit typing; no Meta template submission UI beyond stub cache.**

Add to outbox (migration before Phase C; may land empty in A):

| Column | Values |
|---|---|
| `category` | `commerce` (default, existing rows) \| `campaign` \| `crm_agent` \| `csat` \| `agent_email` |
| `campaign_id` | fk? nullable |

- WA one-off campaigns use stub `message_templates` cache on the channel; `template_key` like `campaign.wa_one_off`.
- `StubOutboxTransport` still marks `enviado` without Meta/SMTP.
- Do **not** reuse commerce template keys for campaign blasts; do **not** merge campaign rows into cadastro/pedido notification UX without a category filter.

## Phase A — implementable next

### In scope

1. Migrate `WhatsappThread`/`WhatsappMessage` → `Conversation`/`Message` (keep compat views or rename tables in one migration).
2. Default WhatsApp `Inbox` + `ChannelWhatsapp` (stub I/O) per tenant; credential slots encrypted.
3. Contact, ContactInbox, Company; cadastro approve links Contact↔Cliente↔Company.
4. Labels (seed system intents), Teams, InboxMembers, CannedResponses.
5. Conversation desk APIs: list/filter, status/priority/assign/team, private notes, attachments metadata, mute/snooze, bulk actions, drafts, collision presence.
6. Agent notifications + prefs; agent availability.
7. Simulate inbound port rewritten onto Conversation; commerce outbox unchanged.
8. SSE realtime + domain_events append on conversation/message writes.
9. Deprecate `/api/saas/inbox*` in favor of `/api/saas/crm/*` (temporary redirect or dual-read during one release OK; remove dual-write after seed migration).

### Out of Phase A (contracted, not blocking)

| Phase | Enough contract |
|---|---|
| **B** | Full contracts below — implement when Phase B starts |
| **C** | Full contracts in “Phase C — growth & insight” — Campaign + Portal/Article + reports; outbox `category=campaign` |
| **D** | Channel polymorphism rows (`channel_type`); Loja widget client API |
| **E** | SlaPolicy, Captain ports, SAML, audit_events, custom roles |

### Migration plan (threads → desk)

1. Create CRM tables; seed default WA inbox + system labels (`intent:cadastro`, `intent:orcamento`, `intent:info_empresa`, `intent:outro`).
2. For each `WhatsappThread`: upsert Contact by `(tenant_id, phone_e164)`; create ContactInbox `source_id = phone_e164`; create Conversation on default inbox; map `aberta`→`open`, `arquivada`→`resolved`; copy commerce FKs; attach intent label when intent set.
3. Copy messages: `inbound`→`incoming`, `outbound_note`→`outgoing` + `private=true` for notes (MVP notes were `outbound_note`; treat as private note if product used them as agent-only — **lock:** historical `outbound_note` → Message `message_type=outgoing`, `private=true`).
4. Point CadastroRequest.thread_id → conversation_id (rename column).
5. Drop intent enum column after backfill; keep read fallback one release if needed.
6. Update seed + acceptance to Conversation APIs.

## Phase B — operator power (contracts)

Product Phase B: automations, macros, custom attributes, CSAT, agent bots, business hours, assignment policies, custom filters, contact merge/CSV, mentions, agent signature. **No live Meta.** Webhook/bot HTTP uses Phase A `UrlEgressGuardPort` + queued jobs.

Companion detail: [data-model.md](./data-model.md) (entities), [api.md](./api.md) (HTTP map), [jobs-realtime.md](./jobs-realtime.md) (execution), [authz.md](./authz.md), [threats.md](./threats.md), [ports.md](./ports.md).

### In scope

1. **AutomationRule** — event → conditions → actions; admin CRUD; execute via `automation.run` jobs.
2. **Macro** — public/private action sequences; execute on conversation(s); public create = admin.
3. **CustomAttributeDefinition** + values on Contact/Conversation; seed commerce-shaped attrs.
4. **CSAT** — per-inbox toggle; survey on resolve; public token page; `csat.deliver` via stub outbox; responses CRUD/read for admin.
5. **AgentBot** + **AgentBotInbox** — webhook URL (SSRF-guarded); pending handoff; `bot.deliver` jobs.
6. **WorkingHour** per inbox + timezone; OOOH message already on Inbox; greeting/OOOH apply on simulate/inbound path.
7. **Webhook** (account + inbox scoped) — subscriptions; `webhook.deliver` + HMAC; SSRF guard.
8. **AssignmentPolicy** — round-robin OSS parity on inbox when `allow_auto_assign`.
9. **CustomFilter** (saved folders) for conversations + contacts.
10. **Contact merge** + **CSV import** job; **mentions** in messages/notes; agent **signature** on profile (Phase A column may already exist).

### Out of Phase B

| Deferred | Why |
|---|---|
| Campaigns / Help Center / Reports | Phase C — full contracts below |
| Non-WA channels / Loja widget | Phase D |
| Captain, SLA, balanced capacity, SAML, audit, custom roles, required attributes on resolve | Phase E |
| Live Meta / paid bot AI host | Product stub policy |
| Integrations marketplace (Slack, …) | Phase E — B ships **webhook hooks framework** only |

### Locked decisions (Phase B)

| Topic | Decision |
|---|---|
| Automation host | Always `background_jobs` after commit; never inline HTTP on the request path |
| Condition evaluation | Synchronous in worker against frozen event payload + reloaded aggregate; fail-closed on unknown operators |
| Action side effects | Same domain services as desk APIs (assign, label, status, message); webhook/bot actions enqueue nested jobs |
| Macro visibility | `public` = tenant-wide, **admin** CRUD; `private` = `owner_user_id`, owner CRUD; both roles **execute** public + own private |
| Custom attribute storage | Definitions table + `custom_attributes_json` jsonb/object on Contact and Conversation (keys = definition `attribute_key`) |
| CSAT delivery | On `conversation.status_changed` → `resolved` when inbox.`csat_enabled`; enqueue `csat.deliver` → outbox `category=csat` (stub channel); public `GET/POST /api/public/csat/:token` |
| Bot handoff | Conversation starts/stays `pending` while bot-owned; agent reply or action `handoff` → `open` + clear bot lock |
| Business hours TZ | Inbox `timezone` IANA string (seed `America/Sao_Paulo`); WorkingHour rows per `day_of_week` 0–6 |
| Webhook auth | HMAC-SHA256 of raw body with tenant `webhook_signing_secret` (generated once; rotate admin-only); header `X-Cdf-Signature` |
| SSRF | Unchanged from Phase A sketch — https, DNS, deny private/metadata, redirect re-check ([jobs-realtime.md](./jobs-realtime.md)) |
| Assignment | Round-robin among **online** inbox members only; skip `busy`/`offline`; no capacity weights until E |
| Mentions | `@[user_id:…]` marker in message content → `AgentNotification` type `mention`; no separate ACL |
| CSV import | Admin+vendedor; job `contact.import_csv`; max 5k rows/file; dry-run preview endpoint |

### Automation vocabulary (parity subset for B)

**Events** (`event_name`):

`conversation_created` · `conversation_updated` · `conversation_status_changed` · `conversation_resolved` · `message_created` · `contact_created` · `contact_updated`

Map from `domain_events.type` (dotted) → automation event (underscore) in the worker.

**Condition operators:** `equal` · `not_equal` · `contains` · `does_not_contain` · `is_present` · `is_not_present` · `is_greater_than` · `is_less_than`.

**Condition attributes (B):** `status`, `priority`, `inbox_id`, `team_id`, `assignee_id`, `message_type`, `content`, `contact_email`, `contact_phone`, `label_ids`, `custom_attribute.<key>`.

**Actions (B):** `assign_agent` · `assign_team` · `add_label` · `remove_label` · `mute` · `snooze` · `resolve` · `change_status` · `change_priority` · `send_message` · `send_attachment_message` (metadata-only until D) · `send_webhook` · `add_private_note` · `set_custom_attribute`.

Conditions are AND within a rule; ordered actions; stop rule on first action hard-failure (log + continue other rules). Max 20 active rules per tenant (MVP guard).

### Job kinds enabled in B

| Kind | Trigger |
|---|---|
| `automation.run` | Matching domain event |
| `webhook.deliver` | Automation action, account/inbox webhook subscription, or manual test |
| `bot.deliver` | Incoming message on bot-linked inbox while conversation bot-pending |
| `csat.deliver` | Resolve + inbox CSAT on |
| `contact.import_csv` | Admin/vendedor import |
| `assignment.round_robin` | New conversation / unassign when policy enabled |
| `notification.email_stub` | Mentions + prefs (A) |

### Domain events added in B

`automation.executed` · `macro.executed` · `csat.requested` · `csat.submitted` · `bot.messaged` · `bot.handed_off` · `webhook.delivered` · `webhook.failed` · `contact.merged` · `contact.imported` · `mention.created`

### Phase B acceptance (architecture)

1. Admin can CRUD automation/macro/attribute/bot/webhook/hours/assignment policy; vendedor executes macros + reads attributes/filters; no Meta HTTP.
2. Resolve with CSAT on → outbox `category=csat` + public token submit creates `CsatResponse`.
3. Bot URL and webhook URL rejected by egress guard in tests (SSRF fixtures).
4. Round-robin assigns only among online inbox members when policy active.
5. Cadastro/pipeline/commerce outbox regressions unchanged; Contact merge preserves Cliente link on surviving contact.

### Handoff (Phase B)

| Specialist | Task |
|---|---|
| **design** | Configurações CRM: Automações, Macros, Atributos, Bots, Webhooks, Horários, CSAT; macro picker on conversa; attribute sidebar |
| **backend** | Prisma Phase B tables; job consumers; SSRF enforcement on deliver; public CSAT routes; CSV job |
| **frontend** | Admin config screens + desk affordances against `/api/saas/crm/*` Phase B map |
| **qa** | Phase B checklist; SSRF deny; no Meta; merge/import; CSAT stub path; RBAC admin vs vendedor |

## Phase C — growth & insight (contracts)

Product Phase C: **Campanhas**, **Central de Ajuda**, **Relatórios** (incl. CSAT aggregates). **No live Meta.** Campaign channel I/O = stub outbox only. Website **ongoing** campaigns are authorable in C but **display/send depends on Loja widget (Phase D)** — see locked decisions. Help Center custom domain = Phase E. SLA reports = Phase E. CSAT **review notes** = Phase E.

Companion detail: [data-model.md](./data-model.md), [api.md](./api.md), [jobs-realtime.md](./jobs-realtime.md), [authz.md](./authz.md), [threats.md](./threats.md), [ports.md](./ports.md), [seed.md](./seed.md).

### In scope

1. **Campaign** — `one_off` (WhatsApp template → audience by contact labels; SMS-shaped stub optional) + `ongoing` (website config CRUD; no live display until D).
2. **Campaign send** — `campaign.send_batch` job → `notification_outbox` rows with `category=campaign`, `campaign_id`, stub `template_key`; `StubOutboxTransport` marks `enviado`; **zero** Meta/Graph/SMS provider HTTP.
3. **Help Center** — `Portal` (one active per tenant, pt-BR), `Category`, `Article` (draft/published/archived); SaaS authoring admin; public read for published.
4. **Reports** — admin read models: overview, conversations, agents, labels, inbox, team, CSAT, bot; date-range + filters; live SQL aggregates (+ optional snapshot cache).
5. Outbox `category` / `campaign_id` already contracted in Phase A blocker #5 — enforce in writers and commerce avisos filter.

### Out of Phase C

| Deferred | Why |
|---|---|
| Live Meta template sync / Graph send | Product stub policy |
| Website widget runtime for ongoing campaigns | Phase D |
| Help Center custom domain / multi-locale portal | Phase E (product) |
| SLA report series | Phase E with SlaPolicy |
| CSAT review notes UI/API | Phase E (product: notes can trail) |
| Agent self-only metrics default | Product: admin default; optional later |
| Non-WA live channels | Phase D |

### Locked decisions (Phase C)

| Topic | Decision |
|---|---|
| Campaign kinds | `one_off` \| `ongoing`. Phase C **executes** only `one_off` via stub outbox. `ongoing` is persisted + editable; `display_status=awaiting_widget` until Phase D widget; activating ongoing does **not** call external HTTP |
| One-off channel | Default `whatsapp` on an existing WA inbox. Optional `sms` kind stores the same shape and writes outbox `channel=sms` stub — still `StubOutboxTransport`, no Twilio |
| Audience | `audience_label_ids: string[]` — contacts that have **any** of those labels (OR). Empty labels → **422**. Cap 5k recipients per campaign (MVP); larger → reject with `validacao` |
| Template | Must reference a key present in inbox channel `message_templates_json` stub cache (or campaign inline `message` for ongoing website copy). **No** Meta template submission / sync UI |
| Campaign status | `draft` → `scheduled` \| `active` → `completed` \| `cancelled`. One-off: `POST .../enviar` or schedule → enqueue job; completion when batch finishes. Cannot edit audience after `active`/`completed` |
| Outbox typing | Every campaign blast row: `category=campaign`, `campaign_id` set, `template_key` prefixed `campaign.` (e.g. `campaign.wa_one_off`). Commerce avisos list **excludes** non-`commerce` |
| Help Center locale | **pt-BR only** in C. Portal `slug` unique per tenant; public URLs use slug |
| Portal count | One **enabled** portal per tenant in C (`Portal.enabled`); soft-disable only — no multi-portal until E |
| Article status | `draft` \| `published` \| `archived`. Public API returns **published** only. Publish/unpublish = **admin** |
| Article content | Markdown source + rendered HTML stored or render-on-read; sanitize HTML on write (XSS). No arbitrary script embeds |
| Public HC surface | `GET /api/public/central-ajuda/:portalSlug…` (tenant resolved by portal slug → tenant_id). Optional Loja pages consume same API — not Account |
| Reports authz | **admin only** for all `/relatorios/*`. Vendedor → **403** |
| Reports data source | Live aggregates from Conversation / Message / CsatResponse / AgentBot activity / Label joins; optional `report_snapshots` for expensive ranges. Prefer queries over a second event warehouse |
| Report timezone | Tenant/inbox default `America/Sao_Paulo`; request may pass `tz` IANA |
| Metrics window | Required `from` + `to` ISO (inclusive day bounds in `tz`); max range **90 days** per request |
| Bot reports | Counts from `domain_events` types `bot.messaged` / `bot.handed_off` + conversations that were bot-pending — no external bot analytics |
| SLA series | Routes may return **501** `nao_implementado` or omit until E — do **not** invent fake SLA numbers |
| No Meta | Campaign send adapters forbidden from calling Graph; tests assert no Meta host egress |

### Campaign send flow (one_off)

```
Admin POST /campanhas/:id/enviar (or scheduler tick for scheduled_at)
  → validate draft|scheduled, audience non-empty, template exists on inbox channel
  → status=active; enqueue background_jobs kind=campaign.send_batch
Worker:
  → resolve Contact ids by labels (tenant-scoped)
  → for each contact (batched): insert notification_outbox
       category=campaign, campaign_id, channel=whatsapp|sms,
       template_key=campaign.*, payload redacted (no full CNPJ)
  → StubOutboxTransport.markEnviado
  → CampaignRecipient rows (optional) status enviado|falha
  → when batch done: campaign.status=completed; emit campaign.completed
```

Idempotency: unique `(campaign_id, contact_id)` on recipients; retries skip already-sent.

### Report series (C)

| Series | Path suffix | Primary measures |
|---|---|---|
| Overview | `/relatorios/visao-geral` | open/pending/resolved counts, new conversations, messages in/out, avg first-response (agent), CSAT avg |
| Conversations | `/relatorios/conversas` | volume by status/day, resolutions, reopen count |
| Agents | `/relatorios/agentes` | assigned, resolved, messages sent, avg response (assignee_user_id) |
| Labels | `/relatorios/labels` | conversations tagged, resolutions per label |
| Inbox | `/relatorios/inboxes` | per-inbox volume + resolution |
| Team | `/relatorios/equipes` | per-team volume + resolution |
| CSAT | `/relatorios/csat` | rating distribution, avg, count; filter inbox |
| Bot | `/relatorios/bots` | bot messages, handoffs, conversations touched |

All accept `from`, `to`, optional `inbox_id` / `team_id` where applicable. Response shape: `{ series, totals, generated_at }` — exact DTO in `packages/shared` when backend lands.

### Domain events added in C

`campaign.created` · `campaign.updated` · `campaign.started` · `campaign.completed` · `campaign.cancelled` · `portal.updated` · `article.published` · `article.unpublished`

Reports **read** existing A/B events; they do not require a separate projection consumer in C (live SQL OK). Optional later: materialize daily rollups via `report.rollup_daily` job.

### Job kinds enabled in C

| Kind | Trigger |
|---|---|
| `campaign.send_batch` | Admin send / schedule due |
| `report.rollup_daily` | Optional nightly; not required for acceptance if live queries meet p95 |

### Phase C acceptance (architecture)

1. Admin CRUD campaigns; one-off send creates outbox rows `category=campaign` + `campaign_id`; StubOutbox marks enviado; **no** Meta HTTP in tests.
2. Ongoing campaign can be saved/activated without widget; no external display calls; documented `awaiting_widget`.
3. Admin publishes Help Center article; public GET by portal slug returns published only; draft 404 for public.
4. Admin report endpoints return aggregates for seed date range; vendedor gets 403; SLA endpoint absent or 501.
5. Commerce outbox/avisos UI still filters `commerce` only; cadastro/pipeline unchanged.

### Handoff (Phase C)

| Specialist | Task |
|---|---|
| **design** | SaaS nav: Campanhas, Relatórios, Central de Ajuda (admin); public HC portal pt-BR; empty/stub send states (“envio simulado”) |
| **backend** | Prisma Campaign/Portal/Category/Article (+ recipient); `campaign.send_batch`; public HC routes; report queries |
| **frontend** | Admin screens + public HC pages against Phase C map; no parallel kit |
| **qa** | Phase C checklist; no Meta; outbox category isolation; HC public vs draft; reports RBAC |

## Channel polymorphism

```
Inbox
  id, tenant_id, name, channel_type, greeting?, ooo_message?,
  csat_enabled, lock_to_single_conversation, allow_auto_assign, …

ChannelWhatsapp (1:1 inbox when channel_type=whatsapp)
  inbox_id, provider, phone_e164_display,
  phone_number_id?, business_account_id?,
  secrets_ciphertext, connection_status, message_templates_json

-- Phase D+: ChannelEmail, ChannelApi, ChannelWidget, …
```

Domain talks to `ChannelSendPort` / `ChannelSimulateInboundPort`. WA adapters are stubs until Meta unlock.

## Permission summary

See [authz.md](./authz.md). Map: Chatwoot Administrator → `admin`; Agent → `vendedor`. No custom roles until Phase E.

**Inbox visibility (Phase A lock):**

- `admin`: all conversations in tenant inboxes.
- `vendedor`: conversations where user is inbox member **and** (assignee = self **or** unassigned **or** team membership matches conversation.team_id). Settings flag `vendedor_see_all_inbox` defaults **false**.

## Event names (domain_events)

Phase A emits at least:

`conversation.created` | `conversation.updated` | `conversation.status_changed` | `conversation.assigned` | `message.created` | `contact.updated` | `agent.viewing` | `agent.typing`

Phase B+ consumers: automations, webhooks, bots, reports projections.

## Handoff

| Specialist | Task |
|---|---|
| **design** | Phase A desk IA + Phase B config + Phase C Campanhas / Relatórios / Central de Ajuda |
| **backend** | Phase A→C tables + job consumers per this doc |
| **frontend** | `/api/saas/crm/*` Phase A→C; public HC; no parallel CSS kit |
| **qa** | Per-phase acceptance; no Meta HTTP; SSRF; campaign outbox isolation; cadastro/pipeline regression; tenant isolation |

## What must not happen

- Second inbox product or parallel `whatsapp_threads` write path after migration.
- Live Meta Graph / webhook verification / campaign template sync from Meta.
- Merging Account billing into CRM nav.
- Second stock ledger.
- Trusting client for role, prices, stock, or `tenant_id`.
- Returning WA secrets on GET.
- Inline SSRF-prone HTTP from automation/bot/webhook on the request path.
- Executing automation webhook actions without `UrlEgressGuardPort`.
- CSAT, bot, or **campaign** delivery calling Meta/SMTP — stub outbox / stub channel only.
- Mixing `category=campaign` rows into commerce avisos without an explicit filter.
- Publishing Help Center drafts on public routes.
- Inventing SLA report numbers before Phase E policies exist.
