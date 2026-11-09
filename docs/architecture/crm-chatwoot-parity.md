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
| **Non-WA channels + Loja widget** | Omnichannel expand (stub providers + first-party widget) | D |
| **Captain / SLA / Capacity / Audit / SAML·MFA / Integrations** | Enterprise & AI (full contracts below) | E |

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
| **D** | Full contracts in “Phase D — omnichannel expand” — non-WA channel stubs + Loja widget + client API |
| **E** | Full contracts in “Phase E — enterprise & AI” — SLA, capacity, Captain stubs, audit, SAML/MFA, custom roles, integrations, voice stub, HC custom domain |

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
| Captain, SLA, balanced capacity, SAML, audit, custom roles, required attributes on resolve | Phase E — full contracts below |
| Live Meta / paid bot AI host | Product stub policy (Captain = stub port in E) |
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

## Phase D — omnichannel expand (contracts)

Product Phase D: **non-WhatsApp channels** (mostly stub providers) + **Loja website live-chat widget** + client messaging API + pre-chat forms + interactive messages (widget/API) + browser push + branded email templates (stub). **No live Meta / Instagram / Facebook / Twilio / IMAP/SMTP providers.** Channel credential UIs reach **`ready_stub` only** (same lock as WA). The Loja widget is **first-party** and wires into the existing Conversation desk — not a second inbox product.

Companion detail: [data-model.md](./data-model.md), [api.md](./api.md), [jobs-realtime.md](./jobs-realtime.md), [authz.md](./authz.md), [threats.md](./threats.md), [ports.md](./ports.md), [seed.md](./seed.md).

### In scope

1. **Channel polymorphism** — `Inbox.channel_type` expanded; 1:1 channel config tables per type; SaaS inbox create/list/update for all D types; simulate inbound where it makes sense; send via stub adapters except first-party widget/API delivery into Conversation.
2. **ChannelWebsiteWidget** — website token + HMAC secret; pre-chat form schema; greeting/OOOH reuse Inbox fields; embeddable Loja widget that creates/continues CRM Conversations on that inbox.
3. **Channel stubs (config + simulate only)** — `email`, `facebook`, `instagram`, `tiktok`, `twitter`, `telegram`, `line`, `sms`, `api` — credential shapes + encryption + `connection_status ≤ ready_stub`; **zero** provider HTTP.
4. **Client / widget messaging API** — public Loja widget session + message routes; API-channel inbox token for custom clients (in-process).
5. **Interactive messages** — `content_type` cards / input_select / form for `web_widget` + `api` only.
6. **Ongoing campaigns** — widget runtime fetches active `ongoing` campaigns; flip `display_status` to `ready` when widget inbox can display; no external blast.
7. **Browser push (agent)** — optional PushSubscription + VAPID; delivery may stub-fail closed without breaking desk.
8. **Email branded templates** — stub layout keys for email-channel replies via outbox `category=crm_agent` / channel stub — still no SMTP.

### Out of Phase D

| Deferred | Why |
|---|---|
| Live Meta / FB / IG / TikTok / X / Telegram / LINE / Twilio / IMAP-SMTP | Product stub policy — configs only |
| Voice / WhatsApp calling | Phase E — stub channel only |
| WebSocket media signaling | Text chat does not need WS; keep SSE + poll |
| Captain, SLA, SAML, audit, custom roles, integrations marketplace | Phase E — full contracts below |
| Help Center custom domain | Phase E — full contracts below |
| Replacing commerce WhatsApp CTA with widget-only | CTA stays; widget is additive |

### Locked decisions (Phase D)

| Topic | Decision |
|---|---|
| Channel types (D) | `whatsapp` \| `web_widget` \| `email` \| `facebook` \| `instagram` \| `tiktok` \| `twitter` \| `telegram` \| `line` \| `sms` \| `api` |
| Connection status | Same enum as WA: `not_configured` \| `credentials_saved` \| `ready_stub` \| `live`. API **rejects** `live` for **all** channel types in D (`501` / domain guard). Max reachable: **`ready_stub`** |
| Provider HTTP | Forbidden for Meta Graph, Facebook, Instagram, TikTok, X, Telegram Bot API, LINE, Twilio/Bandwidth, IMAP/SMTP, Google/Microsoft mail APIs. Tests assert no egress to those hosts from channel adapters |
| Widget vs stub | `web_widget` is **first-party**: messages persist to Conversation/Message via Casa APIs. Naming stays `ready_stub` (no external provider “live”). Do **not** call this Meta-live |
| Widget tenancy | Resolve tenant from **website_token → ChannelWebsiteWidget → Inbox → tenant_id**. Never trust client-supplied `tenant_id` |
| Widget identity | `WidgetSession` (opaque id + HMAC-signed cookie/header). Pre-chat fields upsert Contact; `ContactInbox.source_id = widget:{session_id}` (or email/phone when provided and unique per inbox) |
| One conversation | Respect inbox `lock_to_single_conversation`: reopen latest non-resolved or create new per Chatwoot-shaped lock; default seed: lock on |
| Realtime (widget) | Public `GET /api/loja/widget/mensagens?after=` poll (primary) + optional SSE `GET /api/loja/widget/events/stream` scoped by widget session. **No WebSocket** in D. SaaS desk keeps Phase A SSE |
| API channel | Inbox-scoped `api_access_token` (hashed at rest; plaintext once on create/rotate). Client APIs under `/api/public/crm-client/*` with `Authorization: Bearer`. In-process only — still max `ready_stub` |
| Email channel | Config fields for IMAP/SMTP or Google/Microsoft OAuth **shapes**; secrets encrypted; simulate inbound creates Conversation; outbound → stub send + optional outbox row — **no** real mail |
| Social / SMS channels | Credential field envelopes only + simulate inbound admin tool; StubChannelSendPort on agent reply |
| Pre-chat | `pre_chat_fields_json` on ChannelWebsiteWidget: ordered fields `{ name, type, required, label_pt }`; conversation create blocked until required satisfied (**422**) |
| Interactive content | Message `content_type`: add `input_select` \| `cards` \| `form`; allowed only when inbox `channel_type` ∈ (`web_widget`,`api`). WA/email/social ignore or **422** |
| Ongoing campaigns | Active `ongoing` with matching widget `inbox_id` (or tenant default widget inbox): widget bootstrap returns campaign payload; set `display_status=ready` when first served (or on activate if widget inbox already `ready_stub`). Still **no** Meta/SMS |
| Browser push | Agent opt-in `PushSubscription`; VAPID keys from env; `push.notify` job may no-op if keys missing. Never block message write on push failure |
| Email templates | `EmailTemplate` stub rows (pt-BR layout) referenced by email-channel replies; render → outbox/stub only |
| Secrets | Reuse `ChannelCredentialsVaultPort` / AES-256-GCM; GET masked; widget HMAC secret + API tokens never in SSE/public bootstrap beyond what the session needs (website_token is public embed id; **hmac secret is not**) |
| Authz | Channel / widget / API-token / email-template CRUD = **admin**; vendedor reads inbox list + membership; widget public routes unauthenticated but token-bound |

### Channel config shapes (ready_stub)

| `channel_type` | Config table | Notable fields (non-secret / secret) |
|---|---|---|
| `whatsapp` | ChannelWhatsapp (A) | unchanged; still ≤ `ready_stub` |
| `web_widget` | ChannelWebsiteWidget | `website_token` (public), `hmac_secret` (sealed), `allowed_origins[]`, `pre_chat_fields_json`, `widget_color?`, `welcome_title?`, ` continuity` |
| `email` | ChannelEmail | `provider` `smtp_imap`\|`google`\|`microsoft`; `forward_to_email?`; sealed IMAP/SMTP/OAuth secrets |
| `facebook` | ChannelSocial | `provider=facebook`; page id metadata; sealed page token |
| `instagram` | ChannelSocial | `provider=instagram` |
| `tiktok` | ChannelSocial | `provider=tiktok` |
| `twitter` | ChannelSocial | `provider=twitter` |
| `telegram` | ChannelSocial | `provider=telegram`; bot username metadata; sealed bot token |
| `line` | ChannelSocial | `provider=line` |
| `sms` | ChannelSms | `provider` `twilio`\|`bandwidth`; from-number display; sealed account secrets |
| `api` | ChannelApi | `api_access_token_hash`; `token_prefix` / last4; webhook callback URL optional (SSRF-guarded if set, deliver still stub/queued) |

Shared: `connection_status`, `secrets_ciphertext?`, `updated_at`. Social may share one `channel_social` table discriminated by `provider`.

### Widget → Conversation flow

```
Loja embed loads script with website_token
  → GET /api/loja/widget/bootstrap?website_token=…
      (tenant+inbox from token; greeting; pre_chat schema; active ongoing campaigns)
  → POST /api/loja/widget/sessao  (creates WidgetSession; Set-Cookie / returns session_token)
  → POST /api/loja/widget/pre-chat  (upsert Contact + ContactInbox; validate required fields)
  → POST /api/loja/widget/mensagens  (ensure Conversation on widget inbox; Message incoming;
        emit domain_events; automations/bots as today; fan-out SaaS SSE)
Agent reply on SaaS desk (same Conversation)
  → StubChannelSendPort for widget = mark delivery_status=sent + fan-out widget poll/SSE
  → visitor sees via GET .../mensagens?after= or widget SSE
```

Cadastro / Orçamento deep-links unchanged: widget Contact may later link Cliente; commerce gates stay on Cliente.

### Domain events added in D

`channel.updated` · `widget.session_started` · `widget.message_created` · `campaign.displayed` · `push.subscribed` · `push.failed`

### Job kinds enabled in D

| Kind | Trigger |
|---|---|
| `push.notify` | Agent notification types opted into browser push |
| `email.channel_stub_deliver` | Optional: email-channel outgoing → outbox row then StubOutboxTransport |
| `channel.simulate_social_ingest` | Admin simulate for non-WA channels (may run inline in request for MVP; job optional) |

No provider webhook receiver jobs (no Meta signature verify endpoints that call Graph).

### Phase D acceptance (architecture)

1. Admin creates inboxes for each D `channel_type`; credential save reaches **`ready_stub`**; transition to `live` rejected; **no** provider HTTP in tests.
2. Loja widget bootstrap + session + pre-chat + messages create Conversations/Messages on the `web_widget` inbox; agent sees them in SaaS Conversas; agent reply visible to widget poll/SSE.
3. Ongoing campaign active for that inbox returns in widget bootstrap; `display_status` becomes `ready`; no external campaign HTTP.
4. API channel Bearer token can create message on its inbox (tenant-scoped); invalid token → 401.
5. Interactive `content_type` accepted on widget/API conversations; rejected on WA inbox.
6. Cadastro/pipeline/commerce outbox unchanged; WA still ≤ `ready_stub`; Meta hosts absent from egress allow-list.

### Handoff (Phase D)

| Specialist | Task |
|---|---|
| **design** | SaaS canal config per type (“Pronto para conectar”); Loja widget UI + pre-chat; ongoing campaign surface in widget |
| **backend** | Channel_* tables; widget + client APIs; stub adapters; campaign display_status; push optional |
| **frontend** | Canal settings + Loja widget embed against Phase D map; no parallel kit |
| **qa** | Phase D checklist; no Meta/social/SMS/SMTP HTTP; widget tenancy; ready_stub ceiling; desk↔widget thread continuity |

## Phase E — enterprise & AI (contracts)

Product Phase E: **Captain AI stubs**, **SLA** (FRT/NRT/RT + reports + automation apply), **balanced / agent capacity** assignment, **audit log**, **SAML / MFA**, **custom roles**, **integrations marketplace** (stub connect), **dashboard apps**, **required attributes on resolve**, **CSAT review notes**, **Help Center custom domain** (+ optional second locale later), **voice / WhatsApp calling channel stub**. **No unpaid live Meta.** No live Slack / Linear / Notion / Shopify / Stripe / Dialogflow / Translate / Dyte / telephony / IdP SSO until product unlocks a paid provider — configs + stub ports only (same `ready_stub` / connect-stub pattern as D).

Companion detail: [data-model.md](./data-model.md), [api.md](./api.md), [jobs-realtime.md](./jobs-realtime.md), [authz.md](./authz.md), [threats.md](./threats.md), [ports.md](./ports.md), [seed.md](./seed.md).

### In scope

1. **SlaPolicy** — first-response (FRT), next-response (NRT), resolution (RT) thresholds; apply to inbox/conversation via automation action + admin assign; `ConversationSla` timer rows; breach events; **SLA report series** (unlocks C’s 501).
2. **Assignment capacity** — `AssignmentPolicy.kind` adds `balanced` + per-agent `AgentCapacity` (max open); assignment job respects capacity.
3. **Required attributes on resolve** — inbox/tenant flag + definition keys; resolve blocked with **422** until set.
4. **Captain AI** — assistants, copilot suggestions, monitors, triage helpers via `CaptainAiPort`; **default stub** (canned / echo); optional live model only when env provider key present **and** product unlock flag — Casa seed uses stub.
5. **AuditEvent** — append-only enterprise activity log (config, authz, security, CRM admin mutations); admin list/filter; distinct from `domain_events`.
6. **SAML SSO + MFA** — IdP metadata / ACS config shapes; MFA TOTP enrollment; seed tenant keeps email/password; live IdP HTTP optional behind unlock (stub verify in E).
7. **CustomRole** + permission bits (incl. `report_manage`); membership may attach `custom_role_id`; seed still `admin` \| `vendedor` enums as base.
8. **Integrations** — install rows for Slack, Linear, Notion, Shopify, Stripe, Dialogflow, Google Translate, Dyte; OAuth/credential shapes; connection ≤ `ready_stub` / `connected_stub`; deliver hooks reuse webhook job + egress guard — **no** live provider APIs unpaid.
9. **DashboardApp** — embeddable iframe apps on conversation sidebar; URL SSRF-guarded.
10. **CSAT review notes** — admin `review_note` on `CsatResponse`.
11. **Help Center custom domain** — `Portal.custom_domain` + verification token stub; Host-header resolve; multi-locale portal optional (`pt-BR` required, second locale stub).
12. **ChannelVoice** — voice / WA calling inbox type; credentials ≤ `ready_stub`; simulate only; **no** telephony provider HTTP.
13. **Platform / super-admin multi-account APIs** — **out of Casa seed Phase E** (product: Account era). Document reserved; do not implement multi-tenant platform console here.

### Out of Phase E

| Deferred | Why |
|---|---|
| Live Meta / social / SMS / SMTP (still) | Product stub policy — unchanged |
| Live Captain model billed calls | Needs paid provider + unlock flag; stub satisfies parity UI |
| Live SAML IdP round-trip | Config + stub verify; real SSO when IdP contracted |
| Live Slack/Linear/… OAuth token exchange | Connect-stub only |
| Live Twilio Voice / SIP / WA calling | Voice channel config stub only |
| Chatwoot CLI / coding agents | Product explicitly Phase later / n/a |
| Super-admin platform APIs | Account era — single seed tenant |
| Replacing email/password for seed admin | MFA optional; password remains |

### Locked decisions (Phase E)

| Topic | Decision |
|---|---|
| SLA metrics | **FRT** = time to first **outgoing non-private** agent message after create/open; **NRT** = time to next agent outgoing after contact incoming while open; **RT** = time to `resolved`. Thresholds in **seconds** on `SlaPolicy` |
| SLA apply | Admin CRUD policies; link to inbox (default) and/or automation action `apply_sla` / `remove_sla`. Conversation stores `sla_policy_id?` + `ConversationSla` row with `frt_due_at`, `nrt_due_at`, `rt_due_at`, breach flags |
| SLA worker | Job `sla.evaluate` on tick + on message/status events; emit `sla.threshold_warning` / `sla.breached`; **never** invent report numbers without policy + timer rows |
| SLA reports | `GET /api/saas/crm/relatorios/sla` — admin; same `from`/`to`/tz rules as C; measures: applied count, FRT/NRT/RT hit rates, breach counts |
| Capacity | `AgentCapacity` per `(tenant_id, user_id)`: `max_open_conversations` (int ≥ 1). Policy `kind=balanced` picks online inbox member with **fewest** open assigned under capacity; skip at-capacity. `round_robin` unchanged |
| Required attrs | Inbox `required_attribute_keys_on_resolve: string[]` (custom attribute keys). `PATCH` status→`resolved` validates; missing → **422** `validacao` with keys |
| Captain modes | `copilot` (suggest reply), `triage` (suggest labels/priority/team), `monitor` (flag conversation), `assistant` (named bot-like Q&A over Help Center articles — retrieval stub). All go through `CaptainAiPort` |
| Captain apply | Suggestions are **proposals** (`CaptainSuggestion`); agent must confirm via existing desk PATCH/POST. No silent auto-resolve/auto-send in E without explicit automation action `captain.apply_suggestion` gated admin |
| Captain egress | Stub adapter returns deterministic fixtures. Live adapter (OpenAI-shaped or similar) **forbidden** unless `CAPTAIN_PROVIDER_ENABLED=true` **and** key present; tests default stub; **never** Meta |
| Audit vs domain_events | `AuditEvent` = who changed **security/config/admin** state (roles, SAML, integrations, SLA policies, channel credentials touch, user deactivate). `domain_events` stay operational CRM stream. Retention: audit ≥ 90 days contract |
| Audit PII | No full CNPJ, no secrets, no raw SAML assertions, no MFA secrets in `payload_json` |
| SAML | `SamConfig` (or `SamlConfig`) per tenant: IdP entity id, SSO URL, certificate PEM sealed, ACS URL derived. Login path stub: `POST /api/saas/auth/saml/acs` accepts fixture in test; production live parse behind unlock. JIT user provision = **admin-only toggle**, default off |
| MFA | TOTP (`MfaDevice`): enroll → show secret once → confirm code; login second step. Recovery codes hashed. Admin may require MFA via tenant flag `mfa_required`. Seed admin works without MFA until enrolled |
| Custom roles | `CustomRole` + `permissions_json` string[] bits. Built-in bits include Chatwoot-shaped: `conversation_manage`, `contact_manage`, `report_manage`, `knowledge_manage`, `automation_manage`, `integration_manage`, `audit_read`, … Membership: keep `saas_role` `admin`\|`vendedor` as **floor**; `custom_role_id?` **adds** bits for vendedor-shaped users. `admin` always implies all bits. Do not remove seed roles |
| report_manage | Permission bit: grants `/relatorios/*` without full admin. Checked after `admin` short-circuit |
| Integrations | `IntegrationInstall` per `(tenant_id, provider)`; providers enum below; `connection_status`: `not_configured` \| `credentials_saved` \| `connected_stub` \| `live`. Reject `live` (`501`). Secrets sealed. Outbound events = existing `webhook.deliver` style job with provider-shaped payload adapter — stub HTTP no-op or egress-guarded customer URL only |
| Dashboard apps | `DashboardApp`: `title`, `url`, `inbox_ids?`, `enabled`. URL must pass `UrlEgressGuardPort` (https). Rendered as iframe in conversation UI; no server-side fetch of app HTML required |
| CSAT notes | `CsatResponse.review_note?`, `reviewed_by_user_id?`, `reviewed_at?`. Admin PATCH only |
| HC custom domain | `Portal.custom_domain` unique global when set; `custom_domain_verified` bool; verification = DNS TXT stub check port (`DnsVerifyPort`) that **may no-op success in test** / fail-closed without provider. Public HC also resolvable by `Host` → portal when verified. Until verified, only slug routes work |
| HC locale | E may add `Portal.locale` still default `pt-BR`; optional `PortalLocale` rows — public falls back to pt-BR. No unpaid translation API (Google Translate integration = stub) |
| Voice channel | `channel_type=voice`; `ChannelVoice` config (provider `twilio_voice`\|`wa_calling` shaped); ≤ `ready_stub`; admin simulate creates conversation with `content_type=text` system note “chamada simulada”; **no** WebRTC SFU in E |
| Platform APIs | Paths under `/api/platform/*` **reserved / 501** — not acceptance for Casa seed |
| No Meta | Unchanged — WA and social stay ≤ `ready_stub`; Captain ≠ Meta |

### Integration providers (E)

| `provider` | Stub connect fields (non-secret / secret) |
|---|---|
| `slack` | workspace id metadata; sealed bot token |
| `linear` | workspace; sealed API key |
| `notion` | workspace; sealed OAuth token |
| `shopify` | shop domain; sealed admin token |
| `stripe` | account id; sealed restricted key |
| `dialogflow` | project id; sealed SA json envelope |
| `google_translate` | project; sealed API key — **unused** for unpaid live translate |
| `dyte` | org id; sealed API key (video stub) |

All: GET masked; PUT encrypt; status ≤ `connected_stub`.

### Captain suggestion flow

```
Agent opens conversation → optional POST /captain/sugerir { mode, conversation_id }
  → CaptainAiPort.suggest (stub fixture or live if unlocked)
  → persist CaptainSuggestion (pending)
  → return proposal to UI
Agent accepts → existing domain APIs (send message / add labels / assign)
  → mark suggestion accepted; emit captain.suggestion_accepted
Monitor job (optional): captain.monitor_scan on open conversations → suggestions only
```

### SLA apply + evaluate flow

```
Admin creates SlaPolicy → optional inbox default_sla_policy_id
Automation action apply_sla OR admin PATCH conversation
  → upsert ConversationSla; set due_ats from thresholds + clock
On message.created / conversation.status_changed / sla.evaluate tick:
  → update hit/breach booleans; emit sla.* events
Report /relatorios/sla aggregates ConversationSla + breaches in range
```

### Domain events added in E

`sla.applied` · `sla.removed` · `sla.threshold_warning` · `sla.breached` · `sla.hit` · `capacity.updated` · `captain.suggestion_created` · `captain.suggestion_accepted` · `captain.suggestion_dismissed` · `audit.recorded` (optional mirror) · `integration.updated` · `saml.updated` · `mfa.enrolled` · `mfa.disabled` · `custom_role.updated` · `dashboard_app.updated` · `voice.simulated`

Audit writes go to **`audit_events`** table primarily; domain_events above are for SSE/automations where useful (SLA/Captain). Do not dual-write every audit row to SSE.

### Job kinds enabled in E

| Kind | Trigger |
|---|---|
| `sla.evaluate` | Tick + after message/status when ConversationSla active |
| `assignment.balanced` | New/unassigned conversation when policy `kind=balanced` (RR keeps `assignment.round_robin`) |
| `captain.suggest` | Optional async suggest; MVP may run suggest inline on POST |
| `captain.monitor_scan` | Optional periodic; creates suggestions only |
| `integration.deliver` | Fan-out to connected_stub installs (no-op body or customer webhook URL) |
| `audit.prune` | Optional retention prune |
| `dns.verify_portal_domain` | Admin verify custom domain |

### Phase E acceptance (architecture)

1. Admin CRUD SlaPolicy; apply to conversation; timers breach/hit; **SLA report** returns real aggregates (not 501); vendedor without `report_manage` → 403.
2. Balanced policy + AgentCapacity skips at-capacity agents; round-robin still works.
3. Resolve with missing required attributes → 422; with attributes → resolved.
4. Captain suggest returns stub proposal; accept uses desk APIs; **no** model HTTP unless unlock flag in tests that explicitly enable it; **no** Meta.
5. Audit log lists admin credential/role/SLA/integration changes; vendedor → 403.
6. SAML/MFA config save + MFA enroll stub; seed password login still works; live IdP not required.
7. Custom role with `report_manage` can read reports; without → 403.
8. Integration installs reach `connected_stub`; `live` rejected; no Slack/etc egress in default tests.
9. Dashboard app URL blocked if egress guard fails.
10. CSAT review_note PATCH admin; HC custom_domain verify stub; voice inbox ≤ `ready_stub` + simulate.
11. Cadastro/pipeline/commerce outbox/WA ready_stub unchanged; no unpaid Meta.

### Handoff (Phase E)

| Specialist | Task |
|---|---|
| **design** | SaaS: SLA, Capacidade, Captain, Auditoria, Segurança (SAML/MFA), Papéis, Integrações, Apps do painel, Atributos obrigatórios; voice canal stub |
| **backend** | Phase E tables + jobs; Captain/SAML/MFA/Dns/Integration ports (stubs); report SLA; authz bits |
| **frontend** | Admin + desk affordances against Phase E `/api/saas/crm/*` map; no parallel kit |
| **qa** | Phase E checklist; no Meta/live integrations; SLA math; capacity; audit RBAC; MFA enroll; custom role report_manage |

## Channel polymorphism

```
Inbox
  id, tenant_id, name, channel_type, greeting?, ooo_message?,
  csat_enabled, lock_to_single_conversation, allow_auto_assign, …

channel_type =
  whatsapp | web_widget | email | facebook | instagram | tiktok |
  twitter | telegram | line | sms | api | voice

ChannelWhatsapp (1:1 when channel_type=whatsapp) — Phase A
ChannelWebsiteWidget (1:1 web_widget) — Phase D
ChannelEmail (1:1 email) — Phase D
ChannelSocial (1:1 facebook|instagram|tiktok|twitter|telegram|line) — Phase D
ChannelSms (1:1 sms) — Phase D
ChannelApi (1:1 api) — Phase D
ChannelVoice (1:1 voice) — Phase E stub
```

Domain talks to `ChannelSendPort` / `ChannelSimulateInboundPort` / `WidgetSessionPort`. All external provider adapters are stubs until product unlock. Widget/API delivery is first-party persistence + fan-out. Phase E adds `CaptainAiPort`, `SamAuthPort` / `MfaPort`, `DnsVerifyPort`, `IntegrationConnectPort` — stubs by default.

## Permission summary

See [authz.md](./authz.md). Map: Chatwoot Administrator → `admin`; Agent → `vendedor`. Phase E: optional `CustomRole` permission bits (e.g. `report_manage`) on top of base `saas_role`; `admin` remains full access.

**Inbox visibility (Phase A lock):**

- `admin`: all conversations in tenant inboxes.
- `vendedor`: conversations where user is inbox member **and** (assignee = self **or** unassigned **or** team membership matches conversation.team_id). Settings flag `vendedor_see_all_inbox` defaults **false**.

## Event names (domain_events)

Phase A emits at least:

`conversation.created` | `conversation.updated` | `conversation.status_changed` | `conversation.assigned` | `message.created` | `contact.updated` | `agent.viewing` | `agent.typing`

Phase B+ consumers: automations, webhooks, bots, reports projections.

Phase D adds: `channel.updated` | `widget.session_started` | `widget.message_created` | `campaign.displayed` | `push.subscribed` | `push.failed`

Phase E adds: `sla.*` | `capacity.updated` | `captain.suggestion_*` | `integration.updated` | `saml.updated` | `mfa.*` | `custom_role.updated` | `dashboard_app.updated` | `voice.simulated` (see Phase E section). Audit rows live in `audit_events`.

## Handoff

| Specialist | Task |
|---|---|
| **design** | Phase A–E desk IA; canal stubs; Loja widget; enterprise config (SLA, Captain, audit, security, integrations) |
| **backend** | Phase A→E tables + job consumers per this doc |
| **frontend** | `/api/saas/crm/*` Phase A→E; Loja widget; public HC; no parallel CSS kit |
| **qa** | Per-phase acceptance; no Meta/provider HTTP; SSRF; campaign outbox isolation; widget tenancy; SLA/capacity/audit; cadastro/pipeline regression; tenant isolation |

## What must not happen

- Second inbox product or parallel `whatsapp_threads` write path after migration.
- Live Meta Graph / webhook verification / campaign template sync from Meta.
- Live Facebook / Instagram / TikTok / X / Telegram / LINE / Twilio / IMAP-SMTP / Google-Microsoft mail from channel adapters in Phase D/E.
- Live Slack / Linear / Notion / Shopify / Stripe / Dialogflow / Translate / Dyte / telephony / IdP SSO without product unlock (Phase E = stub/connect only).
- Live Captain model HTTP without `CAPTAIN_PROVIDER_ENABLED` + key; never route Captain through Meta.
- Transition any channel or integration `connection_status` to `live` before product unlock.
- Trusting client-supplied `tenant_id` on widget or client API (resolve from website_token / API token).
- Exposing widget HMAC secret, API plaintext token, SAML private material, MFA secrets, or integration tokens on GET lists after create.
- Merging Account billing into CRM nav; implementing `/api/platform/*` super-admin for seed MVP.
- Second stock ledger.
- Trusting client for role, prices, stock, permission bits, or `tenant_id`.
- Returning WA / channel secrets on GET.
- Inline SSRF-prone HTTP from automation/bot/webhook/integration/dashboard-app on the request path.
- Executing automation webhook actions without `UrlEgressGuardPort`.
- CSAT, bot, or **campaign** delivery calling Meta/SMTP — stub outbox / stub channel only.
- Mixing `category=campaign` rows into commerce avisos without an explicit filter.
- Publishing Help Center drafts on public routes; routing unverified `custom_domain`.
- Inventing SLA report numbers without `SlaPolicy` + `ConversationSla` rows.
- Auto-sending Captain suggestions without explicit agent confirm (or admin-gated automation action).
- WebSocket requirement for Phase D text widget (SSE + poll only).
