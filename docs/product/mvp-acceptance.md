# MVP acceptance — Casa dos Frios

Sign-off list for QA. Behavior: `docs/product/spec.md` and `docs/product/mvp.md`. Seed tenant `casa-dos-frios` required. PASS only if every item holds.

## Demo tenant

- Seed users login with documented password (`admin@…`, `vendedor@…`, cliente aprovado, prospecto pendente).
- SKUs include carnes/frios lean, one `visivel_loja=false`, one zero-available, optional MOQ > 1.
- Inbox has sample threads for `cadastro`, `orcamento`, `info_empresa`.
- At least one orçamento `enviado`, one pedido mid-pipeline, theme non-default, channels include WhatsApp.
- Logo may be placeholder.

## SaaS foundation

- Login succeeds; bad password fails; logout ends session; expired/invalid session cannot call mutating APIs.
- Admin creates/deactivates a vendedor; deactivated user cannot login.
- Vendedor cannot access admin user management or theme/config write.
- Role cannot be escalated from the client.

## CRM inbox and cadastro

- Admin can **simular mensagem** inbound; thread appears with phone + body; intent can be tagged.
- Cadastro from loja form or inbox intent creates `pendente` with CNPJ checksum.
- Invalid CNPJ checksum rejected. Registry down → warning + `cnpj_registro_pendente` allowed.
- Vendedor/admin `aprovado` creates Cliente and outbox notice; `recusado` requires reason + outbox.
- Cliente não aprovado: API rejects Pedido create and Orçamento → Pedido conversion (4xx).

## Orçamento → Pedido → Venda

- Vendedor creates orçamento `rascunho` with lines (frozen `preco_atacado`); send → `enviado` requires `valido_ate`; outbox to customer.
- Cliente (loja) or vendedor marks `aceito` only if cadastro `aprovado` → Pedido `confirmado` + stock **reserve**.
- `enviado` → `recusado` / `cancelado` / `expirado` do not create Pedido.
- Pedido: `confirmado` → `em_separacao` → `despachado` (consume) → `entregue`; cancel before despacho releases reserve.
- Illegal transition (wrong role or status) = 403/409, no stock/outbox side effects.
- Faturar: Venda `rascunho` → `faturado`; outbox on `faturado`. No NF-e/provider call.
- Second Venda for same Pedido rejected while one non-cancelled exists.

## Loja

- Public page shows Casa dos Frios branding (name hero-level; placeholder logo ok).
- Catalog: only `visivel_loja`; available = on-hand − reserved; zero cannot add.
- WhatsApp CTA present (wa.me or documented demo equivalent).
- Cadastro form works; guest checkout blocked.
- Cliente aprovado places Pedido; sees own orçamentos/pedidos + history.
- Full CNPJ masked in UI; not logged in full on happy path.

## Notifications

- Cadastro approve/refuse and document status changes insert outbox rows for configured channels for **customer and vendedor**.
- Stub marks `enviado` without Meta or required SMTP. QA asserts rows + payload keys, not provider HTTP.

## Stock projection

- Confirm reserves; dispatch consumes; cancel-before-dispatch releases.
- Loja quantity tracks the **same** ledger (no second inventory table driving the store).
- Admin qty adjust with reason writes movements on that ledger.

## Isolation and security

- All operational rows carry `tenant_id`; seed uses one tenant. Tests prove queries are tenant-scoped (second tenant fixture or equivalent).
- Client cannot set unit price, role, or available qty.
- pt-BR copy on SaaS and Loja.

## Explicit non-goals (must remain absent)

- No Account/subscription UI.
- No Meta WhatsApp API dependency for PASS.
- No NF-e, PIX, or payment capture.
- No estoquista/entregador role requirements.
- No AI inventory apply path.
