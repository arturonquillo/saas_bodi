# Seed contract — tenant `casa-dos-frios`

`npm run db:seed` must realize this table exactly. Password (dev only): `Demo@1234`.

There is **no** onboarding wizard. QA signs in with these emails. Default slug env: `NEXT_PUBLIC_DEFAULT_TENANT_SLUG=casa-dos-frios`.

## Tenant

| Field | Value |
|---|---|
| `slug` | `casa-dos-frios` |
| `nome_fantasia` | `Casa dos Frios` |
| `razao_social` | `Casa dos Frios Distribuidora LTDA` (or equivalent seed string) |
| `cnpj_digits` | valid checksum fixture (document in seed comments; mask in UI) |
| `whatsapp_comercial` | `+5511988877766` (fixture) |
| `canais_aviso` | `whatsapp` |
| `loja_modo` | `pedido_direto` |
| `default_vendedor_user_id` | user `vendedor@casadosfrios.local` |

## Theme (must be visibly non-default)

Until design locks hex values, seed **must not** ship purple-default / generic shadcn violet. Use a meat/cold-cut wholesale lean (example acceptable until `docs/design/` exists):

| Field | Value |
|---|---|
| `marca` | `Casa dos Frios` |
| `primary` | `#7A1F1F` (deep carmine) |
| `accent` | `#C4A35A` (warm brass) |
| `background` | `#F3EDE4` |
| `logo_url` | `null` (placeholder wordmark) |

Design may replace hex later without changing slug/marca.

## Users / memberships

| Email | Role / surface | Notes |
|---|---|---|
| `admin@casadosfrios.local` | SaaS `admin` | full admin |
| `vendedor@casadosfrios.local` | SaaS `vendedor` | default assignee |
| `cliente@mercadoexemplo.local` | Loja customer + Cliente `aprovado` | CNPJ buyer |
| `prospecto@novaloja.local` | Loja login + Cadastro `pendente` | cannot checkout |

Shared password: `Demo@1234`. All `ativo=true`.

### Cliente aprovado

| Field | Value |
|---|---|
| email | `cliente@mercadoexemplo.local` |
| CNPJ digits | `11222333000181` (valid checksum) |
| `cnpj_registro_pendente` | `false` |
| `razao_social` | `Mercado Exemplo LTDA` |
| whatsapp | `+5511911112222` |

### Cadastro pendente

| Field | Value |
|---|---|
| email | `prospecto@novaloja.local` |
| CNPJ digits | `34028316000103` (valid checksum; distinct) |
| status | `pendente` |
| `cnpj_registro_pendente` | `true` or `false` (either OK; show degrade path elsewhere in tests) |
| source | `loja` |

## SKUs (minimum, carnes/frios lean)

| `codigo` | MOQ | `visivel_loja` | Ledger | Purpose |
|---|---|---|---|---|
| `PICANHA-KG` | 1 | true | available &gt; 0 | happy path |
| `LINGUICA-CX` | **5** | true | available ≥ 5 | MOQ |
| `OCULTO-INTERNO` | 1 | **false** | any | hidden from Loja |
| `ESGOTADO-VITRINE` | 1 | true | **available = 0** | cannot buy |

Suggested balances:

| codigo | on_hand | reserved | available |
|---|---|---|---|
| `PICANHA-KG` | 40 | 5 | 35 |
| `LINGUICA-CX` | 30 | 0 | 30 |
| `OCULTO-INTERNO` | 10 | 0 | 10 |
| `ESGOTADO-VITRINE` | 3 | 3 | 0 |

`reserved` must match open Pedidos in `confirmado` / `em_separacao`.

## CRM inbox

At least one thread per intent: `cadastro`, `orcamento`, `info_empresa` (and optionally `outro`). Messages marked `simulated=true` where created via simulator/seed.

## Sales documents

| Doc | Status | Notes |
|---|---|---|
| Orçamento | `enviado` | linked to cliente aprovado **or** prospect; has `valido_ate` future; ≥1 line |
| Pedido | mid-pipeline e.g. `em_separacao` | cliente aprovado; reserves reflected in ledger |
| (optional) Venda | omit or `rascunho` | not required if mid-pipeline pedido exists |

Also acceptable: one additional orçamento `rascunho` for demo list density.

## Outbox

At least one `enviado` WhatsApp row for a notifying event (e.g. orçamento enviado or cadastro-related), payload without full tax IDs. Channel matches tenant `whatsapp`.

## Reset

`npm run db:reset` must return to this contract. Do not add a second tenant in the default seed (isolation tests create their own).
