# Visual language — Casa dos Frios

Visual source of truth for MVP screens. UI kit: [`shadcn.md`](./shadcn.md). Tokens: [`tokens.md`](./tokens.md).

No Account surface. No AI inventory chat. No purple / cream-serif / terracotta clichés.

## North star

**Cold room + carnes.** A refrigerated wholesale house that sells confidence and speed.

Three rejected directions (brief):

| Direction | Concept | Why not |
|---|---|---|
| A — Cream butcher paper | Warm kraft, serif display, terracotta | AI cliché cluster; soft for CRM ops |
| B — Dark neon abattoir | Near-black + glow crimson | Too theatrical; hurts dense tables |
| **C — Cold room (selected)** | Carmine brand, steel-teal accent, cool fog canvas, industrial sans | Credible distributor; works for Loja hero and SaaS desk |

### Selected direction — Cold room

- **Personality:** precise, refrigerated, commercial — not cute, not luxury steakhouse.
- **Focal brand signal:** deep carmine `#7A1F1F` on actions and Loja wordmark; steel `#1F5C6B` for focus, WhatsApp outline, secondary cues.
- **Canvas:** cool fog `#EEF2F4` / white — never warm cream page fill.
- **Type:** Archivo (display / titles) + IBM Plex Sans (body, UI, tabular prices).
- **Imagery:** product/atmosphere of frios when photos exist; until then, cool gradient tile with Archivo initials — not abstract purple blobs.

## Users and jobs

| Who | Visual job |
|---|---|
| Guest | See **Casa dos Frios** as hero brand, then catalog + WhatsApp |
| Prospecto | Understand cadastro pending; cannot buy |
| Cliente aprovado | Price + MOQ clear; checkout one primary |
| Admin | Users, tema, simulate inbox — dense but calm |
| Vendedor | Conversas → label/assign → cadastro/orçamento without hunting |

## Type

System-level — not theme-editor fields. Subset **latin + latin-ext**.

| Role | Face | Use |
|---|---|---|
| Display | [Archivo](https://fonts.google.com/specimen/Archivo) 500–700 | Loja hero wordmark/title, SaaS page titles |
| Body / UI | [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) 400–700 | All chrome, forms, tables, prices (tabular nums) |

```
https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap
```

`next/font`: `Archivo` → `--font-display`; `IBM_Plex_Sans` → `--font-body` / `--font-ui`.

**Do not** load Inter, Fraunces, Source Serif 4, or Geist as the product face.

### Sizes

| Role | Loja | SaaS |
|---|---|---|
| Hero / display | 40px / 700 Archivo | — |
| Page title | 24px / 600 Archivo | 20–24px / 600 Archivo |
| Product title | 16px / 600 Plex | — |
| Price | 20–28px / 600 Plex tabular, `--primary` | 16px tabular |
| Body | 16px Plex | 14px Plex |
| Meta / SKU | 13–14px muted | 12px muted |
| Button | 14px / 600 | 13px / 600 |
| Sidebar nav | — | 13px / 500 |

## Elevation / motion

Border-first. Cards only when they wrap an interaction (catalog tile, auth form, thread composer).

| Token | Use |
|---|---|
| `--shadow-card` | Loja product tile optional; auth panel |
| `--shadow-card-hover` | Product hover (`pointer: fine`) — 1px lift, no primary wash |
| `--shadow-float` | Dialogs / sheets |
| `--duration-fast` 160ms | Hover, focus |
| `--duration` 200ms | Sidebar active, status badge change |
| `prefers-reduced-motion` | duration 0; keep color/border |

**Intentional motions (ship ≥ 2–3):**

1. Loja hero: subtle cool mist gradient drift (opacity only; disabled under reduced motion).
2. Primary button press: 1px translateY + shadow drop.
3. Conversas thread open: Sheet/page content fade-in 200ms.
4. Status badge: color crossfade on legal transition.

## Chrome

### Loja

- Full-bleed **hero plane**: cool fog → soft steel wash; brand wordmark/logo slot **hero-level**; one headline; one short line; CTA group (WhatsApp + Catálogo / Cadastrar). No stats strip, no floating badges on media.
- Catalog below the fold: toolbar + product tiles (photo or initials), price, MOQ badge, Adicionar.
- Header sticky white: logo/wordmark, nav, WhatsApp outline button, cart, auth.
- Footer cool dark steel `#1B2429` (system, not tenant token): Catálogo · Cadastro · WhatsApp — shop only.

### SaaS

- Cool desk canvas `#F4F6F7`; white list panels with 1px hairline; **no** KPI spectacle unless counts are real and useful (inbox unread, cadastros pendentes).
- Light sidebar `#FAFBFC`; active item = 3px primary bar + 8% primary wash — sidebar never filled with primary.
- Document detail: status Badge + compact trail; action row = only legal transitions.

## Logo placeholder

| Slot | Size | Behavior |
|---|---|---|
| Loja header | 32–40px height | Image if `logo_url`; else Archivo wordmark |
| Loja hero | up to 72px / wordmark 40px | Same; empty slot must still feel branded |
| SaaS sidebar | 28–32px | Same |

Broken image → wordmark + muted “Logo indisponível”.

## What frontend must not improvise

- Cream page backgrounds or terracotta as accent.
- Purple / indigo gradients.
- Display serif on Loja.
- Card grids for SaaS lists (use Table).
- Floating promo chips on the hero.
- Account navy chrome.
