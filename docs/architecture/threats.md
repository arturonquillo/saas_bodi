# Threats

MVP threat notes. Blockers if a PR ships the failure mode.

## Tenant isolation / IDOR

**Risk:** Authenticated user on tenant A reads B’s inbox, cadastros, orçamentos, pedidos, outbox, or stock.

**Rule:** Every query includes `tenant_id = session.tenantId`. Foreign ids that fail the scope check return **404** `nao_encontrado`. Do not accept `tenant_id` from the JSON body on authenticated routes.

**Tests:** seed a second tenant fixture in backend tests (not in demo seed); prove 404.

## Client-trusted role, price, stock, discount

**Risk:** Body includes `saas_role`, `unit_price_centavos` / `preco_unitario_centavos` / `preco_lista_centavos`, `desconto_pct` above cap, `available`, or `on_hand` and the server persists it.

**Rule:** Role from `memberships`. List price from SKU `preco_atacado_centavos` at freeze; net from locked half-up % formula ([inventory.md](./inventory.md)). Vendedor `desconto_pct ≤ desconto_max_pct` (admin may exceed). Loja rejects discount fields. Qty from `inventory_balances`; ledger writes only via domain adjust / pedido hooks. Strip unknown/trusted fields in Zod.

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

## Webhook / bot SSRF (Phase B)

**Risk:** Automation or AgentBot posts to `http://169.254.169.254/` or internal admin URLs.

**Rule:** Jobs only (not request path). Validate URL on **admin save** and again on **deliver**. `UrlEgressGuardPort` https + DNS + private-IP deny + redirect re-check. See [jobs-realtime.md](./jobs-realtime.md). Tests must include metadata-IP and RFC1918 fixtures.

## CSAT token abuse (Phase B)

**Risk:** Brute-force public survey tokens; spam ratings; scrape conversation metadata.

**Rule:** High-entropy token; rate-limit `GET/POST /api/public/csat/:token` per IP; one-shot consume; public GET returns minimal brand + inbox name — **no** contact PII, CNPJ, or message history.

## Automation privilege escalation (Phase B)

**Risk:** Vendedor crafts macro/automation to assign across inboxes or fire webhooks.

**Rule:** Automation/webhook/bot CRUD = **admin**. Macro execute still runs `assertConversationVisible` per id. `send_webhook` action only on AutomationRule (admin), not macros.

## Bot token leakage (Phase B)

**Risk:** Bot bearer token in GET lists, SSE, or logs.

**Rule:** Return full token **once** on create; thereafter masked. Never put token in `domain_events` or job `last_error`.

## Campaign / outbox confusion (Phase C)

**Risk:** Campaign blasts appear as commerce status notifications or reuse cadastro templates; or “finish” campaigns by wiring Meta/Twilio.

**Rule:** `notification_outbox.category` discriminates; commerce avisos UI filters `commerce`. Campaign keys use `campaign.*` prefix; `campaign_id` set. Send path = `campaign.send_batch` + `StubOutboxTransport` only — tests forbid Graph/Twilio hosts. Audience resolution always `tenant_id`-scoped.

## Help Center public content abuse (Phase C)

**Risk:** XSS via article HTML; draft leakage; scraping; open redirect via custom domain before E.

**Rule:** Sanitize HTML on write; public GET returns **published** only (draft → 404); rate-limit public HC; Phase E: route `Host` → portal **only** when `custom_domain_verified`; ignore unverified domains. No contact/conversation PII in HC payloads.

## Reports data leak (Phase C)

**Risk:** Vendedor reads tenant-wide agent metrics; cross-tenant id in filters.

**Rule:** `/relatorios/*` = **admin** only. All aggregates `WHERE tenant_id = session.tenantId`. Do not return full message bodies or CNPJ in report DTOs — counts and durations only.

## Widget session fixation / tenant hop (Phase D)

**Risk:** Attacker forges `tenant_id`, steals hmac, or posts widget messages into another tenant’s desk.

**Rule:** Resolve tenant **only** from `website_token` → ChannelWebsiteWidget. Store session token **hashed**. Sign session payloads with sealed hmac. Enforce `allowed_origins`. Rate-limit bootstrap/session/message per IP+token. Never put hmac secret or API plaintext tokens in bootstrap JSON.

## Channel stub → live confusion (Phase D)

**Risk:** Implementer wires Meta/IG/Twilio/SMTP because credential fields exist; or sets `connection_status=live`.

**Rule:** Domain rejects `live` for all channel types (`501`). Adapters are stub/first-party-widget only. Acceptance tests assert no egress to Graph, Facebook, Instagram, TikTok, X, Telegram, LINE, Twilio, SMTP/IMAP hosts. UI copy stays “Pronto para conectar”.

## API channel token leakage (Phase D)

**Risk:** Bearer token in logs, SSE, or GET after create.

**Rule:** Hash at rest; return plaintext **once** on create/rotate; thereafter prefix/last4 + `secrets_present`. Rotate invalidates old hash. Same masking rules as WA vault.

## Interactive / pre-chat abuse (Phase D)

**Risk:** Oversized JSON payloads; XSS via form labels mirrored into SaaS; unauthenticated spam threads.

**Rule:** Cap content_attributes size; sanitize labels; rate-limit widget message create; lock_to_single_conversation on seed widget inbox; optional pre-chat required fields before first message.

## Browser push endpoint spam (Phase D)

**Risk:** Stored XSS open redirect via notification URL; subscription bombing.

**Rule:** Allow only same-origin relative URLs in push payload; limit subscriptions per user; delete on 410 from push service; missing VAPID = skip (no throw on message path).

## SLA / capacity privilege (Phase E)

**Risk:** Vendedor applies SLA or reads tenant-wide SLA reports; capacity bypass assigns across inboxes.

**Rule:** SlaPolicy CRUD / apply = **admin** (or `sla_manage`). Reports need `admin` or `report_manage`. Balanced assignment still runs `assertConversationVisible` / inbox membership; never assign outside inbox members.

## Captain data exfiltration (Phase E)

**Risk:** Suggestion payload leaks CNPJ / secrets to model provider; auto-send without agent.

**Rule:** Redact tax IDs and channel secrets before `CaptainAiPort.suggest`. Default stub only. Live provider behind unlock. Accept path uses desk APIs + visibility; no silent outgoing WA/Meta.

## Audit log exposure (Phase E)

**Risk:** Vendedor reads security audit; payload contains secrets.

**Rule:** `/auditoria` = admin or `audit_read`. Payload redaction mandatory (no secrets, MFA, SAML XML, full CNPJ).

## SAML / MFA bypass (Phase E)

**Risk:** ACS accepts unsigned assertions; MFA secret in GET; JIT creates admin.

**Rule:** Stub verify in tests; live ACS validates signature when unlocked. MFA secret once on enroll. JIT default **off**; when on, provision `vendedor` only — never auto-admin.

## Integration / dashboard SSRF (Phase E)

**Risk:** Dashboard app URL or integration webhook hits metadata IP; “test” calls live Slack unpaid.

**Rule:** `UrlEgressGuardPort` on dashboard URL save and integration deliver. `IntegrationConnectPort.test` stub-only in default tests; reject `connection_status=live`.

## Custom role escalation (Phase E)

**Risk:** User assigns self `admin` bits or `security_manage` without being admin.

**Rule:** CustomRole CRUD + `custom_role_id` assign = **admin** only. `requirePermission` fail-closed. Cannot grant bits the actor lacks (admin excepted).

## Voice stub → live confusion (Phase E)

**Risk:** Wire Twilio Voice because `ChannelVoice` exists.

**Rule:** Same as D channels — ≤ `ready_stub`; no telephony HTTP; simulate only.

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

## Inventory ledger fork / price-list creep

**Risk:** Loja gets a `store_stocks` table; or a parallel price-list module shadows `preco_atacado_centavos`.

**Rule:** Architecture blocker. One `InventoryBalance` per SKU; Loja reads projection only (`ativo && visivel_loja`). Discount is document-line `%`, not a catalog promo entity. See [inventory.md](./inventory.md).

## Stock adjust without audit / under-reserved

**Risk:** Admin adjust with empty motivo, or `on_hand` driven below `reserved`.

**Rule:** `motivo` non-empty required; reject `delta_on_hand === 0`; invariant `reserved ≤ on_hand` in the same transaction as the movement append.

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
