# Overview UX — Casa dos Frios

IA and chrome for the MVP only. Product: `docs/product/spec.md`, `docs/product/mvp.md`. Architecture: `docs/architecture/`.

Copy is **pt-BR**. Theme tokens apply to Loja and SaaS. **Account is out of MVP.**

## Surfaces and chrome

```
┌──────────────────┐   ┌──────────────────┐
│       Loja       │   │       SaaS       │
│      /loja       │   │      /saas       │
│  público + CNPJ  │   │ admin / vendedor │
│  tenant theme    │   │  tenant theme    │
│  cadastro → buy  │   │ CRM + pipeline   │
└──────────────────┘   └──────────────────┘
         │                      │
         └──── tenant data ─────┘
```

Two shells. Shared tenant data. **No shared nav. No Conta / billing chrome.**

| Rule | Loja | SaaS |
|---|---|---|
| Theme | Tenant tokens | Tenant tokens, denser |
| Audience | Guest, prospecto, cliente aprovado | `admin`, `vendedor` |
| Billing links | None | None |
| Guest | Catálogo + CTA + cadastro | No |

## Information architecture

### Loja (`/loja`)

| Screen | Route (conceptual) | Who |
|---|---|---|
| Home / marca + catálogo | `/loja` | Guest + authenticated |
| Produto | `/loja/produto/:codigo` | Guest + authenticated |
| Carrinho | `/loja/carrinho` | Guest browse; checkout gated |
| Entrar | `/loja/entrar` | Guest |
| Cadastro CNPJ | `/loja/cadastro` | Guest / prospect |
| Meus documentos | `/loja/meus-docs` | Prospecto + cliente |
| Orçamento (aceitar) | `/loja/orcamentos/:id` | Owner |
| Pedido | `/loja/pedidos/:id` | Owner cliente |

No guest checkout. No payments. No SaaS link. No Account link.

### SaaS (`/saas`)

| Screen | Route (conceptual) | Roles |
|---|---|---|
| Entrar | `/saas/entrar` | Workers |
| Inbox WhatsApp | `/saas/inbox` | admin, vendedor |
| Thread | `/saas/inbox/:id` | admin, vendedor |
| Cadastros | `/saas/cadastros` | admin, vendedor |
| Cadastro detail | `/saas/cadastros/:id` | admin, vendedor |
| Orçamentos | `/saas/orcamentos` | admin, vendedor |
| Orçamento | `/saas/orcamentos/:id` | admin, vendedor |
| Pedidos | `/saas/pedidos` | admin, vendedor |
| Pedido | `/saas/pedidos/:id` | admin, vendedor |
| Vendas | `/saas/vendas` | admin, vendedor |
| Venda | `/saas/vendas/:id` | admin, vendedor |
| Catálogo / estoque | `/saas/estoque` | admin write; vendedor read |
| SKU | `/saas/estoque/:codigo` | same |
| Usuários | `/saas/usuarios` | **admin only** |
| Tema | `/saas/tema` | **admin only** |
| Configuração | `/saas/configuracao` | **admin only** |
| Simular WhatsApp | `/saas/inbox` (tool) | **admin only** |
| Avisos (outbox) | `/saas/avisos` | admin, vendedor |

No Account, no AI chat, no estoquista/entregador modules.

## Navigation per role

Hide what the API denies. Do not show disabled admin items to vendedor.

### Loja

| Item | Guest | Prospecto `pendente` | Cliente `aprovado` |
|---|---|---|---|
| Marca / Catálogo | yes | yes | yes |
| WhatsApp CTA | yes | yes | yes |
| Cadastro | yes | status link | no |
| Entrar | yes | — | — |
| Carrinho | yes | yes | yes |
| Meus docs | no | yes | yes |
| Comprar / checkout | no | **no** | yes |
| Sair | no | yes | yes |

### Admin

`Inbox` · `Cadastros` · `Orçamentos` · `Pedidos` · `Vendas` · `Estoque` · `Usuários` · `Tema` · `Configuração` · `Avisos` · Sair

### Vendedor

`Inbox` · `Cadastros` · `Orçamentos` · `Pedidos` · `Vendas` · `Estoque` (read) · `Avisos` · Sair

Home after login: **Inbox** (CRM-first).

## Chrome rules

1. SaaS never links to Conta, planos, or assinatura. **No entitlement banner** in MVP (seed always operational).
2. Loja never links to SaaS.
3. Loja header: logo/wordmark left (hero-level brand on home), Catálogo, WhatsApp CTA, Carrinho, auth.
4. SaaS: light cool desk + left sidebar; `marca` at top of sidebar; role chip + Sair pinned at bottom.
5. CNPJ masked in lists/details (`**.***.***/****-00`). Full digits only in the active input while typing.
6. Pedido / Venda are commercial docs — never “pagar”, “PIX”, or checkout pago.
7. Tenant primary tints actions, links, active nav accent — **not** the whole sidebar fill.
8. Default language pt-BR. No i18n toggle.

## Shared patterns

### Status (sales docs)

Status is the hero on every document detail. Labels locked in [`copy-pt-BR.md`](./copy-pt-BR.md).

| Family | Tone examples |
|---|---|
| Orçamento | `rascunho` muted · `enviado` primary outline · `aceito` success · `recusado`/`cancelado` danger · `expirado` warning |
| Pedido | `confirmado` primary · `em_separacao` warning · `despachado` accent · `entregue` success · `cancelado` danger |
| Venda | `rascunho` muted · `faturado` success · `cancelado` danger |
| Cadastro | `pendente` warning · `aprovado` success · `recusado` danger |

After a legal transition, show notify line: “Cliente avisado no WhatsApp.” (channels follow tenant `canais_aviso`).

### Cadastro gate

Prospecto / guest cannot create Pedido. Accept Orçamento that would create Pedido is blocked until `aprovado`. UI: remove primary buy/accept; show gate banner (see [`states.md`](./states.md)).

### Stock honesty

Loja shows only `visivel_loja`. Available = `max(0, on_hand - reserved)`. Zero → “Sem estoque”, no add. SaaS shows Em estoque / Reservado / Disponível — never a second “estoque da loja” ledger.

### CNPJ

One field pattern. Checksum client+server. Registry fill razão social (editable). Registry down → warning + proceed (`cnpj_registro_pendente`).

## Accessibility baseline

See [`a11y.md`](./a11y.md). Contrast ≥ 4.5:1; status = text + color; visible focus; labeled fields; tax IDs never in `title`/`data-*` full form.

## Handoff

- Implement only screens in the tables above.
- Illegal transitions: omit the button.
- Copy: [`copy-pt-BR.md`](./copy-pt-BR.md). States: [`states.md`](./states.md). Kit: [`shadcn.md`](./shadcn.md).
