# Stack

Locked for the Casa dos Frios MVP. Product did not choose a stack; this document is the source of truth. Change only if the architect reviews tenancy, identity, or deploy.

## Choice

**One Next.js 15 App Router app** (`apps/web`) with route groups `(loja)` and `(saas)` serving `/loja` and `/saas`. npm workspaces add `packages/shared` for enums and DTO types that both sides import.

A single app is the boring path a small team can demo today: one `npm install`, one Prisma schema, one SQLite file, one seed, one `npm run dev` on port 3000. The two chromes stay separate because each route group has its own layout and **must not** import the other surface’s nav. Loja and SaaS read the same tenant theme pipeline.

**Account (`(conta)`)** is **not** an MVP surface. Do not add `/conta` routes, Account cookies, or entitlement middleware. White-label selling of this SaaS is a later phase.

SQLite via Prisma is enough for local MVP. The schema stays Postgres-shaped (no SQLite-only types). `docker-compose.yml` is optional later; it is not required to run the demo.

The workspace package names may still say `@saas-frota/*` from the prior product framing. Treat that as a rename-later cosmetic; architecture contracts refer to `packages/shared` and `apps/web`. Do not block MVP on a package rename.

## Runtime

| Piece | Choice |
|---|---|
| Language | TypeScript, strict |
| UI + BFF | Next.js 15 (App Router, React 19) |
| UI kit | **shadcn/ui** (inventory from design) |
| API | Route handlers under `apps/web/app/api/` |
| Shared contract | `packages/shared` + `docs/architecture/openapi.yaml` |
| DB | SQLite file `prisma/dev.db` (Prisma) |
| Auth | HttpOnly session cookies, **one cookie per surface** (Loja + SaaS) |
| Validation | Zod on the server; shared unions in `packages/shared` |
| Locale | `pt-BR` (`<html lang="pt-BR">`) — no i18n |
| Theme | CSS variables from tenant `themes` row — names in `docs/design/` when present |
| Package manager | npm workspaces |

Do **not** add Stripe, Meta Cloud API, live social/SMS/SMTP/telephony providers, unpaid Slack/Captain/IdP live I/O, NF-e/SEFAZ, PIX, or a required SMTP provider. Outbox and channel adapters are stubs (see [ports.md](./ports.md)); Loja widget is first-party. Chatwoot-parity CRM is **native** in this app — do not embed Chatwoot OSS as a sidecar.

### CRM runtime add-ons (Phase A–E)

| Piece | Choice |
|---|---|
| Realtime (SaaS) | **SSE** (`/api/saas/crm/events/stream`) + presence POST — [jobs-realtime.md](./jobs-realtime.md) |
| Realtime (Loja widget) | Poll `mensagens?after=` + optional widget SSE — **no WebSocket** in D |
| Jobs | In-process `background_jobs` tick worker (+ E: `sla.evaluate`, `assignment.balanced`, Captain/integration stubs) |
| WA / channel / integration secrets | AES-256-GCM via `CREDENTIALS_ENCRYPTION_KEY` (+ MFA seal) |
| Channel / integration ceiling | channels ≤ `ready_stub`; integrations ≤ `connected_stub` (reject `live`) |
| Captain | `CaptainAiPort` stub default; live model only if unlock env |
| Desk IA | saas-starter admin shell + shadcn (design); Loja embed widget; E enterprise config screens |

## Folder map

```
saas_bodi/
  docs/product/            # product agent
  docs/design/             # design agent (after architect)
  docs/architecture/       # this contract
  packages/shared/         # enums, error codes, DTOs (no Prisma, no React)
  prisma/                  # schema + migrations + seed
  apps/web/
    app/
      (loja)/loja/         # Loja UI
      (saas)/saas/         # SaaS UI — no Account/billing links
      api/loja|saas|…      # HTTP, grouped by surface (+ identidade, health)
    src/server/            # domain, ports, authz, db
    src/ui/                # shared presentational (theme apply)
```

See [ownership.md](./ownership.md) before editing. Remove or leave dormant any legacy `(conta)` scaffolding — it must not appear in nav or MVP acceptance.

## How to run (local)

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

- Loja: http://localhost:3000/loja
- SaaS: http://localhost:3000/saas

Default tenant slug is `casa-dos-frios` (`NEXT_PUBLIC_DEFAULT_TENANT_SLUG`). Seed users: [seed.md](./seed.md).

### Scripts (repo root)

| Script | Action |
|---|---|
| `npm run dev` | Next.js on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Insert tenant `casa-dos-frios` |
| `npm run db:reset` | Wipe SQLite, migrate, seed |

### Environment

Copy `.env.example`. No production secrets belong in git.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` |
| `SESSION_SECRET` | HMAC for session cookies (dev placeholder only) |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` | `casa-dos-frios` |
| `CNPJ_REGISTRY_ENABLED` | `false` = port degrades (checksum still runs) |
| `WHATSAPP_INBOX_MODE` | `simulate` (no Meta webhook until product unlock) |
| `CREDENTIALS_ENCRYPTION_KEY` | base64 32-byte key for WA channel secret slots |

## Auth cookies

Two cookies — Account cookie is **out of MVP**:

| Cookie | Surface | Login path |
|---|---|---|
| `cdf_sessao_loja` | Loja | `POST /api/loja/login` |
| `cdf_sessao_saas` | SaaS | `POST /api/saas/login` |

`HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`. Session payload always includes `tenantId` + `surface`. APIs ignore client-supplied role, price, and stock.

Legacy cookie names (`sf_sessao_*`) must not be accepted once the pivot seed ships.

## Tenant resolution (local MVP)

No subdomain wizard. Public Loja reads `tenant` query **or** `NEXT_PUBLIC_DEFAULT_TENANT_SLUG`. Authenticated APIs take `tenantId` from the session only — never from a client body field the caller can spoof onto another tenant.

## What this stack is not

- Not three deployables.
- Not a second stock database for the loja.
- Not an Account / subscription product in MVP.
- Not Meta WhatsApp Cloud API or NF-e.
