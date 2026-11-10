# Tokens — Casa dos Frios

Machine-readable: [`tokens.json`](./tokens.json), [`tokens.css`](./tokens.css). Kit mapping: [`shadcn.md`](./shadcn.md).

Loja and SaaS share **tenant** tokens and differ only in density. **Account is out of MVP** — no product-theme chrome in this release.

## Brand idea

Cold-room wholesale meat distributor: deep carmine (frios / carnes), refrigerated steel teal, cool fog canvas. **Not** purple-on-white, **not** cream + terracotta + display serif, **not** default shadcn violet.

Logo: **placeholder slot** until the official asset arrives. Empty `logo_url` → wordmark **Casa dos Frios** in Archivo.

## Who edits what

| Token | CSS variable | Seed | Editor? |
|---|---|---|---|
| marca | `--marca` | `Casa dos Frios` | Admin |
| primary | `--color-primary` | `#7A1F1F` | Admin |
| accent | `--color-accent` | `#1F5C6B` | Admin |
| background | `--color-background` | `#EEF2F4` | Admin |
| logo | `--logo-url` | none (wordmark) | Admin (URL/upload) |
| text | `--color-text` | `#141A1F` | System |
| text muted | `--color-text-muted` | `#5A6570` | System |
| danger / success / warning | `--color-danger` etc. | fixed | System |
| radius / spacing / motion / elevation | see JSON | fixed | System |
| display font | `--font-display` | Archivo | System |
| body / UI font | `--font-body` / `--font-ui` | IBM Plex Sans | System |

Do not add editable font family, dark mode, or radius to the MVP theme editor.
User/system **color mode** (claro / escuro / sistema) is separate from the tenant theme editor — see [shadcn.md](./shadcn.md) § Dark mode.

### Derived (computed, not editable)

| Token | Rule |
|---|---|
| `--color-marca` | Same as primary unless a dedicated marca color is stored |
| `--color-text-on-primary` | `#F7F1F0` (passes ≥ 4.5:1 on `#7A1F1F`) |
| `--color-text-on-accent` | `#F2F8FA` (passes ≥ 4.5:1 on `#1F5C6B`) |
| `--color-surface` | Cool lift toward white (`#F7F9FA`) |
| `--color-surface-raised` | `#FFFFFF` |
| `--color-border` | Background darkened ~10% (`#D5DCE1`) |

## Seed (must match)

| Field | Value |
|---|---|
| slug | `casa-dos-frios` |
| marca | `Casa dos Frios` |
| primary | `#7A1F1F` |
| accent | `#1F5C6B` |
| background | `#EEF2F4` |
| logo_url | `null` |

Architecture seed may still show an earlier example palette; **this file wins** for implementation.

## Density

| Surface | `data-density` | Body | Lists |
|---|---|---|---|
| Loja | `comfortable` | 16px | Catalog tiles, 16–24px gaps |
| SaaS | `compact` | 14px | Tables, ~40px rows desktop |

Same color tokens. No second palette for mobile.

## Live preview (tema editor — admin only)

1. Changing marca, primary, accent, background, or logo updates CSS variables **immediately** in a framed preview: Loja header + price + primary button + SaaS table snippet + status badges.
2. The rest of the SaaS shell does **not** hot-swap until **Salvar tema** succeeds.
3. Contrast gate before save: text on background and text-on-primary on primary ≥ 4.5:1. Fail → inline error, no persist. MVP assumes **light** backgrounds.
4. Logo empty → wordmark. Broken image → wordmark + “Logo indisponível”.
5. Dirty cancel → discard confirm.

## shadcn mapping (summary)

| Token | shadcn | Loja | SaaS |
|---|---|---|---|
| `--color-primary` | `--primary` | yes | yes |
| `--color-text-on-primary` | `--primary-foreground` | yes | yes |
| `--color-text` | `--foreground` | yes | yes |
| `--color-text-muted` | `--muted-foreground` | yes | yes |
| `--color-danger` | `--destructive` | yes | yes |
| raised white | `--card` / `--popover` | yes | yes |
| system hairline `#D8DEE3` | `--border` / `--input` | yes | yes |
| `--color-accent` | **`--ring`** + `--brand-accent` | yes | yes |
| `--color-accent` | **not** `--accent` | muted hover wash stays muted | same |
| `--color-background` | **not** full-page `--background` | optional cool strip / hero wash only | unused on canvas |
| system canvas | `--background` | `#FFFFFF` | `#F4F6F7` cool desk |
| `--radius-md` | `--radius` | 8px | tables ≤ 4px |
| `--font-ui` | `--font-sans` | IBM Plex Sans | IBM Plex Sans |
| `--font-display` | utility / titles | Archivo | Archivo for page titles only |

Full table: [`shadcn.md`](./shadcn.md) §2.

## Applying tokens

- Loja page canvas: white. Tenant `--color-background` may tint hero atmosphere / thin utility strip — not the whole shop as a cream slab.
- SaaS canvas: cool system gray; lists are border-first white panels — **no** Card shadow farm.
- Primary: buttons, links, Loja prices, SaaS active nav accent bar.
- Brand accent: cold-steel focus ring, intent chips secondary, WhatsApp CTA outline — never the only status cue.
- Danger / success / warning: system only.
- Color mode uses the document `dark` class (shadcn). Tenant brand primary/accent stay; surfaces/text remap under `.dark [data-theme="tenant"]`.

## What frontend must not improvise

- Hex for tenant colors in screens — use variables.
- Tenant `--color-background` as full Loja/SaaS `--background`.
- Tenant `--color-accent` as shadcn `--accent`.
- Tenant `--color-primary` as sidebar fill.
- Extra theme editor fields or a parallel CSS token kit.
- A second dark palette outside shadcn CSS variables.
