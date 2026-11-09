# MVP — Casa dos Frios CRM + loja atacado

Vertical slice for a Brazilian wholesale distributor demo in one sitting. Behavior source of truth: `docs/product/spec.md`. Checks: `docs/product/mvp-acceptance.md`. Overview: `docs/product/brief.md`. **Post-MVP CRM desk:** `docs/product/chatwoot-parity.md` (does not expand this MVP slice). Stack is **not** chosen here.

## Problem

Casa dos Frios cannot today run WhatsApp-led cadastro + orçamento → venda in one system with a public loja. The MVP is that path: SaaS foundation, CRM inbox, locked sales pipeline, thin storefront — not a brochure of multi-tenant billing or native apps.

## Who

| Actor | Job in the demo |
|---|---|
| **Prospecto** | Pede cadastro (loja ou WhatsApp simulado); espera aprovação |
| **Cliente atacado (CNPJ aprovado)** | Vê catálogo, compra na loja, aceita orçamento, recebe avisos |
| **Vendedor** | Inbox WhatsApp, orçamentos, pedidos, faturamento stub, aprova cadastros |
| **Admin** | Users/RBAC, tema, config, tudo do vendedor + painel admin |

Success metric: seed `casa-dos-frios`, every actor completes their step without Meta API, without Account billing chrome, without a second stock ledger.

## Scope (in / out)

### In

- SaaS: login, users, RBAC (`admin` / `vendedor`), secure sessions, admin panel.
- CRM: simulated WhatsApp inbox (intents `cadastro`, `orcamento`, `info_empresa`, `outro`).
- Cadastro B2B CNPJ: `pendente` → `aprovado` | `recusado`; gate on Pedido/Venda.
- Pipeline: **Orçamento → Pedido de venda → Venda/Faturamento** (statuses + who transitions in the spec).
- Notifications: outbox stub on cadastro and document status changes (customer + vendedor).
- Loja: marca Casa dos Frios, catálogo (projection), WhatsApp CTA, cadastro, compra se aprovado, meus docs.
- Thin stock ledger + `visivel_loja`; `preco_atacado` (+ optional MOQ).
- Theme tokens; logo placeholder.
- pt-BR, LGPD masking, CNPJ checksum + registry degrade.
- Seed tenant only; schema tenant-ready.

### Out

- Account site / selling this SaaS / self-serve tenants / white-label domains.
- Native app (phase 2).
- Meta WhatsApp Cloud API; required SMTP.
- NF-e, PIX, payment capture, returns, partial faturamento.
- Roles estoquista/entregador; AI inventory chat; varejo/CPF sales; analytics; i18n.

### Locked decisions (do not reopen in implementation)

1. Pipeline and matrices in `docs/product/spec.md`.
2. WhatsApp = outbox stub + simulated inbox (parity desk is post-MVP; see `chatwoot-parity.md`).
3. Cadastro CNPJ aprovado before Pedido/Venda.
4. Roles = admin + vendedor only.
5. Seed `casa-dos-frios`; no onboarding wizard; no Account entitlement gate.
6. Loja default: cliente aprovado cria Pedido direto; orçamento via CRM/WhatsApp (and accept in loja when sent).

## UX surfaces

Copy **pt-BR**. Theme on SaaS + Loja.

### SaaS

- Login / logout / session expiry messaging.
- Admin: usuários, papel, desativar; perfil tenant; canais; tema; simular mensagem WhatsApp; outbox.
- Inbox: threads, intent tag, link to cadastro/orçamento.
- Cadastros: list + approve/refuse.
- Orçamentos / Pedidos / Vendas: list + detail + legal transitions only.
- Catálogo/estoque: SKU CRUD thin, on-hand, reserved, available, visibility.

### Loja

- Página pública da marca + catálogo.
- CTA WhatsApp.
- Form de cadastro.
- Login cliente; compra; meus orçamentos/pedidos.
- Aceitar/recusar orçamento `enviado`.

### Account

- **Not in MVP.**

## Permissions (summary)

API enforces; UI hides. Full sales matrices in the spec.

| Action | Admin | Vendedor | Cliente |
|---|---|---|---|
| Admin users / theme / config / simulate inbox | yes | | |
| Inbox + tag intents | yes | yes | |
| Approve/refuse cadastro | yes | yes | request only |
| Orçamento / Pedido / Venda transitions (per matrix) | yes | yes | accept/refuse own orçamento `enviado` |
| SKU / stock adjust | yes | read (+ create pedido lines from catalog) | projection |
| Outbox read | yes | yes | |

## Data and integrations

| Concern | MVP rule |
|---|---|
| CNPJ | Checksum always; public registry when up; else warn + `cnpj_registro_pendente` |
| WhatsApp out | `notification_outbox` stub |
| WhatsApp in | `whatsapp_inbox` simulated + seed + admin simulate |
| Email | Same outbox; not required |
| Billing of SaaS | N/A |
| Fiscal | Venda stub only |

## Acceptance criteria

Demonstrable on seed without wizard. Full list: `docs/product/mvp-acceptance.md`.

1. Admin manages a user; vendedor cannot open admin user management.
2. Simulated inbound cadastro → approve → cliente buys on loja → Pedido `confirmado` reserves stock.
3. Vendedor: orçamento `rascunho` → `enviado` → cliente aceita → Pedido → faturar stub → `faturado`; outbox rows exist.
4. Prospect without approval cannot place Pedido or convert orçamento.
5. Loja hides `visivel_loja=false`; zero available cannot buy.
6. No Meta calls; cross-tenant isolation ready (single seed, tenant_id on all rows).

## Specialist tasks

- **architect:** Tenant-ready model (even with one seed): users/roles/sessions, customers, cadastro requests, inbox threads/messages, orçamento/pedido/venda + lines + history, stock ledger, outbox, theme. RBAC + cadastro gate. CNPJ port. WhatsApp simulate ports. Threats: IDOR, tax-ID leakage, client-trusted prices/roles. Contracts for frontend/backend. No Account module. No Meta.
- **design:** pt-BR flows for SaaS (admin, inbox, pipeline) and Loja (marca-first hero, catálogo, cadastro, WhatsApp CTA). Tokens Casa dos Frios (not purple-default; logo placeholder). States: empty inbox, registry down, cadastro pending, expired orçamento. shadcn inventory only.
- **frontend:** Screens against contracts + tokens. Hide illegal transitions. Simulate-inbox UI for admin. No invented APIs.
- **backend:** Domain + APIs; closed state machines; reserve/consume/release; outbox; simulated inbox; seed; LGPD. Tests isolation/RBAC/stock/cadastro gate.
- **qa:** `mvp-acceptance.md` sign-off; PASS only if one-sitting demo works without Meta/Account.
