# SaaS UX — Casa dos Frios

Operator workspace. Base `/saas`. Tenant theme, **compact** density. CRM-first. **Zero Account / billing chrome.**

Chrome detail: [`saas-desk.md`](./saas-desk.md). Kit: [`shadcn.md`](./shadcn.md).

## 1. Context

### Users

| Role | Jobs |
|---|---|
| **Admin** | Users/RBAC, tema, config, simulate WhatsApp, everything vendedor can do |
| **Vendedor** | Inbox, cadastros approve/refuse, orçamento→pedido→venda, read estoque |

### Primary goal

Move WhatsApp-led demand into cadastro + Orçamento → Pedido → Venda without leaving the desk.

### Constraints

- Roles only `admin` | `vendedor`.
- Cadastro `aprovado` before Pedido / Venda / accept→Pedido.
- WhatsApp inbox simulated; outbox stub.
- pt-BR; CNPJ masked; shadcn only.

## 2. Information hierarchy

1. Current work (unread threads / pending cadastros / open docs).
2. Document **status** + legal next action.
3. Customer identity (masked CNPJ, phone).
4. Line items / stock numbers.
5. History + outbox evidence.

## 3. Flows

### Login

**Entry:** `/saas/entrar`

**Happy path:** email + password → session cookie `cdf_sessao_saas` → home **Inbox**.

**Alternate:** bad credentials → inline error; inactive user → “Conta desativada.”; already session → redirect Inbox.

**Completion:** Sidebar shows marca + role chip.

### Admin — users / RBAC

**Entry:** `/saas/usuarios` (admin only; vendedor → redirect Inbox).

**Happy path:** list users → criar (email, nome, papel `admin`|`vendedor`, senha inicial) → appears ativo → desativar (confirm) → cannot login.

**Must not:** client-side role escalation; delete that erases audit (deactivate only).

### CRM — WhatsApp inbox (simulated)

**Entry:** `/saas/inbox`

**Layout:** thread list (phone, last preview, intent Badge, unread) | conversation + composer tools.

**Happy path:**

1. Admin **Simular mensagem** (Dialog): phone E.164, body, optional intent → thread appears.
2. Vendedor opens thread → tags intent (`cadastro` | `orcamento` | `info_empresa` | `outro`).
3. Intent `cadastro` → link/create Solicitação; `orcamento` → link/create Orçamento rascunho.
4. Reply is **outbox stub** note in UI (no Meta send) — show “Registrado no outbox (stub).”

**Empty:** “Nenhuma conversa ainda.” + admin CTA simular.

### Cadastro CNPJ approval

**Entry:** `/saas/cadastros` or from inbox.

**Happy path:** open `pendente` → review CNPJ (masked), razão, contact → **Aprovar** → Cliente created + outbox → status `aprovado`.

**Refuse:** Dialog reason (required) → `recusado` + outbox.

**Registry pending badge:** show warning chip `cnpj_registro_pendente`; approval still allowed.

### Pipeline — Orçamento → Pedido → Venda

#### Orçamento

1. Create `rascunho` (cliente or prospect phone/CNPJ); add lines (SKU, qty, frozen `preco_atacado`).
2. Set `valido_ate` → **Enviar** → `enviado` + outbox.
3. **Aceitar** (if cliente `aprovado`) → auto Pedido `confirmado` + reserve.
4. If not aprovado: accept blocked with gate copy; keep `enviado`.
5. Recusar / cancelar / expirado per matrix — omit illegal buttons.

#### Pedido de venda

- From accepted orçamento **or** direct create for `aprovado` cliente (`loja_modo` / SaaS).
- Status trail: `confirmado` → `em_separacao` → `despachado` → `entregue`.
- Cancel before despacho releases reserve.
- Notify line on each change.

#### Venda / Faturamento (stub)

- From Pedido `confirmado`+: **Faturar** → Venda `rascunho` → **Confirmar faturamento** → `faturado` + outbox.
- No NF-e fields. Banner: “Faturamento interno (stub) — sem NF-e.”

### Catálogo / estoque (thin)

List + detail: on_hand, reserved, available, `visivel_loja` (admin), adjust qty + motivo (admin). Vendedor read-only.

### Tema / Config / Outbox

- Tema: admin; live preview; contrast gate.
- Config: razao/fantasia/CNPJ tenant, WhatsApp comercial, `canais_aviso`, `loja_modo`, vendedor padrão.
- Outbox: read-only table for admin + vendedor.

## 4. Visual direction

Cold desk — see [`visual.md`](./visual.md). Focal point on each doc page = **status + next action row**.

## 5. Layout

### Desktop

Sidebar 240px + main. Inbox = split list/detail. Doc pages = breadcrumb, title+badge, actions, lines table, history.

### Mobile

Sidebar → Sheet. Inbox → list then full-screen thread. Action buttons full-width stack.

## 6. Components

See [`shadcn.md`](./shadcn.md) SaaS inventory. Mandatory primitives: `Sidebar`, `Table`, `Badge`, `Button`, `Dialog`, `Sheet`, `Tabs`, `Select`, `Form`, `Input`, `Textarea`, `Alert`, `Skeleton`, `DropdownMenu`, `Breadcrumb`, `Sonner`, `Separator`, `Avatar` (optional initials).

## 7. Interaction behavior

- Only legal transitions rendered.
- Destructive: AlertDialog with consequence copy.
- After success: refresh detail + Sonner optional + `aria-live` notify line.
- Simulate WhatsApp: admin only.

## 8. States

See [`states.md`](./states.md) — empty inbox, loading skeletons, 403/409, cadastro gate, registry-down, expired orçamento.

## 9. Responsive

| Element | <768px |
|---|---|
| Sidebar | Sheet trigger |
| Tables | horizontal scroll or stacked definition list for doc lines |
| Primary actions | full width, ≥ 48px |

## 10. Tokens

Tenant primary/accent; compact density; system status colors.

## 11. Accessibility

[`a11y.md`](./a11y.md). Inbox list semantics; dialogs trap focus; status live regions.

## 12. Copy

[`copy-pt-BR.md`](./copy-pt-BR.md).

## 13. Handoff to frontend

### Must implement

Screens and flows above; hide admin nav from vendedor; simulate-mensagem Dialog; pipeline buttons per product matrix.

### Must not improvise

- Account links or entitlement banners.
- Meta WhatsApp real send UI.
- NF-e fields.
- Extra roles.
- Parallel CSS kit.
