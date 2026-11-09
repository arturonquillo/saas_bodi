# Threats

MVP threat notes. Blockers if a PR ships the failure mode.

## Tenant isolation / IDOR

**Risk:** Authenticated user on tenant A reads B’s inbox, cadastros, orçamentos, pedidos, outbox, or stock.

**Rule:** Every query includes `tenant_id = session.tenantId`. Foreign ids that fail the scope check return **404** `nao_encontrado`. Do not accept `tenant_id` from the JSON body on authenticated routes.

**Tests:** seed a second tenant fixture in backend tests (not in demo seed); prove 404.

## Client-trusted role, price, stock

**Risk:** Body includes `saas_role`, `unit_price_centavos`, `available`, or `on_hand` and the server persists it.

**Rule:** Role from `memberships`. Unit price from SKU `preco_atacado_centavos` at line freeze. Qty from `inventory_balances`. Strip unknown/trusted fields in Zod.

## Cadastro gate bypass

**Risk:** Prospect creates Pedido, accepts Orçamento into Pedido, or opens Venda without `aprovado`.

**Rule:** Domain `requireClienteAprovado` on those writes. UI hide is insufficient. Return **403** `cadastro_nao_aprovado` with no stock/outbox side effects.

## Tax ID leakage (LGPD)

**Risk:** Full CNPJ in logs, URLs, outbox payload, HTML, or error messages.

**Rule:** Persist digits; expose `cnpj_last4` + mask (`**.***.***/****-00`). URLs use opaque ids. Structured logs: last4 only. Never put CNPJ in query strings.

## WhatsApp stub confused with production

**Risk:** Someone wires Meta Cloud API webhooks or outbound Graph calls to “finish” inbox/outbox without a product decision.

**Rule:** `WhatsappInboxSimulatePort` + `StubOutboxTransport` are MVP adapters. Real providers need product + architect change. Acceptance proves **rows**, not provider HTTP.

## Simulated inbox abuse

**Risk:** Unauthenticated caller injects inbound threads; or vendedor escalates to simulate without admin.

**Rule:** `POST /api/saas/inbox/simular` is **admin-only**, tenant-scoped. Public Loja WhatsApp CTA may log a simulated inbound only through a documented, rate-limited demo endpoint if enabled — default seed path is admin simulate + seed data.

## CNPJ lookup abuse

**Risk:** Open proxy to BrasilAPI; scraping.

**Rule:** Rate limit per IP on `POST /api/identidade/cnpj` and public cadastro. Enable live registry only with `CNPJ_REGISTRY_ENABLED`. Timeout ~3s. Degrade path is intentional — no retry-storm.

## Session / CSRF

**Risk:** Cookie reused across surfaces; CSRF on mutating POST.

**Rule:** Cookie name is surface-specific; handler checks `session.surface`. SameSite=Lax. Same-origin Next app; Origin check on mutations. No session token in query strings. Deactivated users cannot keep valid sessions (reject on load).

## Account / entitlement regression

**Risk:** Reintroducing Account chrome or blocking writes on a subscription flag “from the old MVP”.

**Rule:** No `/conta` in nav or API for MVP. No `entitlement_bloqueada` on ops writes. Selling this SaaS is later.

## Illegal transition side effects

**Risk:** 403/409 after partial stock or outbox write.

**Rule:** Status change + history + stock + outbox in **one transaction**. On failure, zero side effects.

## Performance (contract)

Catalog: single join, paginate. Lists indexed by `(tenant_id, status)`. No N+1 on document lines — include in one query. Inbox thread list paginated.

## Residual risks (accepted for MVP)

- SQLite file on disk is not encrypted at rest; local demo only.
- `SESSION_SECRET` in `.env` is a placeholder; rotate before any shared host.
- WhatsApp numbers stored in plaintext (PII); encrypt-at-rest later.
- No second-tenant in the demo seed — isolation tests are backend’s job.
- Single Next process shares memory across surfaces; mitigate with tenant checks, not process isolation.
- Venda/Faturamento is an internal stub — not fiscal proof.
