# Authz

Enforced in `apps/web/src/server/authz/`. UI only hides what the API already denies. Never trust client `role`, `unit_price`, `available`, or `tenant_id`.

## Surfaces

| Surface | Cookie | Who may obtain a session |
|---|---|---|
| Loja | `cdf_sessao_loja` | `membership.is_customer` **and** linked Cliente `aprovado` (or pending prospect for read-only “meus docs” only if product allows — MVP: login for aprovado + prospecto with cadastro `pendente` can login to see status but **cannot** checkout) |
| SaaS | `cdf_sessao_saas` | `membership.saas_role` in (`admin`, `vendedor`) and `user.ativo` |

Prospect with only a pending cadastro may authenticate on Loja to view cadastro status / refuse guest checkout — still blocked from Pedido create.

**No Account surface / cookie in MVP.**

Middleware order on every `/api/{loja,saas}/*` except public GETs and login/register/cadastro:

1. Resolve tenant (session, or slug on public Loja reads).
2. Load membership for `(user_id, tenant_id)` — 401 if missing or user inactive.
3. **Surface gate**: `session.surface` must match the API prefix.
4. **Role gate** for the action.
5. **Cadastro gate** on Pedido / Orçamento accept→Pedido / Venda creates.
6. Handler queries **always** `WHERE tenant_id = session.tenantId`.

Cross-tenant IDs → **404** (do not leak existence). Wrong role → **403**. Illegal state → **409**. Cadastro gate → **403** `cadastro_nao_aprovado` (or **422** if preferred consistently — **use 403** `cadastro_nao_aprovado`).

## No entitlement gate

MVP has no `subscription_status` check. Seed tenant is always operational. Do not port `requireEntitlementAtiva` from the old Account design.

## Role matrix (SaaS)

| Action | admin | vendedor |
|---|---|---|
| Users create / deactivate / list | yes | no |
| Theme / tenant config write | yes | no |
| Simulate WhatsApp inbound | yes | no |
| Inbox read + intent tag | yes | yes |
| Cadastro approve / refuse | yes | yes |
| Orçamento / Pedido / Venda transitions (per product matrix) | yes | yes |
| SKU create / stock adjust / visibility | yes | read (+ lines from catalog when creating docs) |
| Outbox read | yes | yes |

Fulfillment statuses (`em_separacao`, `despachado`, `entregue`) are operated by **admin and vendedor** — no dedicated warehouse/courier roles.

## Loja customer

| Action | Guest | Prospect (`pendente`) | Cliente `aprovado` |
|---|---|---|---|
| Catalog / theme / CTA | yes | yes | yes |
| Submit cadastro | yes | — | — |
| Login | — | yes | yes |
| Create Pedido / checkout | no | **no** | yes (if `loja_modo=pedido_direto`) |
| Accept/refuse own Orçamento `enviado` | no | no* | yes |
| List own orçamentos/pedidos | no | own orçamentos if any | yes |

\*Accept that would create Pedido is blocked until `aprovado` (product rule).

## Cadastro gate (domain)

Before any of:

- `POST` Pedido (Loja or SaaS)
- Orçamento `enviado` → `aceito` (when that creates Pedido)
- Create Venda from Pedido

assert the target Cliente exists and cadastro/cliente status is `aprovado`. Orçamentos may be drafted for prospects without this gate.

## Helpers (contract)

```ts
requireSession(surface: "loja" | "saas")
requireCustomer()
requireSaasRole(...roles: Array<"admin" | "vendedor">)
requireClienteAprovado(clienteId: string)
assertTenantScope(row.tenant_id, session.tenantId)
```

Domain services call these; UI does not re-implement authorization.

## Logging

Log `tenant_id`, `user_id`, `surface`, `action`. Do **not** log full CNPJ, raw WhatsApp, passwords, or full session tokens. Mask as last4 only when a debugger field is required.
