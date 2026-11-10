# Desenvolvimento — Casa dos Frios

Como rodar, migrar, seedar e apontar o ambiente de QA. Stack locked: [`docs/architecture/stack.md`](../architecture/stack.md). Seed contract: [`docs/architecture/seed.md`](../architecture/seed.md).

## Pré-requisitos

- Node.js 20+ recomendado
- npm (workspaces)
- Sem Docker obrigatório (SQLite local)

## Setup local

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

| URL | Superfície |
|---|---|
| http://localhost:3000/loja | Loja |
| http://localhost:3000/saas | SaaS |
| http://localhost:3000/api/health | Health |

Contas: [`docs/user/contas-seed.md`](../user/contas-seed.md). Senha demo: `Demo@1234`.

## Scripts (raiz do monorepo)

| Script | Ação |
|---|---|
| `npm run dev` | Next.js em `:3000` (`apps/web`) |
| `npm run build` | Build de produção |
| `npm run start` (workspace web) | Serve build |
| `npm run lint` | ESLint |
| `npm run test` | Testes do workspace web |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate deploy` + generate |
| `npm run db:migrate:dev` | `prisma migrate dev` (criar migration) |
| `npm run db:seed` | Seed tenant `casa-dos-frios` |
| `npm run db:reset` | Wipe SQLite → migrate → seed |

DB file: `prisma/dev.db` (via `DATABASE_URL=file:./dev.db` relativo ao schema).

## Variáveis (`.env.example`)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | SQLite Prisma |
| `SESSION_SECRET` | HMAC cookies de sessão |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` | `casa-dos-frios` |
| `CNPJ_REGISTRY_ENABLED` | `false` = port degrada (checksum continua) |
| `WHATSAPP_INBOX_MODE` | `simulate` |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM (base64 32 bytes) para segredos de canal |

Não commitar segredos reais. Cookies: `cdf_sessao_saas` / `cdf_sessao_loja`.

## Migrações CRM (Chatwoot A–E)

As migrations Prisma sob `prisma/migrations/` incluem as fases de parity (`chatwoot_parity_phase_a` … `_e`). Em tip atual:

```bash
npm run db:migrate   # apply pending
npm run db:seed      # A–E seed objects (stubs; sem egress live)
```

Após mudar schema: `npm run db:migrate:dev` com nome descritivo; atualize `docs/architecture/` + seed contract se o contrato mudar.

## Deploy QA (test3)

Ambiente público de demo/QA:

| Item | Valor |
|---|---|
| Host | https://test3.lecrunch.com.br |
| Loja | https://test3.lecrunch.com.br/loja |
| SaaS | https://test3.lecrunch.com.br/saas |
| Health | https://test3.lecrunch.com.br/api/health |

**Runbook detalhado (VPS, systemd, Caddy, histórico de redeploys A–E):** no Project Cursor Agent Store, arquivo estável  
`docs/lecrunch-test3-deploy.md` (não versionado neste monorepo). Domínio livre futuro: store `docs/lecrunch-free-domain.md`.

Cheatsheet resumido (não substitui o runbook):

```bash
ssh lecrunch-vps
cd /opt/casa-dos-frios
git fetch origin <branch>
git reset --hard origin/<branch>
# CREDENTIALS_ENCRYPTION_KEY no .env
npm ci && npm run db:migrate && npm run db:seed && npm run build
systemctl restart casa-dos-frios
# Widget: incluir https://test3.lecrunch.com.br em allowed_origins da caixa widget
```

Processo: systemd `casa-dos-frios` na porta **3013**; Caddy `test3.lecrunch.com.br` → host:3013. Não alterar `test1`/`test2`/`test4` sem pedido explícito.

## Estrutura útil

```
apps/web/          # Next.js App Router — (loja) + (saas) + api/
packages/shared/   # enums / DTOs
prisma/            # schema, migrations, seed.ts
docs/              # product, architecture, design, user, dev, CHANGELOG
```

Ownership de pastas: [`docs/architecture/ownership.md`](../architecture/ownership.md).

## Documentação viva

Todo PR que mude comportamento de operador, scripts, env ou deploy deve atualizar `docs/user/` e/ou este arquivo + [`docs/CHANGELOG.md`](../CHANGELOG.md). Ver [`docs/README.md`](../README.md#documentação-viva).
