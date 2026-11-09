# SaaS Desk chrome — Casa dos Frios

Layout and density for `/saas`. Flows: [`saas.md`](./saas.md). **CRM Phase A desk:** [`crm-desk.md`](./crm-desk.md). Tokens: [`tokens.md`](./tokens.md).

Shell follows **saas-starter** dashboard nesting (header + sidebar). Do not invent a second chrome.

## Shell

```
┌──────── sidebar 240px ────────┬──────── main ─────────────────────┐
│ [logo/wordmark]               │ starter header (bell · status)     │
│ Casa dos Frios                │ breadcrumb / SaasPage title        │
│                               │────────────────────────────────────│
│ CRM                           │ content:                           │
│  Conversas                    │  · Conversas = full-bleed 3-pane   │
│  Contatos / Empresas          │  · other pages = SaasPage + Cards  │
│ Comércio                      │                                    │
│  Cadastros … Estoque · Avisos │                                    │
│ CRM config (admin+)           │                                    │
│  Caixas · Equipes · Labels …  │                                    │
│ Admin                         │                                    │
│  Usuários / Config / Tema     │                                    │
│                               │                                    │
│ Admin · Sair                  │                                    │
└───────────────────────────────┴────────────────────────────────────┘
```

- Canvas: `#F4F6F7`.
- Sidebar: `#FAFBFC`, 1px right border `#E5E9EC`.
- Active nav: 3px `--primary` left bar + `color-mix(in srgb, var(--color-primary) 8%, transparent)`.
- Role + Sair pinned bottom — not a role switcher.
- Header: agent availability `Select` + notifications bell (CRM Phase A).

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

## Conversas split (Phase A — replaces Inbox)

Full-bleed inside main (no outer Card). Spec: [`crm-desk.md`](./crm-desk.md).

| Region | Width | Content |
|---|---|---|
| Filter strip | 220px (≥1280) | Status / caixa / assignee / label filters |
| List | 320px | Rows: nome/phone, preview, time, status Badge, label dots, unread |
| Thread | flex | Header controls + messages `ScrollArea` + composer |
| Context | 280px | Contato, labels, assign, commerce deep links |

Mobile: list → `/saas/conversas/:id` thread; filters/context = `Sheet`. Legacy `/saas/inbox` redirects here.

**Cards wrap Contatos / Labels / settings lists only — never the Conversas panes.**

## KPI strip (optional, real counts only)

Max three: Conversas não lidas · Cadastros pendentes · Orçamentos enviados. Archivo numbers in `--primary`. No fake analytics. No Relatórios charts in Phase A.

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
