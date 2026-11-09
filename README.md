# Casa dos Frios — SaaS CRM + atacado

Multi-tenant-ready wholesale CRM: **SaaS** (`/saas`) + public **Loja** (`/loja`). Account billing site and native app are later phases (not in MVP).

Product: `docs/product/spec.md`. Architecture: `docs/architecture/`. Design: `docs/design/` (after architect).

## Run locally

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- Loja: http://localhost:3000/loja
- SaaS: http://localhost:3000/saas

SQLite file: `prisma/dev.db`. No Docker required. Stack locked in `docs/architecture/stack.md`.

## Seed (`casa-dos-frios`)

Password for every user: `Demo@1234`

| Email | Surface / role |
|---|---|
| `admin@casadosfrios.local` | SaaS admin |
| `vendedor@casadosfrios.local` | SaaS vendedor |
| `cliente@mercadoexemplo.local` | Loja, Cliente aprovado (CNPJ) |
| `prospecto@novaloja.local` | Loja, cadastro pendente |

Full contract: `docs/architecture/seed.md`.

## Hard rules

- Tenant isolation readiness; RBAC `admin` \| `vendedor`.
- One stock ledger; Loja is a projection.
- Cadastro CNPJ `aprovado` before Pedido / Venda.
- WhatsApp = simulated inbox + outbox stub (no Meta in MVP).
- No Account chrome in SaaS nav.

Folder owners: `docs/architecture/ownership.md`.
