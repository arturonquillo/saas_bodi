# Brief — pivot to Casa dos Frios CRM + atacado

## Problem

Replace the old `saas_frota` dual-channel commerce MVP framing with a **CRM-first wholesale** product for **Casa dos Frios**, designed so the same SaaS can later be sold multi-tenant / white-label.

## Who

- Primary operator: vendedores and admin at Casa dos Frios.
- Primary customer: CNPJ buyers who must **cadastrar** before buying.
- Later: other distributor tenants buying this SaaS (out of MVP).

## Scope (in / out)

**In:** SaaS foundation; WhatsApp CRM inbox (stub/simulated); cadastro; Orçamento → Pedido → Venda/Faturamento; loja pública; seed Casa dos Frios; pt-BR + LGPD; thin estoque ledger.

**Out of MVP (tracked):** Account billing; live Meta API; NF-e/PIX; native app; estoquista/entregador; AI stock chat; varejo/CPF; multi-lista de preços.

**Post-MVP product commitment:** full **Chatwoot feature parity** evolving the simulated inbox — see `docs/product/chatwoot-parity.md`. WhatsApp remains **listo para conectar** (config/UI/contracts) without live Meta until unlocked.

**Inventory upgrade:** full product master + stock control + line discount vs single lista — `docs/product/inventory.md` (one ledger; Loja projection).

## UX surfaces

- **SaaS** — admin + CRM + pipeline + estoque (thin → full per `inventory.md`).
- **Loja** — brand, catalog, WhatsApp, cadastro, buy if aprovado.
- **Account / App** — later / phase 2.

## Permissions

`admin` | `vendedor` | cliente aprovado (loja). Matrices locked in `spec.md`.

## Data and integrations

CNPJ registry port; WhatsApp outbox stub + simulated inbox; email outbox optional; no Meta; no SaaS subscription provider.

## Acceptance criteria

See `mvp-acceptance.md`. Demo seed `casa-dos-frios` in one sitting.

## Specialist tasks

- architect: tenant-ready contracts, state machines, stubs.
- design: pt-BR flows + Casa dos Frios tokens (shadcn).
- frontend / backend: implement against contracts (after this brief).
- qa: acceptance sign-off.

Full detail: `spec.md`, `mvp.md`. CRM desk roadmap: `chatwoot-parity.md`. Estoque upgrade: `inventory.md`.
