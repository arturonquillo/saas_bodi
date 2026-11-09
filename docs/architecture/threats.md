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

**Rule:** `ChannelSimulateInboundPort` + `StubChannelSendPort` + `StubOutboxTransport` are the adapters. Connection status must not reach `live` until product unlocks Meta. Acceptance proves **rows**, not provider HTTP. Tests assert no Graph host egress from WA adapters.

## Simulated inbox abuse

**Risk:** Unauthenticated caller injects inbound threads; or vendedor escalates to simulate without admin.

**Rule:** `POST /api/saas/crm/simular` is **admin-only**, tenant-scoped (legacy `/inbox/simular` same rule until removed). Public Loja WhatsApp CTA may log a simulated inbound only through a documented, rate-limited demo endpoint if enabled — default seed path is admin simulate + seed data.

## Conversation / Contact IDOR

**Risk:** Vendedor reads another inbox’s conversations or contacts across assignment rules; or guesses ids from other tenants.

**Rule:** `assertConversationVisible` + tenant scope on every CRM read/write. Contacts are tenant-scoped; still no cross-tenant. Return **404** for invisible conversations (do not leak existence via 403).

## WA credential leakage

**Risk:** Access tokens / app secrets in GET JSON, logs, SSE payloads, or client bundles.

**Rule:** Encrypt at rest (AES-256-GCM). GET returns masked placeholders + `secrets_present`. Never put secrets in `domain_events` or notifications. Rotate `CREDENTIALS_ENCRYPTION_KEY` only via controlled re-encrypt job.

## Webhook / bot SSRF (Phase B — contract now)

**Risk:** Automation or AgentBot posts to `http://169.254.169.254/` or internal admin URLs.

**Rule:** Jobs only (not request path). `UrlEgressGuardPort` https + DNS + private-IP deny + redirect re-check. See [jobs-realtime.md](./jobs-realtime.md).

## Campaign / outbox confusion (Phase C)

**Risk:** Campaign blasts appear as commerce status notifications or reuse cadastro templates.

**Rule:** `notification_outbox.category` discriminates; commerce avisos UI filters `commerce`. Campaign keys use `campaign.*` prefix.

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

Catalog: single join, paginate. Lists indexed by `(tenant_id, status)`. No N+1 on document lines — include in one query. Conversation list: `(tenant_id, status, last_activity_at)`; messages `(tenant_id, conversation_id, created_at)`. SSE fan-out in-process OK for seed scale; multi-instance needs pub/sub later ([jobs-realtime.md](./jobs-realtime.md)).

## Residual risks (accepted for MVP)

- SQLite file on disk is not encrypted at rest; local demo only.
- `SESSION_SECRET` / `CREDENTIALS_ENCRYPTION_KEY` in `.env` are placeholders; rotate before any shared host.
- Contact phone / WhatsApp display numbers stored in plaintext (PII); channel **secrets** encrypted; full phone encrypt-at-rest later if required.
- No second-tenant in the demo seed — isolation tests are backend’s job.
- Single Next process shares memory across surfaces; mitigate with tenant checks, not process isolation. SSE is single-node.
- Venda/Faturamento is an internal stub — not fiscal proof.
- Job worker in-process can stall under load — acceptable until ops scale.
