# shadcn/ui kit — Casa dos Frios

Frontend builds **Loja** and **SaaS** from this file. Account is out of MVP.

Installed in `apps/web` (`components.json`, `src/components/ui/`). Lucide icons only.

**Do not invent a parallel CSS kit.** No `.sf-*` primitives. Compose with Tailwind around shadcn.

Surface chrome: [`visual.md`](./visual.md), [`loja.md`](./loja.md), [`saas-desk.md`](./saas-desk.md). Copy: [`copy-pt-BR.md`](./copy-pt-BR.md).

---

## 1. Two chromes

| Surface | Feel | Type | Tenant theme? |
|---|---|---|---|
| **Loja** `/loja` | Cold-room shop, brand hero, white catalog | Archivo + IBM Plex Sans | Yes — prices, buttons, hero wash |
| **SaaS** `/saas` | Cool light desk, sidebar, tables | Same | Yes — buttons + active bar only |

Seed: primary `#7A1F1F`, accent `#1F5C6B`, background `#EEF2F4`.

`--font-sans` → IBM Plex Sans. `--font-display` → Archivo for titles/hero. No Inter/Geist/Fraunces as product face. No tenant dark mode in MVP.

---

## 2. Token mapping

Tenant tokens remain the editor contract. Map **per surface**.

| Brand alias | Source | Use |
|---|---|---|
| `--brand-accent` | `--color-accent` | Focus `--ring`, WhatsApp outline cue, secondary chips |
| `--brand-accent-foreground` | `--color-text-on-accent` | Text on accent fill if used |

| Tenant / system | shadcn | Notes |
|---|---|---|
| `--color-primary` | `--primary` | Default buttons, links, prices |
| `--color-text-on-primary` | `--primary-foreground` | ≥ 4.5:1 |
| `--color-text` | `--foreground` | |
| `--color-text-muted` | `--muted-foreground` | |
| `--color-danger` | `--destructive` | |
| white / raised | `--card`, `--popover` | |
| hairline `#D8DEE3` | `--border`, `--input` | Not cream border on chrome |
| `--brand-accent` | `--ring` | Focus |
| `--radius-md` | `--radius` | Tables may use 4px |
| `--font-ui` | `--font-sans` | IBM Plex Sans |
| success / warning | utility classes | No shadcn `--success` |

**Critical:** do **not** assign tenant `--color-accent` to shadcn `--accent` (hover wash).

### Loja

| shadcn | Value |
|---|---|
| `--background` | `#ffffff` |
| `--primary` | `--color-primary` |
| `--card` | `#ffffff` |
| `--border` | `#D8DEE3` |
| `--ring` | `--color-accent` |
| `--sidebar*` | unused |

Hero may use `--color-background` as atmospheric wash — not the whole page token dump.

### SaaS

| shadcn | Value |
|---|---|
| `--background` | `#F4F6F7` |
| `--card` | `#ffffff` |
| `--sidebar` | `#FAFBFC` |
| `--sidebar-foreground` | `--color-text` |
| `--sidebar-border` | `#E5E9EC` |
| `--sidebar-primary` | `--color-primary` (active bar only) |
| `--ring` | `--color-accent` |

---

## 3. Install list (frontend)

```bash
npx shadcn@latest add button input label textarea select checkbox switch \
  form table badge alert alert-dialog dialog sheet dropdown-menu \
  sidebar breadcrumb tabs separator skeleton sonner avatar scroll-area \
  card tooltip popover navigation-menu
```

Add only if a screen needs it: `command` (SKU search), `calendar` + `popover` (valido_ate).

---

## 4. Global inventory

| Component | Loja | SaaS | Notes |
|---|---|---|---|
| Button | CTAs, cart, auth | Actions, transitions | default / outline / ghost / destructive |
| Input / Textarea / Label / Form | Cadastro, login, cart qty | All forms | |
| Select | — | Intent, status filters, role | |
| Checkbox / Switch | — | visivel_loja | Switch for visibility |
| Table | — | All list/detail lines | Border wrap, not Card |
| Badge | MOQ, status, Sem estoque | Status, intent, registry | |
| Alert | Gates, registry-down | Gates, stub banners | |
| AlertDialog | — | Desativar user, cancel doc, refuse | |
| Dialog | — | Simular mensagem, adjust stock | |
| Sheet | Mobile nav / cart | Mobile nav, optional thread | |
| Sidebar | — | App shell | |
| Breadcrumb | PDP | Doc detail | |
| Tabs | Meus docs (orçamentos/pedidos) | Optional doc family | |
| Card | Product tile, auth panel | KPI strip only if used | **Not** SaaS lists |
| Skeleton | Catalog, PDP | Tables, inbox | |
| Sonner | Cart, success | Transitions optional | |
| Separator | Header/footer | Sidebar groups | |
| Avatar | — | Optional thread initials | |
| ScrollArea | — | Inbox message pane | |
| DropdownMenu | Account menu | Row actions | |
| Tooltip | — | Truncated cells | |
| NavigationMenu | Optional header | — | Prefer simple links |

---

## 5. Screen compositions

### Loja home

Hero (Tailwind full-bleed) + wordmark/Image slot + `Button` CTAs → catalog `Card` grid + `Badge` + `Button Adicionar`. Header: links + `Button` WhatsApp outline + cart + auth `DropdownMenu`.

### Loja cadastro / login

Centered `Card` → `Form` fields → `Alert` registry-down → submit `Button`.

### Loja cart / checkout

Line list (`Card` or simple rows) → gate `Alert` if pendente → `Button Enviar pedido`.

### Loja meus docs

`Tabs` Orçamentos | Pedidos → list rows + `Badge` → detail with accept/refuse `Button`s.

### SaaS login

Same pattern as Loja auth; marca wordmark; no Loja links.

### SaaS shell

`SidebarProvider` + `Sidebar` + main. Admin group separated by `Separator`.

### Inbox

`ScrollArea` thread list + detail; message bubbles (Tailwind); intent `Select`; admin `Dialog` Simular; `Badge` intents.

### Cadastros

`Table` + detail: `Alert` registry; `Button` Aprovar; `AlertDialog` Recusar + `Textarea` motivo.

### Orçamento / Pedido / Venda detail

`Breadcrumb` + title + `Badge` + action `Button`s + customer strip + lines `Table` + history + notify `Alert`.

### Estoque

`Table` with Switch visível (admin); detail Dialog adjust.

### Usuários

`Table` + Dialog create (`Select` papel) + AlertDialog desativar.

### Tema

Form color `Input`s + logo field + live preview iframe/panel + `Button Salvar` + contrast `Alert`.

### Avisos (outbox)

`Table` read-only: data, canal, status Badge, template, doc id.

---

## 6. Status Badge mapping

| Tone | Badge approach |
|---|---|
| muted / rascunho | `secondary` |
| primary outline / enviado / confirmado | `outline` or default |
| warning / pendente / em_separacao / expirado | class with `--color-warning` |
| success / aprovado / aceito / entregue / faturado | class with `--color-success` |
| danger / cancelado / recusado | `destructive` |
| accent / despachado | class with `--brand-accent` |

Always include the pt-BR label text.

---

## 7. What frontend must not improvise

- Custom button/input/table CSS kit.
- Cards wrapping every SaaS table.
- Tenant accent → shadcn `--accent`.
- Account chrome components.
- Extra routes not in [`overview.md`](./overview.md).
- Color-only status.
