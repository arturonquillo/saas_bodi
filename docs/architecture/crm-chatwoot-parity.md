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
| **B** | AutomationRule / Macro / CustomAttribute / AgentBot / Webhook / WorkingHour / AssignmentPolicy / CSAT tables sketched in data-model; job worker + SSRF guard required before enabling webhook actions |
| **C** | Campaign + Portal/Article + report read-models; outbox `category=campaign` |
| **D** | Channel polymorphism rows (`channel_type`); Loja widget client API |
| **E** | SlaPolicy, Captain ports, SAML, audit_events, custom roles |

### Migration plan (threads → desk)

1. Create CRM tables; seed default WA inbox + system labels (`intent:cadastro`, `intent:orcamento`, `intent:info_empresa`, `intent:outro`).
2. For each `WhatsappThread`: upsert Contact by `(tenant_id, phone_e164)`; create ContactInbox `source_id = phone_e164`; create Conversation on default inbox; map `aberta`→`open`, `arquivada`→`resolved`; copy commerce FKs; attach intent label when intent set.
3. Copy messages: `inbound`→`incoming`, `outbound_note`→`outgoing` + `private=true` for notes (MVP notes were `outbound_note`; treat as private note if product used them as agent-only — **lock:** historical `outbound_note` → Message `message_type=outgoing`, `private=true`).
4. Point CadastroRequest.thread_id → conversation_id (rename column).
5. Drop intent enum column after backfill; keep read fallback one release if needed.
6. Update seed + acceptance to Conversation APIs.

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
| **design** | Conversas / Contatos / Configurações CRM IA in saas-starter; WA “Pronto para conectar” states |
| **backend** | Prisma migration, ports, APIs, SSE, encryption, seed migration |
| **frontend** | Evolve InboxScreen → Conversas against `/api/saas/crm/*`; no parallel CSS kit |
| **qa** | Phase A acceptance + no Meta HTTP + cadastro/pipeline regression + tenant isolation on conversations |

## What must not happen

- Second inbox product or parallel `whatsapp_threads` write path after migration.
- Live Meta Graph / webhook verification.
- Merging Account billing into CRM nav.
- Second stock ledger.
- Trusting client for role, prices, stock, or `tenant_id`.
- Returning WA secrets on GET.
- Inline SSRF-prone HTTP from automation on the request path.
