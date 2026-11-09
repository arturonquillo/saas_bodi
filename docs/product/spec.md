# Product spec — Casa dos Frios CRM + atacado

Living spec. The **product** agent updates this when behavior changes. MVP brief: `docs/product/mvp.md`. Acceptance: `docs/product/mvp-acceptance.md`. Feature overview: `docs/product/brief.md`. **CRM desk parity:** `docs/product/chatwoot-parity.md` (full Chatwoot inventory + phases). Stack choices belong in `docs/architecture/` once the architect locks them.

This document **supersedes** the former `saas_frota` wholesale/retail MVP framing. Hard constraints from `AGENTS.md` still apply **unless** this spec explicitly replaces them below.

## Problem

**Casa dos Frios** (distribuidor atacadista, preferência carnes) precisa de um CRM operacional com WhatsApp como canal principal: receber pedidos de cadastro, orçamentos e dúvidas; converter orçamento em venda; e oferecer uma vitrine pública. O mesmo produto SaaS será vendido depois a outras empresas (white-label / multi-tenant).

## Brand and locale

| Item | Decision |
|---|---|
| Company (first tenant) | **Casa dos Frios** |
| Market | Brazil only |
| Language | **pt-BR** only (no i18n) |
| Logo | Placeholder until the user supplies the official asset |
| Vertical lean | Atacado; preferência carnes / frios (catalog can hold other SKUs) |

## Surfaces

| Surface | Audience | MVP? | Purpose |
|---|---|---|---|
| **SaaS** | Workers of the tenant | Yes | Login, admin, CRM inbox, sales pipeline, customers, thin catalog/stock |
| **Loja (storefront)** | Public + clientes cadastrados | Yes | Brand page, catalog, WhatsApp CTA, buy-on-site after cadastro |
| **Account (product billing)** | Buyers of *this* SaaS | **No — later** | Sell/subscribe the platform to other companies |
| **App nativo** | Same as loja | **No — phase 2** | Mobile app for customers |

Each paying company is a **tenant**. MVP ships **one seeded tenant** (`casa-dos-frios`). Schema and auth must be tenant-scoped from day one; self-serve onboarding and white-label selling are out of MVP.

## What this spec supersedes (from prior AGENTS / saas_frota)

| Prior constraint | New decision |
|---|---|
| Dual varejo+atacado (CPF→varejo, CNPJ→atacado) | **MVP is atacado-first.** Cadastro B2B with **CNPJ** required before sales. Varejo/CPF checkout is later. |
| Roles: supervisor, vendedor, estoquista, entregador | **MVP roles:** `admin`, `vendedor`. Fulfillment statuses exist but are operated by admin/vendedor (no dedicated warehouse/courier roles yet). |
| Account site with manual subscription flag gating ops | **Deferred.** No Account chrome in MVP. First tenant is always operational. Product billing comes when the SaaS is sold to others. |
| AI inventory chat with confirm | **Deferred** to a later inventory phase. |
| Order machine `novo→…→entregue` as the only sales doc | Replaced by **Orçamento → Pedido de venda → Venda/Faturamento** (below). |
| WhatsApp outbox only | Still **stub outbox** for outbound; MVP ships a **simulated inbox** (no Meta Cloud API). **Post-MVP CRM:** evolve that inbox into **Chatwoot feature parity** (`chatwoot-parity.md`) — WhatsApp channel remains **listo para conectar** (credentials/UI/contracts only) until paid Meta unlock. |

Still in force: tenant isolation readiness, RBAC enforced server-side, pt-BR, LGPD for tax IDs, CNPJ checksum + public registry when registering companies, store stock as a **projection** of one storage ledger (when stock is shown), shadcn/ui for UI, no trusting the client for roles/prices/stock, no unpaid Meta/SMTP integrations silently.

## SaaS foundation

Must exist before CRM features are useful:

1. **Login** — email + password; tenant-scoped session.
2. **Users** — admin invites/creates users; deactivate without deleting audit history.
3. **RBAC** — one SaaS role per user per tenant (`admin` | `vendedor`). Permissions enforced in the API; UI only hides.
4. **Secure sessions** — HTTP-only secure cookies (or equivalent), logout, session expiry; no role/tenant id trusted from the client body.
5. **Admin panel** — users, roles, tenant profile (razao social, nome fantasia, CNPJ, WhatsApp comercial), notification channel flags, theme tokens, read-only notification outbox + simulated inbox tools.

## CRM core

### WhatsApp inbox (first-class) → Chatwoot-parity desk

Inbound messages land in a tenant **inbox** (simulated in MVP). Each thread is tied to a phone (E.164 BR) and optionally a customer/prospect record.

**Product direction (locked in `chatwoot-parity.md`):** evolve this simulated inbox into a **native Chatwoot-parity CRM desk** (conversations, contacts, labels, teams, assignments, canned responses, automations, macros, CSAT, campaigns, help center, reports, agent bots, custom attributes, notifications, multi-channel inbox model, etc.). Do **not** add a second disconnected inbox product. Commerce pipeline and cadastro gates stay authoritative.

**MVP intent tags** (manual or rule-assisted; seed examples). Under parity Phase A these become **system labels** (and optional conversation custom attributes) with the same commerce outcomes:

| Intent / label | Meaning | Outcome |
|---|---|---|
| `cadastro` | Pedido de cadastro atacadista | Opens/updates a **Solicitação de cadastro** |
| `orcamento` | Pedido de orçamento / preços | Opens/updates an **Orçamento** draft or links to one |
| `info_empresa` | Dúvidas sobre a empresa | Handled in thread; no sales doc required |
| `outro` | Unclassified | Stays in inbox for vendedor |

**Conversation statuses (parity):** `open` \| `pending` \| `snoozed` \| `resolved` (Chatwoot enum). MVP simulator may keep a thinner thread model until Phase A lands.

**WhatsApp channel (parity):** admin UI + credential fields + contracts = **Pronto para conectar / listo para conectar**. Live Meta Cloud API / unpaid provider calls remain **forbidden**; simulate inbound + `notification_outbox` stay until product unlocks paid Meta.

Wholesale rule (locked): **no Pedido de venda and no Venda/Faturamento for a customer whose cadastro is not `aprovado`.** Orçamentos may be drafted for prospects, but converting to Pedido requires `aprovado`.

### Cadastro (B2B)

- Public loja form and/or WhatsApp intent `cadastro`.
- Required: CNPJ (checksum + public registry lookup), razao social (from registry when available), contact name, phone (WhatsApp), email.
- Statuses: `pendente` → `aprovado` | `recusado`.
- Who transitions: `admin` or `vendedor` may approve/refuse.
- On approve: create **Cliente** record; notify prospect (outbox).
- On refuse: notify with reason (free text, required).
- CNPJ registry down: checksum still required; UX warning; save `cnpj_registro_pendente`; approval still allowed.

CPF may be stored later for varejo; **MVP does not sell to CPF-only customers.**

## Sales pipeline (locked) — Odoo-style, Brazilian labels

Research baseline: Odoo Sales = Quotation → Sales Order → Delivery → Invoice → Payment. Brazilian ops language maps cleanly to **Orçamento → Pedido de venda → Venda/Faturamento**. MVP keeps delivery as statuses on the Pedido (no separate WMS module) and treats faturamento as a commercial document **stub** (no NF-e provider).

### Document chain

```
Orçamento  --(aceitar)-->  Pedido de venda  --(faturar)-->  Venda/Faturamento
```

One Orçamento produces at most one Pedido. One Pedido produces at most one Venda in MVP (full qty; partial invoice later).

### 1) Orçamento

| Status | Meaning |
|---|---|
| `rascunho` | Internal draft; customer not notified |
| `enviado` | Sent to customer (outbox WhatsApp and/or email) |
| `aceito` | Customer accepted (vendedor/admin records acceptance, or customer accepts in loja when logged in) |
| `recusado` | Customer declined |
| `expirado` | Past `valido_ate` without accept |
| `cancelado` | Cancelled internally |

Transitions:

| From → To | Admin | Vendedor | Cliente (loja) |
|---|---|---|---|
| → create `rascunho` | yes | yes | no |
| `rascunho` → `enviado` | yes | yes | no |
| `rascunho` → `cancelado` | yes | yes | no |
| `enviado` → `aceito` | yes | yes | yes (own orçamento only) |
| `enviado` → `recusado` | yes | yes | yes (own) |
| `enviado` → `cancelado` | yes | yes | no |
| `enviado` → `expirado` | system job or on read past date | | |
| `aceito` → creates Pedido `confirmado` | automatic on accept | | |

Rules:

- Lines snapshot SKU name, qty, unit price (atacado list), optional notes.
- `valido_ate` required before `enviado` (default +7 days from send).
- Accept is blocked if customer cadastro ≠ `aprovado` — vendedor must approve cadastro first (orçamento can stay `enviado`).
- Notify customer + responsible vendedor on every status change except create→`rascunho`.

### 2) Pedido de venda

Created only from `Orçamento.aceito` **or** by admin/vendedor for an already `aprovado` cliente (direct pedido; still atacado prices).

| Status | Meaning |
|---|---|
| `confirmado` | Commercial commitment; **reserves** stock |
| `em_separacao` | Being prepared |
| `despachado` | Left warehouse / handed to carrier; **consumes** stock |
| `entregue` | Delivered |
| `cancelado` | Cancelled before dispatch |

Transitions:

| From → To | Admin | Vendedor | Stock |
|---|---|---|---|
| create → `confirmado` | yes | yes | reserve |
| `confirmado` → `em_separacao` | yes | yes | none |
| `confirmado` → `cancelado` | yes | yes | release |
| `em_separacao` → `despachado` | yes | yes | consume |
| `em_separacao` → `cancelado` | yes | yes | release |
| `despachado` → `entregue` | yes | yes | none |
| cancel after `despachado` | no | no | n/a (returns later) |

Notify customer + vendedor on every status change.

### 3) Venda / Faturamento

Commercial close of the Pedido. **MVP stub:** no SEFAZ/NF-e, no payment gateway. Document proves the sale was “faturada” internally for CRM and demo.

| Status | Meaning |
|---|---|
| `rascunho` | Draft invoice doc linked to Pedido (created when user clicks Faturar) |
| `faturado` | Confirmed commercial invoice stub |
| `cancelado` | Cancelled stub (only from `rascunho`) |

Transitions:

| From → To | Admin | Vendedor | Gate |
|---|---|---|---|
| Pedido (`confirmado`+) → create Venda `rascunho` | yes | yes | Pedido not `cancelado`; no existing non-cancelled Venda |
| `rascunho` → `faturado` | yes | yes | — |
| `rascunho` → `cancelado` | yes | yes | — |

Notify customer + vendedor when status becomes `faturado`.

Payment collection and fiscal NF-e are **out of MVP** (documented later).

## Loja (storefront)

Public, branded for Casa dos Frios (tenant theme).

- **Hero / marca** — nome Casa dos Frios; logo placeholder.
- **Catálogo** — SKUs with `visivel_loja`; shows available = `max(0, on_hand - reserved)`.
- **WhatsApp CTA** — opens wa.me link with prefilled text in production config; in MVP the same CTA also logs a simulated inbound intent when using the demo simulator.
- **Cadastro** — form → `Solicitação de cadastro` `pendente`.
- **Compra no site** — only authenticated **cliente aprovado**; creates Pedido `confirmado` directly (or Orçamento `rascunho` if tenant flag `loja_modo` = `orcamento`; default MVP: **pedido direto** for listed SKUs, orçamento still available via WhatsApp/SaaS).
- **Meus pedidos / orçamentos** — own documents + status history.
- Guest checkout: **forbidden**.

Phase 2: native app with the same customer capabilities.

## Catalog and stock (thin)

- One storage ledger: `on_hand`, `reserved`, `available = on_hand - reserved`.
- Loja is a **projection** (`visivel_loja` + available) — never a second ledger.
- Admin maintains SKUs (name, sku, `preco_atacado`, qty, visibility). No AI file chat in MVP.
- Atacado MOQ optional per SKU (`qtd_min_atacado`, default 1).

## Notifications

- Channels per tenant: `email`, `whatsapp`, `ambos` (default `whatsapp` for Casa dos Frios).
- **Outbound MVP = `notification_outbox` stub** (`pendente` / `enviado` / `falha`). Adapters mark `enviado` without Meta Cloud API or required SMTP.
- **Inbound MVP = `whatsapp_inbox` simulated store** — seed threads + admin “simular mensagem” action. No webhook from Meta.
- Triggers: cadastro approve/refuse; every Orçamento/Pedido/Venda status change (except silent `rascunho` create); optional reply templates from inbox (still outbox rows).

## Identity, LGPD, security

- pt-BR copy on SaaS and Loja.
- CNPJ (and any future CPF): mask in UI; never log full values.
- Checksum módulo 11 always; CNPJ registry via public API port (e.g. BrasilAPI); degrade path documented above.
- Auth tenant-scoped; never trust client for role, price, or stock.
- Sessions: secure cookie, expiry, logout; password hashed server-side.

## Theme

- Editable by admin: brand name (seed “Casa dos Frios”), primary, accent, background, logo URL/upload (placeholder until real logo).
- SaaS and Loja consume the same tokens.
- No Account product chrome in MVP.

## Seed tenant

Slug: `casa-dos-frios`. No self-serve wizard.

| Email | Role |
|---|---|
| `admin@casadosfrios.local` | `admin` |
| `vendedor@casadosfrios.local` | `vendedor` |
| `cliente@mercadoexemplo.local` | Cliente aprovado (CNPJ) |
| `prospecto@novaloja.local` | Cadastro `pendente` |

Shared seed password (dev only): `Demo@1234`.

Also seed: SKUs (carnes/frios lean), one hidden SKU, one zero-available, inbox threads for each intent, one orçamento in `enviado`, one pedido mid-pipeline, theme tokens, channels `whatsapp`.

## Phased roadmap

### MVP (this spec)

- SaaS foundation (login, users, RBAC, sessions, admin).
- CRM inbox (simulated WhatsApp) + cadastro approval.
- Orçamento → Pedido → Venda/Faturamento stub with notifications outbox.
- Loja pública (marca, catálogo, WhatsApp CTA, cadastro, compra se aprovado).
- Single seed tenant Casa dos Frios; tenant-ready data model.
- pt-BR, LGPD, CNPJ validation.

### Stubbed in MVP (explicit)

| Capability | Stub |
|---|---|
| WhatsApp outbound | Outbox row; no Meta API |
| WhatsApp inbound | Simulated inbox + seed; no Meta webhooks |
| Email | Outbox row; SMTP optional later |
| Venda/Faturamento | Internal stub document; no NF-e / SEFAZ |
| Payments | Not collected |
| Multi-tenant selling | One seed tenant; no Account billing site |

### Later (explicitly out of MVP)

- Account site to sell this SaaS; self-serve tenant onboarding; white-label domains.
- Native customer app (phase 2).
- **Chatwoot parity desk** phases A→E — full inventory in `docs/product/chatwoot-parity.md` (evolves simulated inbox; WhatsApp stays stub until paid Meta).
- Meta WhatsApp Cloud API (paid) replacing stubs (unlock after credentials “live”).
- NF-e, PIX/payment gateway, returns, partial invoice.
- Roles estoquista / entregador; courier assignment; multi-warehouse.
- AI inventory import; varejo/CPF channel; i18n (Help Center multi-locale is parity Phase E).

## Open questions

**Resolved for MVP** (do not reopen unless product updates this spec):

| Question | Decision |
|---|---|
| Sales pipeline | Orçamento → Pedido de venda → Venda/Faturamento with statuses/matrices above |
| WhatsApp | Stub outbox + simulated inbox; no Meta until paid integration is approved. Parity desk: credentials UI “pronto para conectar”; evolve inbox per `chatwoot-parity.md` |
| CRM desk scope | Full Chatwoot feature parity committed; phased A–E; omit only with explicit phase-later justification in that brief |
| Cadastro gate | CNPJ cadastro `aprovado` required before Pedido/Venda |
| First tenant | Casa dos Frios seed; multi-tenant sell later |
| Roles | `admin` + `vendedor` only |
| Loja buy path | Default direct Pedido for aprovado; orçamentos via CRM/WhatsApp |
| Account / SaaS billing | Out of MVP |
| Logo | Placeholder |

**Blocking open questions:** none for MVP build start. Non-blocking later: Meta WABA ownership, fiscal NF-e provider, native app store accounts.
