# Architecture — Casa dos Frios CRM + atacado

Contracts for frontend and backend. Product behavior stays in `docs/product/`. Visual tokens stay in `docs/design/` (when design lands). Do not reopen locked product decisions here.

This set **supersedes** the former `saas_frota` dual-channel / Account / AI-import architecture. The monorepo still runs Next.js + Prisma; the domain model and surfaces below match `docs/product/spec.md`.

| Doc | Owns |
|---|---|
| [stack.md](./stack.md) | Runtime, folders, how to run — **stack locked here** |
| [data-model.md](./data-model.md) | Entities, indexes, Orçamento → Pedido → Venda machines, stock |
| [api.md](./api.md) | Endpoints, authz notes, error envelope |
| [openapi.yaml](./openapi.yaml) | Machine-readable HTTP contract (subset; types in `packages/shared` are canonical) |
| [authz.md](./authz.md) | RBAC (`admin` \| `vendedor`), cadastro gate, sessions |
| [threats.md](./threats.md) | IDOR, tax-ID leak, client-trusted fields, stub confusion |
| [seed.md](./seed.md) | Tenant `casa-dos-frios` exact contract |
| [ports.md](./ports.md) | CNPJ registry, outbox stub, WhatsApp inbox simulator |
| [ownership.md](./ownership.md) | Who may edit which folders |

## Module map

| Module | Responsibility | Surfaces |
|---|---|---|
| **Tenancy** | `tenants`, slug resolution, tenant-scoped queries | all |
| **Identity / Auth** | Users, memberships, password hash, sessions, cookies | SaaS + Loja |
| **RBAC** | `admin` \| `vendedor` enforced in API | SaaS |
| **Cadastro B2B** | Solicitação CNPJ → Cliente; approval gate | SaaS + Loja |
| **CRM Inbox** | Simulated WhatsApp threads/messages + intent tags | SaaS |
| **Sales pipeline** | Orçamento → Pedido de venda → Venda/Faturamento | SaaS + Loja (own docs) |
| **Catalog / Stock** | One ledger (`on_hand`/`reserved`); Loja projection | SaaS + Loja |
| **Notifications** | `notification_outbox` stub (email/WhatsApp) | SaaS (read) |
| **Theme** | Brand tokens consumed by SaaS + Loja | both |
| **Account (billing)** | **Out of MVP** — no module, no routes, no entitlement gate |

## Non-negotiables

- Every operational row has `tenant_id`; authenticated APIs take tenant from the session only.
- One inventory ledger; Loja never owns a second stock table.
- Cadastro `aprovado` required before Pedido create / Orçamento→Pedido / Venda.
- Outbox + inbox stay stubs — no Meta Cloud API, no required SMTP, no NF-e.
- No Account chrome or subscription entitlement in MVP.

## Handoff

| Specialist | Uses |
|---|---|
| **design** | Surfaces + states from product; tokens later in `docs/design/` |
| **frontend** | [api.md](./api.md) + [authz.md](./authz.md); hide illegal transitions; no invented routes |
| **backend** | Full set + [seed.md](./seed.md) + [ports.md](./ports.md); Prisma migrations |
| **qa** | [seed.md](./seed.md) + `docs/product/mvp-acceptance.md` |
