# Loja UX — Casa dos Frios

Public storefront + cliente area. Base `/loja`. Tenant theme, **comfortable** density. Brand-first. Atacado CNPJ only in MVP.

Former `store.md` content for saas_frota is superseded by this file.

## 1. Context

### Users

| Who | Job |
|---|---|
| Guest | Discover brand, browse catalog, WhatsApp, start cadastro |
| Prospecto (`pendente`) | Track cadastro; cannot buy |
| Cliente `aprovado` | Buy (pedido direto), accept/refuse orçamentos, track docs |

### Primary goal

Convert wholesale interest via WhatsApp or cadastro; let approved buyers purchase with honest stock.

### Constraints

- Guest checkout forbidden.
- Buy only if `aprovado` and `loja_modo=pedido_direto` (seed default).
- Catalog = projection (`visivel_loja` + available).
- Logo placeholder OK; brand name must still pass the brand test.

## 2. Information hierarchy

1. **Casa dos Frios** (brand).
2. One headline + WhatsApp / cadastro CTA.
3. Catalog (price, MOQ, availability).
4. Auth / cart / meus docs.

## 3. Flows

### Home / marca

**Entry:** `/loja`

**Composition (first viewport):** full-bleed cool hero plane; logo slot or wordmark hero-level; one headline; one supporting sentence; CTA group (**WhatsApp** + **Ver catálogo** or **Quero me cadastrar**). No stats, no promo chips on media, no cards in hero.

**Happy path:** scroll or CTA → catalog section / `#catalogo`.

### Catalog + PDP

- Grid of visible SKUs: image/initials tile, name, `preco_atacado`, MOQ badge if >1, available or Sem estoque.
- PDP: title, price, MOQ, qty stepper, Adicionar (disabled if 0 available).
- Hidden SKUs never listed.

### WhatsApp CTA

- Header + hero + footer.
- Opens configured `wa.me` with prefilled text; demo may also log simulated inbound intent when using simulator (product/architecture).
- Button: outline/secondary with brand accent ring — label **WhatsApp**.

### Cadastro CNPJ

**Entry:** `/loja/cadastro`

Fields: CNPJ, razão social (auto from registry), contato, WhatsApp, email, senha (if creating login).

**Happy path:** checksum OK → submit → `pendente` → confirmation “Cadastro enviado. Aguarde aprovação.”

**Registry down:** warning Alert; proceed; flag `cnpj_registro_pendente`.

**Invalid checksum:** field error; block submit.

### Login cliente

`/loja/entrar` → cookie `cdf_sessao_loja`. Prospecto and aprovado both may login; checkout still gated.

### Buy (aprovado)

Cart → review lines (frozen prices from catalog) → **Enviar pedido** → Pedido `confirmado` + reserve → success → meus docs.

**Gates:** guest → entrar; pendente → banner “Seu cadastro ainda não foi aprovado.”; zero stock lines blocked.

### Orçamento in loja

Cliente sees own `enviado` orçamentos → **Aceitar** / **Recusar**. Accept requires `aprovado` or shows gate. Accept → Pedido.

### Meus docs

List orçamentos + pedidos with status Badges; detail with history.

## 4. Visual direction

Cold room Loja — [`visual.md`](./visual.md). Focal point: brand in hero, then price on tiles.

## 5. Layout

### Desktop

- Sticky header 64px.
- Hero min-height ~70vh full-bleed.
- Catalog max-width ~1200px, 3–4 columns.

### Mobile

- Hero ~100svh budget still brand + one headline + one sentence + CTAs (stack).
- Catalog 2 columns.
- Sticky WhatsApp optional FAB only if header CTA scrolls away — prefer keeping header CTA; **no** floating promo sticker aesthetics.

## 6. Components

`Button`, `Input`, `Label`, `Form`, `Card` (product tile + auth only), `Badge`, `Alert`, `Sheet` (mobile nav/cart), `Dialog` (confirm), `Skeleton`, `Separator`, `Sonner`, `Breadcrumb` (PDP). See [`shadcn.md`](./shadcn.md).

## 7. Interaction

- Adicionar updates cart count with brief Sonner.
- Qty respects MOQ (step / min).
- Checkout primary only when all lines available and user aprovado.

## 8. States

Empty catalog, empty cart, loading skeletons, registry-down, cadastro pending gate, sem estoque, error retry — [`states.md`](./states.md).

## 9. Tokens

Comfortable density; primary on prices and filled CTAs; accent on WhatsApp outline / focus.

## 10. Accessibility

Hero image decorative or meaningful alt; CTAs named; gate banners as status; [`a11y.md`](./a11y.md).

## 11. Copy

[`copy-pt-BR.md`](./copy-pt-BR.md).

## 12. Handoff

### Must implement

Brand-first hero with logo placeholder slot; catalog honesty; WhatsApp CTA; cadastro; gated checkout; meus docs accept orçamento.

### Must not improvise

- Guest checkout.
- Varejo/CPF path.
- SaaS or Account links.
- Hero clutter (stats, chips, cards).
- Parallel CSS kit.
