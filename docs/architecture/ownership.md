# Folder ownership

Frontend and backend implement in parallel against these contracts. Do not invent a second path for the same concept.

| Path | Owner | Others |
|---|---|---|
| `docs/product/` | product | read-only |
| `docs/design/` | design | frontend consumes tokens; do not fork names |
| `docs/architecture/` | architect | propose via review; do not silently diverge |
| `packages/shared/` | architect (types) | both import; PRs that change enums need architect/product if behavior changes |
| `prisma/schema.prisma` | architect lock / backend migrations | frontend never writes SQL here |
| `prisma/migrations/` | backend | |
| `prisma/seed.ts` | backend (must match [seed.md](./seed.md)) | |
| `apps/web/app/api/` | backend | frontend only calls; do not add routes here |
| `apps/web/src/server/` | backend | |
| `apps/web/app/(loja)/` | frontend | |
| `apps/web/app/(saas)/` | frontend | **no Account/billing links** |
| `apps/web/src/ui/` | frontend | theme CSS variable application |
| `apps/web/app/globals.css` | frontend + design | map `docs/design/` tokens |

Legacy `(conta)` / Account paths are **not** owned for MVP — do not extend them. Delete or quarantine when implementing the pivot.

## Do not conflict

- **Stock qty** — only `inventory_balances` + `inventory_movements`. Loja UI reads `GET /api/loja/catalogo` (projection `ativo && visivel_loja`). Never a `store_stock` table or client-side ledger. Contracts: [inventory.md](./inventory.md).
- **Prices / discount** — one list price `preco_atacado_centavos`; SaaS line `desconto_pct` with cap; server freezes list + discount + net. Client must not submit a trusted unit/net price. No price-list entity this phase.
- **Roles** — session + membership (`admin` \| `vendedor`). Client must not send `saas_role`.
- **Theme** — one `themes` row per tenant. Loja and SaaS GET the same tokens.
- **Cadastro gate** — Pedido / Venda / Orçamento→Pedido only when Cliente (or linked cadastro) is `aprovado`. Enforced in domain, not only UI.
- **Sales docs** — three document types (Orçamento, Pedido, Venda), not a single legacy `Order` status machine.
- **WhatsApp / CRM** — one desk under Conversation APIs; inbound via simulate port; agent send via stub channel port; commerce outbound via outbox stub. No Meta SDK until product unlock. Channel secrets encrypted. Phase B automations/bots/webhooks = queued jobs + SSRF guard only. Phase C campaigns = stub outbox (`category=campaign`) only; Help Center + reports per [crm-chatwoot-parity.md](./crm-chatwoot-parity.md). Phase D = non-WA channel configs ≤ `ready_stub` + first-party Loja widget onto the same Conversation model — no live social/SMS/SMTP. Phase E = SLA, capacity, Captain stubs, audit, SAML/MFA, custom roles, integration connect-stubs, voice ≤ `ready_stub` — no unpaid live Meta/Slack/IdP/telephony/Captain model. Architecture owns CRM contracts.
- **Account / entitlement** — absent. No `subscription_status` write path; seed tenant is always operational.

If a screen needs data that is not in [api.md](./api.md), add the endpoint in architecture first — do not grow an ad-hoc BFF in a Server Component.
