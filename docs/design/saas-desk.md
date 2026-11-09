# SaaS Desk chrome — Casa dos Frios

Layout and density for `/saas`. Flows live in [`saas.md`](./saas.md). Tokens in [`tokens.md`](./tokens.md).

## Shell

```
┌──────── sidebar 240px ────────┬──────── main ─────────────────────┐
│ [logo/wordmark]               │ breadcrumb                         │
│ Casa dos Frios                │ title (Archivo)  status Badge      │
│                               │ action row                         │
│ Inbox                         │────────────────────────────────────│
│ Cadastros                     │ content (Table / form / split)     │
│ Orçamentos                    │                                    │
│ Pedidos                       │                                    │
│ Vendas                        │                                    │
│ Estoque                       │                                    │
│ ── admin only ──              │                                    │
│ Usuários / Tema / Config      │                                    │
│ Avisos                        │                                    │
│                               │                                    │
│ Admin · Sair                  │                                    │
└───────────────────────────────┴────────────────────────────────────┘
```

- Canvas: `#F4F6F7`.
- Sidebar: `#FAFBFC`, 1px right border `#E5E9EC`.
- Active nav: 3px `--primary` left bar + `color-mix(in srgb, var(--color-primary) 8%, transparent)`.
- Role + Sair pinned bottom — not a role switcher.

## List pages

- Page title + primary CTA (e.g. Novo orçamento) top-right.
- Optional filter row: `Input` search + `Select` status + intent.
- `Table` in a bordered white wrap (`rounded-md border`) — **not** nested Cards.
- Row click → detail.

## Document detail

1. `Breadcrumb`
2. Title = document number/id (Plex/Archivo 20px) + status `Badge`
3. Compact status trail (text links / muted steps) — interrupt on `cancelado`
4. Action `Button` row — legal only
5. Customer strip: nome, masked CNPJ, WhatsApp
6. Lines `Table`
7. History list + notify `Alert` / live region

## Inbox split

| Region | Content |
|---|---|
| Left 360px | Thread rows: phone, preview, time, intent Badge, unread dot |
| Right | Messages (bubbles muted/primary wash), intent `Select`, links to cadastro/orçamento, admin Simular |

Mobile: stack — list then navigate to thread route.

## KPI strip (optional, real counts only)

Max three: Conversas não lidas · Cadastros pendentes · Orçamentos enviados. Archivo numbers in `--primary`. No fake analytics.

## Density

- Row height ~40px desktop.
- Body 14px; meta 12px.
- Form labels 12px muted above fields.
- Do not use Store comfortable padding.

## What Desk must not do

- Paint sidebar with primary.
- Card grid for operational lists.
- Dark mode toggle in MVP.
- Billing / Conta entry points.
