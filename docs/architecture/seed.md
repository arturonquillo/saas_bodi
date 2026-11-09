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

## CRM desk (Phase A — Chatwoot-parity)

After Phase A migration, seed **must** realize:

| Object | Contract |
|---|---|
| Default WhatsApp **Inbox** | One per tenant; all seed agents are InboxMembers |
| **ChannelWhatsapp** | `connection_status=ready_stub` or `credentials_saved`; stub templates JSON ≥1 row; secrets sealed or empty with `not_configured` only if intentionally demoing empty state — prefer `ready_stub` with sealed placeholder secrets |
| System **Labels** | `intent:cadastro`, `intent:orcamento`, `intent:info_empresa`, `intent:outro` |
| **Team** | e.g. “Vendas” with admin + vendedor members |
| **CannedResponse** | ≥1 shortcode |
| **Conversations** | ≥1 per intent label (migrated from old threads); status `open` except one `resolved` optional |
| **Contacts** | One per conversation phone; approved Cliente linked via `Contact.cliente_id` + Company CNPJ |
| **Messages** | `simulated=true` on simulator/seed paths |
| Agent notification prefs | rows for admin + vendedor |

Until Phase A ships, legacy seed “one thread per intent” remains acceptable; migration must map them as above.

## CRM desk (Phase B — when that phase seeds)

Additive on top of Phase A seed (do not remove A objects):

| Object | Contract |
|---|---|
| Inbox `timezone` | `America/Sao_Paulo`; WorkingHour Mon–Fri open 08:00–18:00; Sat/Sun `closed_all_day` |
| `csat_enabled` | true on default WA inbox |
| CustomAttributeDefinition | ≥1 conversation + ≥1 contact attribute (e.g. list/text) |
| AutomationRule | ≥1 inactive **or** active demo rule (prefer inactive in seed to avoid surprise jobs); event `message_created` |
| Macro | ≥1 `public` (admin-owned actions: add_label or resolve) + optional private for vendedor |
| AssignmentPolicy | default inbox `round_robin` **disabled** until demo wants it |
| AgentBot | optional; if present `active=false` and URL `https://example.com/bot` (deliver still guarded; do not call in seed tick) |
| Webhook | optional inactive; tenant `webhook_signing_secret` always generated |
| CsatResponse | optional one row on a resolved conversation for Relatórios later |
| CustomFilter | optional personal filter for admin |

Seed must **not** enqueue live egress to example.com on boot. Job kinds idle until operators enable rules/bots.

## CRM desk (Phase C — when that phase seeds)

Additive on top of Phase A+B seed:

| Object | Contract |
|---|---|
| **Campaign** one_off | ≥1 `draft` targeting a system or demo label; `inbox_id` = default WA; `template_key` present in channel stub templates; **do not** auto-send on boot |
| **Campaign** ongoing | optional `draft` with `display_status=awaiting_widget` |
| **Portal** | one enabled portal, slug e.g. `casa-dos-frios-ajuda`, locale `pt-BR` |
| **Category** | ≥1 category |
| **Article** | ≥1 `published` + ≥1 `draft` (public API must 404 the draft) |
| **Reports** | no mandatory snapshot rows; seed conversations/CSAT from A/B enough for overview queries |

Seed must **not** enqueue `campaign.send_batch` on boot. Outbox seed rows remain `category=commerce` unless an explicit demo campaign row is added (prefer none).

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
