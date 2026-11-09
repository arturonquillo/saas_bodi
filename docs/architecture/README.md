# Architecture — Casa dos Frios CRM + atacado

Contracts for frontend and backend. Product behavior stays in `docs/product/`. Visual tokens stay in `docs/design/` (when design lands). Do not reopen locked product decisions here.

This set **supersedes** the former `saas_frota` dual-channel / Account / AI-import architecture. The monorepo still runs Next.js + Prisma; the domain model and surfaces below match `docs/product/spec.md`. **Chatwoot-parity desk** evolves the simulated inbox — see [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) and `docs/product/chatwoot-parity.md`.

| Doc | Owns |
|---|---|
| [stack.md](./stack.md) | Runtime, folders, how to run — **stack locked here** |
| [data-model.md](./data-model.md) | Entities, indexes, Orçamento → Pedido → Venda machines, stock, CRM Phase A+ |
| [api.md](./api.md) | Endpoints, authz notes, error envelope, CRM Phase A surface |
| [openapi.yaml](./openapi.yaml) | Machine-readable HTTP contract (subset; types in `packages/shared` are canonical) |
| [authz.md](./authz.md) | RBAC (`admin` \| `vendedor`), cadastro gate, CRM visibility, sessions |
| [threats.md](./threats.md) | IDOR, tax-ID leak, WA secrets, webhook SSRF, stub confusion |
| [seed.md](./seed.md) | Tenant `casa-dos-frios` exact contract |
| [ports.md](./ports.md) | CNPJ registry, outbox stub, channel simulate/send, credential vault, jobs/egress |
| [jobs-realtime.md](./jobs-realtime.md) | SSE realtime, domain events, background jobs, SSRF guard |
| [crm-chatwoot-parity.md](./crm-chatwoot-parity.md) | Chatwoot-parity decisions, Phase A–C contracts, migration |
| [ownership.md](./ownership.md) | Who may edit which folders |

## Module map

| Module | Responsibility | Surfaces |
|---|---|---|
| **Tenancy** | `tenants`, slug resolution, tenant-scoped queries | all |
| **Identity / Auth** | Users, memberships, password hash, sessions, cookies | SaaS + Loja |
| **RBAC** | `admin` \| `vendedor` enforced in API | SaaS |
| **Cadastro B2B** | Solicitação CNPJ → Cliente; approval gate; Contact/Company link | SaaS + Loja |
| **CRM desk** | Conversation / Contact / Inbox + Phase B operator power + Phase C campaigns / help center / reports | SaaS |
| **Sales pipeline** | Orçamento → Pedido de venda → Venda/Faturamento | SaaS + Loja (own docs) |
| **Catalog / Stock** | One ledger (`on_hand`/`reserved`); Loja projection | SaaS + Loja |
| **Notifications** | `notification_outbox` stub (email/WhatsApp); category discriminator | SaaS (read) |
| **Jobs / realtime** | Domain events, SSE, background job tick | SaaS |
| **Theme** | Brand tokens consumed by SaaS + Loja | both |
| **Account (billing)** | **Out of MVP** — no module, no routes, no entitlement gate |

## Non-negotiables

- Every operational row has `tenant_id`; authenticated APIs take tenant from the session only.
- One inventory ledger; Loja never owns a second stock table.
- Cadastro `aprovado` required before Pedido create / Orçamento→Pedido / Venda (`Cliente` gate — Contact alone never authorizes).
- One CRM desk: Conversation model replaces parallel `whatsapp_threads` writes after Phase A migration.
- Outbox + WA channel stay stubs — no Meta Cloud API, no required SMTP, no NF-e; WA credentials encrypted, status ≤ `ready_stub`.
- No Account chrome or subscription entitlement in MVP.

## Handoff

| Specialist | Uses |
|---|---|
| **design** | Surfaces + states from product + CRM desk IA; tokens in `docs/design/` |
| **frontend** | [api.md](./api.md) + [authz.md](./authz.md) + CRM Phase A–C; saas-starter shell; no invented routes |
| **backend** | Full set + [seed.md](./seed.md) + [ports.md](./ports.md) + [jobs-realtime.md](./jobs-realtime.md); Prisma migrations |
| **qa** | [seed.md](./seed.md) + `docs/product/mvp-acceptance.md` + Phase A–C acceptance in product parity brief |
