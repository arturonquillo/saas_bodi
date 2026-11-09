# Authz

Enforced in `apps/web/src/server/authz/`. UI only hides what the API already denies. Never trust client `role`, `unit_price`, `available`, or `tenant_id`.

## Surfaces

| Surface | Cookie | Who may obtain a session |
|---|---|---|
| Loja | `cdf_sessao_loja` | `membership.is_customer` **and** linked Cliente `aprovado` (or pending prospect for read-only “meus docs” only if product allows — MVP: login for aprovado + prospecto with cadastro `pendente` can login to see status but **cannot** checkout) |
| SaaS | `cdf_sessao_saas` | `membership.saas_role` in (`admin`, `vendedor`) and `user.ativo` |

Prospect with only a pending cadastro may authenticate on Loja to view cadastro status / refuse guest checkout — still blocked from Pedido create.

**No Account surface / cookie in MVP.**

Middleware order on every `/api/{loja,saas}/*` except public GETs and login/register/cadastro:

1. Resolve tenant (session, or slug on public Loja reads).
2. Load membership for `(user_id, tenant_id)` — 401 if missing or user inactive.
3. **Surface gate**: `session.surface` must match the API prefix.
4. **Role gate** for the action.
5. **Cadastro gate** on Pedido / Orçamento accept→Pedido / Venda creates.
6. Handler queries **always** `WHERE tenant_id = session.tenantId`.

Cross-tenant IDs → **404** (do not leak existence). Wrong role → **403**. Illegal state → **409**. Cadastro gate → **403** `cadastro_nao_aprovado` (or **422** if preferred consistently — **use 403** `cadastro_nao_aprovado`).

## No entitlement gate

MVP has no `subscription_status` check. Seed tenant is always operational. Do not port `requireEntitlementAtiva` from the old Account design.

## Role matrix (SaaS)

| Action | admin | vendedor |
|---|---|---|
| Users create / deactivate / list | yes | no |
| Theme / tenant config write | yes | no |
| Simulate WhatsApp inbound | yes | no |
| Cadastro approve / refuse | yes | yes |
| Orçamento / Pedido / Venda transitions (per product matrix) | yes | yes |
| SKU create / stock adjust / visibility | yes | read (+ lines from catalog when creating docs) |
| Outbox read (`category=commerce`) | yes | yes |

Fulfillment statuses (`em_separacao`, `despachado`, `entregue`) are operated by **admin and vendedor** — no dedicated warehouse/courier roles.

## CRM desk matrix (Phase A)

Chatwoot Administrator → `admin`; Agent → `vendedor`. Phase E: optional `CustomRole` permission bits on membership (`custom_role_id`); `admin` implies all bits; `vendedor` + bits can gain scoped powers (e.g. `report_manage`).

| Action | admin | vendedor |
|---|---|---|
| List/read conversations (visibility below) | all inboxes | inbox member + assigned/unassigned/team |
| Private notes, labels on conversation | yes | yes |
| Assign / reassign / team / priority / snooze / mute / bulk | yes | yes (within visibility) |
| Post outgoing / drafts | yes | yes |
| Canned responses CRUD | yes | yes |
| Contacts / companies CRUD + notes | yes | yes |
| Start outbound conversation on WA stub | yes | yes |
| Labels CRUD | yes | yes (Phase A lock) |
| Teams / inbox members / channel credentials | yes | read membership only |
| Simulate inbound | yes | no |
| Agent notifications + prefs + presence | self | self |
| SSE event stream | yes (tenant) | yes (filtered) |
| Automations, bots, webhooks | Phase B — **admin** | — |
| Campaigns, reports, help center publish | Phase C — **admin** | — |
| Non-WA channel credentials / widget config / API tokens / email templates | Phase D — **admin** | read membership / desk only |
| Browser push subscribe | Phase D — self | self |

### CRM desk matrix (Phase B additions)

| Action | admin | vendedor |
|---|---|---|
| Automations CRUD / test (dry-run) | yes | no |
| Macros public CRUD | yes | no |
| Macros private CRUD | own | own |
| Macros execute (public + own private) | yes | yes |
| Custom attribute definitions CRUD | yes | no |
| Set attribute values on visible conversation/contact | yes | yes |
| Agent bots CRUD + inbox link | yes | no |
| Bot handoff on visible conversation | yes | yes |
| Webhooks CRUD / test / rotate signing secret | yes | no |
| Working hours write | yes | no |
| Working hours read / open-now | yes | member |
| Assignment policy write | yes | no |
| CSAT responses list/read | yes | no |
| Public CSAT submit by token | n/a (public) | n/a |
| Saved filters CRUD | own | own |
| Contact merge / CSV import | yes | yes |
| Agent signature on self profile | self | self |

Invisible conversation on macro execute / attribute patch / handoff → **404**. Webhook/bot URL that fails egress → **422** `validacao` (or `egress_bloqueado` if shared adds the code — prefer `validacao` with details).

### CRM desk matrix (Phase C additions)

| Action | admin | vendedor |
|---|---|---|
| Campaigns CRUD / send / cancel / recipients | yes | no |
| Help Center portal / categories / articles CRUD + publish | yes | no |
| Public Help Center read (published) | n/a (public) | n/a |
| Reports all series (`/relatorios/*`) | yes | no |

Vendedor on Phase C admin routes → **403** `forbidden`. Public article draft/archived → **404** (do not leak titles via 403). Campaign send does not grant vendedor outbox category bypass — commerce avisos stay `commerce`-filtered for both roles.

### CRM desk matrix (Phase D additions)

| Action | admin | vendedor |
|---|---|---|
| Create inbox with any D `channel_type` | yes | no |
| Channel credentials PUT / rotate token / simulate non-WA | yes | no |
| Widget config + embed snippet | yes | no |
| Email templates CRUD | yes | no |
| Read inbox list including channel_type + status | yes | yes (member) |
| Reply on widget/API/email/social conversations (visible) | yes | yes |
| Browser push VAPID public + own subscriptions | self | self |
| Loja widget public routes | n/a (website_token / session) | n/a |
| Public CRM client API | n/a (inbox API Bearer) | n/a |

Vendedor channel credential mutate → **403**. Widget/client APIs: missing/invalid token → **401**; wrong origin vs `allowed_origins` → **403**. Cross-tenant website_token guess → **404** (same body). Interactive content on non-widget/API inbox → **422**.

### CRM desk matrix (Phase E additions)

| Action | admin | vendedor | notes |
|---|---|---|---|
| SlaPolicy CRUD / inbox default / apply on conversation | yes | no | read timer on visible conversation: yes |
| SLA reports `/relatorios/sla` | yes | if `report_manage` | else 403 |
| All other `/relatorios/*` | yes | if `report_manage` | E extends C: bit unlocks reports |
| AgentCapacity write | yes | no | |
| AssignmentPolicy `balanced` write | yes | no | |
| Required attributes on resolve config | yes | no | resolve still visible agents; missing attrs → 422 |
| Captain assistants CRUD | yes | no | |
| Captain suggest / accept / dismiss | yes | yes (visible) | accept runs desk authz |
| Audit log read | yes | if `audit_read` | |
| SAML / MFA policy / admin MFA reset | yes | — | |
| MFA self enroll/disable | self | self | |
| CustomRole CRUD / assign `custom_role_id` | yes | no | cannot escalate self above admin grant |
| Integration install / disconnect / test | yes | no | |
| Dashboard apps CRUD | yes | no | list apps on visible conversation: yes |
| CSAT review_note PATCH | yes | no | |
| HC custom domain set / verify | yes | no | |
| Voice inbox create / channel / simulate | yes | no (simulate) | reply on visible voice thread: yes |

### Custom role permission bits (Phase E)

Stored on `CustomRole.permissions_json`. Checked via `requirePermission(bit)` after surface/role gate. `saas_role=admin` → allow all bits. Unknown bits fail-closed.

| Bit | Grants |
|---|---|
| `conversation_manage` | same desk mutations as vendedor visibility (default implied for vendedor) |
| `contact_manage` | contacts/companies write |
| `report_manage` | all `/relatorios/*` including SLA |
| `knowledge_manage` | Help Center authoring |
| `automation_manage` | automations/macros public/bots/webhooks |
| `integration_manage` | integrations + dashboard apps |
| `audit_read` | `/auditoria` |
| `sla_manage` | SlaPolicy CRUD / apply |
| `security_manage` | SAML/MFA tenant policy (not self MFA) |

Seed memberships stay plain `admin` / `vendedor` without custom roles. Do not invent a third `saas_role` enum value.

### Conversation visibility helper

```ts
assertConversationVisible(session, conversation):
  // admin → ok if tenant matches
  // vendedor → tenant + InboxMember(user) + (
  //   conversation.assignee_user_id === user
  //   || conversation.assignee_user_id == null
  //   || TeamMember(user, conversation.team_id)
  //   || inbox.vendedor_see_all === true
  // )
```

Cross-tenant or invisible id → **404** `nao_encontrado` (same as other resources).

### Cadastro ↔ Contact (domain)

On cadastro `aprovado`: upsert Company by CNPJ; upsert/link Contact; set `Contact.cliente_id`, `Cliente.primary_contact_id`, `Cliente.company_id`. Pedido gate remains **`requireClienteAprovado` only** — Contact alone never authorizes checkout.

## Loja customer

| Action | Guest | Prospect (`pendente`) | Cliente `aprovado` |
|---|---|---|---|
| Catalog / theme / CTA | yes | yes | yes |
| Submit cadastro | yes | — | — |
| Login | — | yes | yes |
| Create Pedido / checkout | no | **no** | yes (if `loja_modo=pedido_direto`) |
| Accept/refuse own Orçamento `enviado` | no | no* | yes |
| List own orçamentos/pedidos | no | own orçamentos if any | yes |

\*Accept that would create Pedido is blocked until `aprovado` (product rule).

## Cadastro gate (domain)

Before any of:

- `POST` Pedido (Loja or SaaS)
- Orçamento `enviado` → `aceito` (when that creates Pedido)
- Create Venda from Pedido

assert the target Cliente exists and cadastro/cliente status is `aprovado`. Orçamentos may be drafted for prospects without this gate.

## Helpers (contract)

```ts
requireSession(surface: "loja" | "saas")
requireCustomer()
requireSaasRole(...roles: Array<"admin" | "vendedor">)
requirePermission(...bits: string[]) // Phase E — admin short-circuit; else CustomRole bits
requireClienteAprovado(clienteId: string)
assertTenantScope(row.tenant_id, session.tenantId)
assertConversationVisible(session, conversation)
assertInboxMember(session, inboxId) // when needed for channel reads
```

Domain services call these; UI does not re-implement authorization.

## Logging

Log `tenant_id`, `user_id`, `surface`, `action`. Do **not** log full CNPJ, raw WhatsApp, passwords, or full session tokens. Mask as last4 only when a debugger field is required.
