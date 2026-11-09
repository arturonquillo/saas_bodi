# Chatwoot parity — Casa dos Frios CRM

## Problem

Casa dos Frios already has a **simulated WhatsApp inbox** tied to cadastro and Orçamento → Pedido → Venda. Operators need a **full omnichannel desk** at Chatwoot feature parity — not a second disconnected inbox — while staying **pt-BR**, **tenant-ready**, and **without live Meta Cloud API / unpaid providers**.

**Outcome:** evolve the current SaaS CRM into a Chatwoot-parity conversation platform integrated with cadastro, orçamentos, and the saas-starter admin shell. Success = every Chatwoot capability is either **in** a delivery phase or **explicitly phased later** with a user-visible justification; WhatsApp is **listo para conectar** (credentials + contracts + UI) but stubbed for send/receive.

**Sources inventoried:** [Chatwoot features](https://www.chatwoot.com/features), [User Guide](https://www.chatwoot.com/hc/user-guide/en), [Developer docs / API](https://developers.chatwoot.com/llms.txt), upstream models/controllers on [`chatwoot/chatwoot` `develop`](https://github.com/chatwoot/chatwoot). Snapshot date: product brief authoring (this doc).

## Who

| Actor | Job |
|---|---|
| **Admin** (SaaS) | Full CRM config: inboxes/channels, teams, automations, reports, help center, bots, SLA, capacity, audit |
| **Vendedor** (SaaS agent) | Conversations, contacts, labels, canned replies, macros, assignments they own, CSAT participation |
| **Cliente / prospecto** | WhatsApp / future widget / help center; cadastro + orçamento/pedido via existing commerce flows |
| **Future tenant operators** | Same desk per tenant when Account selling lands |

## Scope (in / out)

### In (product commitment — full Chatwoot feature set)

Everything in the **inventory table** below is **in product scope**. Delivery is phased (A→E). Nothing is permanently dropped without a row marked **phase later** and a justification.

### Out (not Chatwoot product surface — do not build as part of this brief)

| Item | Why out |
|---|---|
| Live Meta WhatsApp Cloud API / 360dialog / Twilio paid send-receive | User + `AGENTS.md`: stubs only until paid integration approved |
| Required SMTP / paid email ingress | Same stub policy as existing outbox |
| Replacing Orçamento → Pedido → Venda with Chatwoot statuses | Commerce pipeline stays; CRM links to it |
| Account SaaS billing chrome | Still deferred per `spec.md` |
| Embedding Chatwoot OSS as a sidecar | Prefer **native parity** inside saas_bodi so cadastro/pipeline stay first-class |

### Locked decisions (do not reopen in implementation)

1. **Evolve, don’t fork:** replace/extend `whatsapp_inbox` simulated threads into the Chatwoot-parity conversation model — one CRM desk.
2. **WhatsApp = listo para conectar:** channel config UI + credential fields + contracts + simulate/outbox adapters; **no** live Graph/webhook traffic.
3. **Intents → labels + attributes:** migrate `cadastro` / `orcamento` / `info_empresa` / `outro` to system labels (and optional conversation custom attributes); keep commerce deep-links.
4. **Roles map:** Chatwoot Administrator → SaaS `admin`; Chatwoot Agent → SaaS `vendedor`. Custom roles / report_manage are Phase E unless architect needs an earlier permission bit.
5. **Contact ↔ Cliente:** one Contact graph; approved cadastro **Cliente** is a commerce projection / link on Contact (CNPJ company), not a second people DB.
6. **pt-BR only** for Casa dos Frios UI; Help Center locale = pt-BR first (Chatwoot multi-locale portal = Phase E with justification).
7. **UI kit:** shadcn + saas-starter admin shell; do not invent a parallel CSS kit.

## UX surfaces

| Surface | Chatwoot parity role |
|---|---|
| **SaaS** | Primary desk: Conversas, Contatos, Relatórios, Campanhas, Central de Ajuda (admin), Configurações CRM |
| **Loja** | Website live-chat widget + Help Center public portal (later phases); WhatsApp CTA stays; cadastro/compra unchanged |
| **Account** | Not in this brief |

Nav must sit inside the **saas-starter** admin shell (PR #7 / branch `cursor/saas-starter-ui-kit-63c8`), not a separate product chrome.

## Permissions (CRM desk)

API enforces; UI hides. Commerce matrices in `spec.md` unchanged.

| Capability | Admin | Vendedor |
|---|---|---|
| Conversations (inbox members) | yes | yes (assigned / unassigned / team per settings) |
| Private notes, labels on conversation | yes | yes |
| Assign / reassign / team | yes | yes (within inbox membership) |
| Canned responses CRUD | yes | yes (parity with Chatwoot) |
| Macros public | yes | execute; create public = admin (lock: public macros admin-only) |
| Macros private | yes | own only |
| Contacts CRUD, notes, merge, CSV import | yes | yes |
| Teams / inbox members / channel credentials | yes | read membership only |
| Automations, assignment policies, capacity, SLA | yes | — |
| Campaigns | yes | — |
| Reports + CSAT review notes | yes | agent metrics of self optional later; default: admin |
| Help Center authoring | yes | draft articles optional later; default: admin publish |
| Agent bots, webhooks, integrations hooks | yes | — |
| Simulate inbound / outbox tools | yes | outbox read |
| Cadastro approve + pipeline | yes | yes (existing) |

## Data and integrations

### Core objects (parity vocabulary → Casa)

| Chatwoot | Casa dos Frios | Notes |
|---|---|---|
| Account | `Tenant` | One seed `casa-dos-frios`; tenant_id everywhere |
| User / AccountUser | SaaS `User` + role | `admin` \| `vendedor` |
| Inbox + Channel | CRM Inbox + channel config | WhatsApp channel first |
| Conversation | Conversation (evolves WhatsappThread) | Statuses below |
| Message | Message (evolves WhatsappMessage) | + private notes, attachments |
| Contact | Contact (links Cliente / Cadastro) | Phone E.164 BR |
| ContactInbox | Contact ↔ Inbox identity | source_id for WA |
| Label | Label | System intents seeded |
| Team / TeamMember | Team | Sales vs suporte etc. |
| CannedResponse | CannedResponse | `/shortcode` + `{{vars}}` |
| AutomationRule | AutomationRule | event / conditions / actions |
| Macro | Macro | action sequences |
| CustomAttributeDefinition | CustomAttributeDefinition | contact \| conversation |
| Campaign | Campaign | ongoing + one-off |
| Portal / Category / Article | Help Center | Loja-adjacent public |
| AgentBot / AgentBotInbox | AgentBot | webhook URL stub |
| CSAT survey response | CsatResponse | on resolve |
| Notification + settings | AgentNotification | in-app + email stub |
| Webhook | Webhook | outbound events stub-capable |
| WorkingHour | WorkingHour | business hours |
| AssignmentPolicy / Capacity | AssignmentPolicy | auto-assign |
| SLA policy | SlaPolicy | Phase E |
| Company | Company (CNPJ org) | Align with cadastro company |

### Conversation statuses (locked — Chatwoot enum)

| Status | Meaning |
|---|---|
| `open` | Customer waiting / active queue |
| `pending` | Bot / triage; not in default agent open queue |
| `snoozed` | Hidden until `snoozed_until` or customer reply |
| `resolved` | Done; may reopen on customer reply per inbox setting |

Priorities: `low` \| `medium` \| `high` \| `urgent` \| null.

### WhatsApp — “listo para conectar” (locked)

**Decision:** ship **channel configuration + UI + API contracts + credential storage shape** that mirror Chatwoot WhatsApp Cloud / manual setup fields. Runtime adapters remain **stubs** (simulate inbound, outbox outbound). No Meta Graph calls, no webhook verification against Meta, no template sync from Meta until product unlocks paid integration.

Credential / config fields (store encrypted at rest when secrets; never log):

| Field | Purpose |
|---|---|
| `provider` | `whatsapp_cloud` \| `default` (360dialog-shaped) — UI only until live |
| `phone_number` | E.164 display / routing key |
| `provider_config.api_key` / access token | Listo para conectar |
| `provider_config.api_secret` / app secret | Listo para conectar |
| `provider_config.phone_number_id` | Meta Cloud |
| `provider_config.business_account_id` | WABA id |
| `provider_config.webhook_verify_token` | Generated; unused until live |
| `message_templates` | Cached JSON — editable stub list for campaigns/UI |
| Connection status | `not_configured` \| `credentials_saved` \| `ready_stub` \| `live` (live unreachable until unlock) |

UI copy (pt-BR): state **“Listo para conectar”** / **“Pronto para conectar”** when credentials saved; explain that envio/recebimento real awaits integração Meta aprovada. Keep admin **Simular mensagem** and existing `notification_outbox`.

### Conflicts with current MVP (flagged for architect)

| Current MVP | Parity change | Conflict |
|---|---|---|
| `WhatsappThread` + intent enum | Conversation + labels/attributes | Migration / rename; seed intents as labels |
| Single implicit WA inbox | Multi-inbox model | Need default WA inbox per tenant |
| No assignee / team | assignee_id, team_id, inbox_members | RBAC for unassigned queues |
| Intent-only triage | Filters, priority, snooze, pending | UX expansion in saas-starter shell |
| Outbox-only notifications | Agent notification center + prefs | Parallel to commerce outbox (do not merge blindly) |
| Cliente vs phone thread | Contact graph + Cliente link | Cadastro approval must attach Contact→Cliente |
| No reports module | Full reports suite | New read models / events |
| MVP roles only | Chatwoot custom roles / report_manage | Phase E or thin permission flags |

## Full feature inventory

**Legend:** **In** = required in named phase · **Phase later** = still committed, deferred with justification · **Stub** = UI/contracts yes, external provider no.

Phases:

| Phase | Name | Focus |
|---|---|---|
| **A** | Desk foundation | Replace simulated inbox with Conversation desk + WhatsApp stub channel |
| **B** | Operator power | Automations, macros, attributes, CSAT, bots webhook, hours, assignment |
| **C** | Growth & insight | Campaigns, Help Center, Reports |
| **D** | Omnichannel expand | Non-WA channels (mostly stub providers) + widget on Loja |
| **E** | Enterprise & AI | Captain, SLA, capacity advanced, SAML/MFA, audit, rich integrations |

| # | Module | Chatwoot capability | Phase | Stub? | Casa surface | Notes |
|---|---|---|---|---|---|---|
| 1 | Channels | WhatsApp Cloud / manual credentials | A | **Stub live I/O** | SaaS config | Listo para conectar |
| 2 | Channels | Website live chat widget | D | Partial (own widget) | Loja + SaaS | After WA desk stable |
| 3 | Channels | Email (IMAP/SMTP / Google / Microsoft) | D | **Stub** | SaaS | No required SMTP |
| 4 | Channels | Facebook Messenger | D | **Stub** | SaaS | Config only until paid |
| 5 | Channels | Instagram DMs | D | **Stub** | SaaS | |
| 6 | Channels | TikTok DMs | D | **Stub** | SaaS | |
| 7 | Channels | X (Twitter) DMs/mentions | D | **Stub** | SaaS | |
| 8 | Channels | Telegram | D | **Stub** | SaaS | |
| 9 | Channels | LINE | D | **Stub** | SaaS | |
| 10 | Channels | SMS (Twilio / Bandwidth-shaped) | D | **Stub** | SaaS | |
| 11 | Channels | API channel | D | In-process stub OK | SaaS | Useful for custom clients |
| 12 | Channels | Voice / WhatsApp calling | E | **Stub** | SaaS | Needs telephony provider; justify after messaging desk |
| 13 | Inboxes | Create/list/update inbox, members, greeting, OOOH, lock single conversation, CSAT toggle | A | — | SaaS | |
| 14 | Conversations | List/filter/sort, open/pending/snoozed/resolved | A | — | SaaS | Evolves current inbox UI |
| 15 | Conversations | Assign agent / team, participants, priority | A | — | SaaS | |
| 16 | Conversations | Private notes, attachments, typing, read/delivery status model | A | Delivery status stub on WA | SaaS | |
| 17 | Conversations | Collision detection (agent viewing) | A | — | SaaS | |
| 18 | Conversations | Mute, snooze, bulk actions, drafts | A | — | SaaS | |
| 19 | Conversations | Mentions | B | — | SaaS | |
| 20 | Conversations | Interactive messages (cards/forms/select) | D | Widget/API channels | SaaS/API | |
| 21 | Conversations | Message signature (per agent) | B | — | SaaS profile | |
| 22 | Conversations | Required attributes on resolve | E | — | SaaS | Enterprise-shaped workflow |
| 23 | Contacts | CRUD, search, filter, segments, notes, labels | A | — | SaaS | Link Cliente/CNPJ |
| 24 | Contacts | CSV import / data import | B | — | SaaS | |
| 25 | Contacts | Merge contacts | B | — | SaaS | |
| 26 | Contacts | Contactable inboxes + outbound new message | A | WA stub | SaaS | |
| 27 | Companies | Company object + contact association | A | — | SaaS | Align cadastro CNPJ |
| 28 | Labels | CRUD, colors, sidebar | A | — | SaaS | Seed intent labels |
| 29 | Teams | CRUD + members | A | — | SaaS | |
| 30 | Assignments | Manual + auto-assignment enable | A | — | SaaS | |
| 31 | Assignments | Assignment policies (round-robin OSS) | B | — | SaaS | |
| 32 | Assignments | Balanced + agent capacity policies | E | — | SaaS | Enterprise in upstream |
| 33 | Canned responses | CRUD + `/shortcode` + template vars | A | — | SaaS | |
| 34 | Macros | Private/public action sequences | B | — | SaaS | |
| 35 | Automations | Events/conditions/actions (full Chatwoot set) | B | Webhook action stub-ok | SaaS | |
| 36 | Custom attributes | Contact + conversation definitions + values | B | — | SaaS | Seed commerce attrs |
| 37 | Custom filters / folders | Saved conversation + contact filters | B | — | SaaS | |
| 38 | Agent bots | Bot CRUD, inbox link, webhook events, pending handoff | B | Bot URL external | SaaS | No unpaid AI host required |
| 39 | Captain AI | Copilot, monitors, triage, assistants | E | Needs model provider | SaaS | **Phase later:** paid/model dependency + not needed for WA desk MVP parity demo; still committed |
| 40 | CSAT | Per-inbox enable, survey on resolve, responses | B | Delivery via stub channel | SaaS + survey page | |
| 41 | CSAT | Reports + review notes | C / E notes | — | SaaS | Review notes can trail |
| 42 | Notifications | In-app + preferences (assigned/unassigned/others) | A | Email via outbox stub | SaaS | |
| 43 | Notifications | Push / browser | D | — | SaaS | After desk |
| 44 | Campaigns | Ongoing (website) | C | Needs widget (D) dependency | SaaS | If C before D: WA/SMS one-off first |
| 45 | Campaigns | One-off SMS / WhatsApp template to labels | C | **Stub send** | SaaS | Uses stub templates |
| 46 | Help Center | Portal, categories, articles, publish | C | — | SaaS + public portal | pt-BR |
| 47 | Help Center | Custom domain | E | — | Account/ops | Multi-tenant DNS later |
| 48 | Reports | Overview realtime | C | — | SaaS admin | |
| 49 | Reports | Conversations / Agents / Labels / Inbox / Team | C | — | SaaS | |
| 50 | Reports | CSAT, Bot, SLA | C / E for SLA | — | SaaS | |
| 51 | Business hours | Working hours + OOOH message | B | — | SaaS inbox | |
| 52 | SLA | Policies FRT/NRT/RT + apply via automation | E | — | SaaS | **Phase later:** wholesale desk value after routing/reports exist |
| 53 | Pre-chat forms | Website inbox fields | D | — | Loja widget | |
| 54 | Webhooks | Account/inbox webhooks CRUD + delivery | B | Deliver to customer URL | SaaS | |
| 55 | Integrations | Slack, Linear, Notion, Shopify, Stripe, Dialogflow, Google Translate, Dyte | E | Each stub/connect | SaaS | **Phase later:** none unblock WA CRM; ship hooks framework in B |
| 56 | Dashboard apps | Embed external apps in conversation | E | — | SaaS | |
| 57 | Audit logs | Enterprise activity log | E | — | SaaS admin | **Phase later:** LGPD ops after core desk; keep application logs meantime |
| 58 | Security | SSO/SAML, MFA | E | — | SaaS | **Phase later:** email/password sufficient for seed tenant |
| 59 | Security | Custom roles | E | — | SaaS | Map to admin/vendedor until then |
| 60 | Agent profile | Availability online/busy/offline, signature | A/B | — | SaaS | |
| 61 | Search | Global search conversations/contacts/messages | A | — | SaaS | |
| 62 | Keyboard shortcuts | Desk shortcuts | B | — | SaaS | |
| 63 | APIs | Application-style CRM APIs | A→ | — | backend | Mirror resources; not clone Chatwoot routes blindly |
| 64 | Client APIs | Contact-facing messaging API | D | — | API | For custom clients / widget |
| 65 | Platform APIs | Super-admin multi-account | E | — | Account era | **Phase later:** single seed tenant now |
| 66 | Realtime | WebSocket/SSE presence + events | A | — | SaaS | Architect picks transport |
| 67 | Data import | Contacts import jobs | B | — | SaaS | |
| 68 | Email templates / branded layout | Branded replies | D | Stub email | SaaS | |
| 69 | WhatsApp templates cache | List/manage templates | A | Stub cache | SaaS | No Meta sync |
| 70 | Chatwoot CLI / coding agents | Upstream CLI | **Phase later** | — | n/a | **Justification:** external DX tool around Chatwoot cloud/self-host; not part of Casa operator UX. Revisit if we expose public CRM APIs for agents. |

### Phase A acceptance (desk replaces simulator)

1. SaaS Conversas UI (saas-starter shell) lists conversations from default WhatsApp inbox; seed threads migrated.
2. Status/priority/assign/labels/private notes work; intent labels preserve cadastro/orçamento deep links.
3. Contact linked to phone; cadastro approval still gates Pedido.
4. WhatsApp channel settings show credential fields + **Pronto para conectar**; simulate inbound still works; no Meta HTTP.
5. Canned responses + agent notifications + teams + inbox members usable by admin/vendedor.
6. Outbox commerce notifications unchanged.

## Specialist tasks

- **architect:** Conversation domain replacing WhatsappThread; Contact/Company vs Cliente/Cadastro; inbox/channel polymorphism; tenancy; encryption for WA credentials; event bus for automations/reports; realtime; permission matrix; migration plan; stub ports for all providers; threats (IDOR across conversations, secret leakage, webhook SSRF).
- **design:** pt-BR desk IA in saas-starter: Conversas, Contatos, Relatórios, Configurações CRM; WhatsApp “pronto para conectar” empty/credential states; conversation sidebar (labels, attributes, commerce links); help center later.
- **frontend:** Implement against contracts after architect+design; evolve `InboxScreen` → Conversations; no parallel kit.
- **backend:** Domain + APIs + stub adapters + seed labels/intents migration; keep cadastro/pipeline gates.
- **qa:** Parity checklist per phase; Meta-call absence tests; cadastro/pipeline regressions; multi-tenant isolation.

## Open questions for architect (blockers)

1. **Contact vs Cliente identity:** single table with `cliente_id` vs Contact + Company + link — pick one before Phase A schema.
2. **Realtime transport** in current stack (SSE vs WebSocket vs poll) for collision detection + live messages.
3. **Automation execution host** (inline jobs vs queue) and SSRF policy for bot/webhook URLs.
4. **Credential encryption** standard for `provider_config` secrets at rest.
5. **Whether Phase C campaigns WA one-off** may mark outbox rows as `campaign` without Meta template submission UI beyond stub cache.

Non-blocking product notes: Captain provider choice; Help Center custom domain with white-label; voice providers — all Phase E.
