# Casa dos Frios — SaaS CRM + atacado agents

Multi-tenant-ready SaaS for Brazilian **wholesale distributors**, branded first for **Casa dos Frios** (distribuidor atacadista, preferência carnes): worker **SaaS** (CRM + sales pipeline), public **Loja**, and (later) an **Account** site to sell the product to other companies.

Product source of truth: `docs/product/spec.md`. MVP brief: `docs/product/mvp.md`. Acceptance: `docs/product/mvp-acceptance.md`. Overview: `docs/product/brief.md`. Open questions needed to build are locked in the spec — do not reopen them in implementation.

## Specialists (use these)

| Invoke | Owns |
|---|---|
| `/product` | Features, research, specs, priority. Commands the others. |
| `/architect` | Structure, tenancy, security, performance, contracts. |
| `/design` | UX, visual system, theme tokens, states. |
| `/frontend` | Loja, SaaS, (later) Account UI. |
| `/backend` | APIs, domain, jobs, integrations. |
| `/qa` | Test plans, automated tests, regressions, sign-off. |

Custom subagents live in `.cursor/agents/`. They start with empty context — pass the brief path and constraints in the prompt.

## Default build sequence

1. **product** — problem, scope, brief in `docs/product/`.
2. **architect** — boundaries, data, authz, threats (`docs/architecture/`).
3. **design** — flows and tokens (`docs/design/`).
4. **frontend** + **backend** in parallel against those contracts.
5. **qa** — acceptance, roles, regressions; add tests; PASS/FAIL.
6. **architect** review if the change touches tenancy, sales docs, stock, identity, or billing.

Skip steps only for tiny, single-surface fixes. If the user names a specialist, go straight to that agent.

## Hard product constraints

- Tenant-ready isolation; MVP seeds **Casa dos Frios** only. RBAC: `admin`, `vendedor` (more roles later).
- Wholesale **cadastro (CNPJ)** must be `aprovado` before Pedido de venda / Venda.
- Sales pipeline locked: **Orçamento → Pedido de venda → Venda/Faturamento** (`docs/product/spec.md`).
- Loja stock is a configurable **projection** of one storage ledger (never a second ledger).
- CNPJ checksum + public registry lookup on cadastro; LGPD (mask; do not log full tax IDs).
- Status changes notify customer and seller via email and/or WhatsApp **outbox stubs**.
- WhatsApp is first-class: simulated **inbox** + stub **outbox** in MVP — do not silently add unpaid Meta Cloud API.
- Brand/colors via theme module; logo placeholder until provided. pt-BR only.
- **UI kit:** Loja and SaaS use **shadcn/ui**. Design specifies the shadcn inventory; frontend does not invent a parallel CSS kit.
- **Account** (selling this SaaS) and **native app** are later phases — do not mix product-billing chrome into operational SaaS nav.

Do not invent a second stock ledger, trust the client for roles/prices/stock, or replace documented stubs with unpaid provider integrations.

MVP transport stubs (outbox for email/WhatsApp, simulated WhatsApp inbox, Venda/Faturamento without NF-e) stay documented stubs.
