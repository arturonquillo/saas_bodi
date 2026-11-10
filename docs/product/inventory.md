# Inventário / Estoque — upgrade Casa dos Frios

Product brief for the **full inventory upgrade** after the thin MVP catalog. Behavior here **extends** `docs/product/spec.md` (section *Catalog and stock*). MVP slice remains demoable; this phase makes **cadastro de produtos + controle de estoque + preço/desconto** usable by Casa dos Frios operators.

**UI copy:** pt-BR only. **Ledger rule (AGENTS.md):** exactly **one** stock ledger. Loja never owns a second quantity.

## Problem

Today the SaaS **estoque** surface is insufficient for operations:

- Operators cannot **add products** from the UI (list + visibility + qty adjust only).
- Sale price exists as a thin `preco_atacado`, but there is **no commercial discount model**.
- Stock movements exist in the API for pedido reserve/consume/release and admin adjust, but the product UX does not expose a complete **controle de estoque** loop (create → price → stock → movements → Loja projection).

Casa dos Frios needs to register SKUs (carnes/frios lean, other atacado lines), set **preço de venda (atacado)**, apply **desconto** on commercial documents, and control **on_hand / reserved / available** without inventing a second ledger or a parallel Loja stock table.

## Goals

1. Admin can **criar, editar e desativar** produtos (SKUs) with locked fields.
2. Admin can set **preço de venda atacado** and initial / adjusted stock with audited movements.
3. Vendedor can **consultar** estoque and pick SKUs into Orçamento/Pedido; cannot mutate ledger or master data.
4. Commercial **desconto** on document lines is locked and distinct from **listas de preços**.
5. Loja catálogo remains a **projection** of the same ledger + `visivel_loja` (+ `ativo`).
6. pt-BR labels; server trusts nothing from the client for price, discount net, role, or qty.

## Non-goals (this phase)

| Out | Why |
|---|---|
| Multiple warehouses / estoquista / entregador roles | Still later per spec roadmap |
| AI inventory file chat / import apply | Deferred (AGENTS.md stub stays stub) |
| NF-e / fiscal stock books / CEST/NCM mandatory | Fiscal later; optional free-text `ncm` only if useful — **not required** |
| Multi-lista de preços (cliente A vs B, varejo vs atacado tables) | Explicitly out — see *Desconto vs listas de preços* |
| `preco_varejo` / CPF varejo channel | Still out of atacado-first product |
| Returns / RMA stock | Later |
| Product images / rich media gallery | Later (optional `imagem_url` **not** in this phase) |
| Units of measure conversion (kg↔cx) | Single `unidade` enum; no conversion engine |
| Second Loja ledger / `store_stocks` | Forbidden |

## Personas and roles

| Actor | Inventory job |
|---|---|
| **Admin** | Full product master + stock writes + visibility + deactivate |
| **Vendedor** | Read catalog/estoque; create Orçamento/Pedido lines from catalog; apply line discount within caps |
| **Cliente (Loja)** | Sees projection only (`ativo` + `visivel_loja` + `available`); never writes stock |

Roles remain **`admin` \| `vendedor`** only. No new SaaS role in this phase.

### Permission matrix (locked)

| Action | Admin | Vendedor | Cliente Loja |
|---|---|---|---|
| List / read SKUs + balances + movements | yes | yes | projection only (catalog) |
| Create SKU (+ initial `on_hand`) | yes | no | no |
| Edit SKU master (nome, preço lista, MOQ, unidade, …) | yes | no | no |
| Toggle `visivel_loja` | yes | no | no |
| Set `ativo` (desativar / reativar) | yes | no | no |
| Ajuste de estoque (`adjust` with motivo) | yes | no | no |
| Use SKU on Orçamento / Pedido lines | yes | yes | buy path only if aprovado |
| Apply **desconto de linha** on Orçamento/Pedido | yes | yes (≤ `desconto_max_pct`) | no |
| Exceed `desconto_max_pct` on a line | yes only | no | no |
| Client-supplied unit price / available / role | rejected | rejected | rejected |

API enforces; UI only hides.

## Product master — locked fields

Canonical entity remains **SKU** (UI: **Produto** / **Estoque**). Money = **integer centavos** BRL. Quantities = **non-negative integers** (no fractional stock in this phase).

| Field (API snake) | Type | Required | Notes / UI (pt-BR) |
|---|---|---|---|
| `codigo` | string | yes | Código / SKU; unique per tenant; normalized trim + uppercase |
| `nome` | string | yes | Nome do produto |
| `descricao` | string | no | Descrição curta (SaaS detail + Loja when visible); max length architect-locked (~500) |
| `unidade` | enum | yes | `un` \| `kg` \| `cx` \| `pct` \| `lt` — UI: Unidade. Default `un` |
| `preco_atacado_centavos` | int ≥ 0 | yes | **Preço de venda (lista atacado)** — sole list price this phase |
| `desconto_max_pct` | int 0–100 | yes | Cap % for vendedor line discount; default **0** (no discretionary discount unless admin raises) |
| `qtd_min_atacado` | int ≥ 1 | yes | MOQ; default 1 |
| `visivel_loja` | bool | yes | Exibir na loja; default `true` on create |
| `ativo` | bool | yes | Soft-active; default `true`. Inactive SKUs hidden from Loja and from **new** line pickers; remain on historical document snapshots |
| `on_hand` | int ≥ 0 | create only | Initial balance; creates ledger row + optional opening `adjust` movement |
| `reserved` | int ≥ 0 | read-only | From ledger |
| `available` | int ≥ 0 | computed | `max(0, on_hand - reserved)` — never stored as a second ledger |

**Forbidden:** client write of `reserved`, `available`, or a Loja-only qty field.

### Create / edit UX (SaaS)

- **Lista de estoque:** search by código/nome; columns: código, nome, unidade, preço, on hand, reserved, available, visível, ativo.
- **Novo produto** (admin): form with locked fields; on success opens detail.
- **Detalhe:** master edit (admin), quantities, **histórico de movimentos**, visibility + ativo toggles, **ajustar quantidade**.
- **Vendedor:** same list/detail read-only; no Novo / Ajustar / toggles.

Duplicate `codigo` → **409** `codigo_duplicado` (or shared `conflito`).

## One stock ledger (locked)

```
Sku 1──1 InventoryBalance (on_hand, reserved)
     1──* InventoryMovement (append-only)
```

- Loja catalog qty = **projection** of this balance, never a second table.
- Toggling `visivel_loja` or `ativo` **does not** change `on_hand` / `reserved`.
- Pedido reserve / release / consume continue to write **the same** movements + balance (spec pipeline unchanged).

### Movement types (locked)

Keep domain types; UI labels pt-BR:

| Type | UI | Effect | Who / when |
|---|---|---|---|
| `adjust` | Ajuste / Entrada / Saída | `on_hand += delta` (signed); reject if resulting `on_hand < reserved` | Admin; motivo **required** (non-empty) |
| `reserve` | Reserva | `reserved += qty` | System on Pedido → `confirmado` |
| `release` | Liberação | `reserved -= qty` | System on cancel before `despachado` |
| `consume` | Consumo | `on_hand -= qty`, `reserved -= qty` | System on → `despachado` |

No `import_apply` in this phase. Opening stock on create = balance seed; if `on_hand > 0`, write one `adjust` with reason `estoque_inicial` (or equivalent) for audit continuity.

### Ajuste rules

- Body: `{ delta_on_hand: int ≠ 0, motivo: string }` (or allow 0 → **422**).
- Positive delta = entrada; negative = saída (same type `adjust`).
- Actor + timestamp on movement; list on SKU detail (newest first).

## Relação com catálogo da Loja (projection)

Loja `GET` catalog lists a SKU **iff**:

1. `ativo === true`, and
2. `visivel_loja === true`

Shown fields (minimum): `nome`, `codigo`, `unidade`, `preco_atacado_centavos`, `qtd_min_atacado`, `available`, `sem_estoque` (`available <= 0`). Optional: `descricao`.

Rules:

- `available = max(0, on_hand - reserved)` from the **single** ledger.
- Zero available → cannot add to cart / create Pedido line.
- Inactive or hidden SKU → **404/omit** on public catalog; SaaS still lists for admin (vendedor sees inactive as read-only for support, but pickers for **new** lines exclude `ativo=false`).
- Guest checkout still forbidden; cadastro gate unchanged.

## Preço, desconto e listas de preços (locked)

### Lista de preços (this phase)

- **One list price per SKU:** `preco_atacado_centavos`.
- That value is the **preço de tabela / preço de venda de lista** for Orçamento, Pedido, and Loja.
- **No** multi-price-list module (no per-customer lists, no channel price books, no varejo list).
- Changing list price **does not** rewrite frozen lines on existing documents (snapshot rule stays).

### Desconto (this phase)

Discount is a **commercial line adjustment on documents**, not a second catalog price and not a price list.

| Concern | Decision |
|---|---|
| Where | Orçamento lines and Pedido lines (including Loja-created Pedido: **no** customer self-discount — Loja always pays list) |
| Who sets | Admin / vendedor on SaaS documents |
| Shape | Per line: `desconto_pct` (0–100, integer) **or** architect may store derived net only — product requires **auditable** list unit, discount, and net unit on the line snapshot |
| Net unit | `preco_unitario_liquido_centavos = preco_lista_centavos - discount`, floored at 0; prefer % applied then round **half-up to centavo** (architect locks rounding once in contracts) |
| Cap | Vendedor: `desconto_pct ≤ sku.desconto_max_pct` at line freeze time. Admin: may exceed cap |
| Loja | Ignores discount fields; always freezes list price |
| Stacking | One discount per line; no coupon engine |
| Document total | Sum of `(net_unit * qty)` |

**Not** in this phase: SKU promotional price override field, automatic campaign discounts, payment-condition discounts, or “lista promocional” entities.

### Line snapshot (extends existing freeze)

When a line is created/frozen, persist at least:

- `sku_id`, `nome` (or codigo+nome), `qty`
- `preco_lista_centavos` (from SKU list at freeze)
- `desconto_pct` (0 if none)
- `preco_unitario_centavos` (**net** after discount — what billing math uses)
- optional `unidade` copy for print/WhatsApp

Server computes net from SKU list + submitted discount; **reject** client-supplied net/list mismatch.

## Interaction with sales pipeline

Unchanged state machines. Stock hooks stay:

| Event | Stock |
|---|---|
| Pedido → `confirmado` | reserve **qty** at available check (MOQ + ativo + not hidden for Loja path) |
| Cancel before `despachado` | release |
| → `despachado` | consume |

Pricing:

- Orçamento/Pedido SaaS lines may include discount per rules above.
- Accept Orçamento → Pedido copies frozen net prices (and discount snapshot) onto Pedido lines; stock reserve uses qty only.
- Direct Pedido and Loja Pedido: Loja = list only; SaaS direct Pedido may discount like Orçamento.

Inactive SKU: cannot add to **new** lines; existing open docs keep snapshots.

## UX surfaces (pt-BR)

### SaaS — Estoque

| Screen | Purpose |
|---|---|
| Lista | Busca + tabela; CTA **Novo produto** (admin) |
| Novo / Editar | Master fields |
| Detalhe | Quantidades, preço, toggles, **Ajustar quantidade**, **Movimentos** |
| (Pipeline) | Line picker excludes inactive; shows available + list price; discount input if cap > 0 or admin |

Copy keys (indicative): `estoque_title` → Estoque; `novo_produto` → Novo produto; `ajustar_quantidade` → Ajustar quantidade; `preco_venda` → Preço de venda; `desconto` → Desconto; `on_hand` → Em estoque; `reserved` → Reservado; `available` → Disponível; `visivel_loja` → Visível na loja; `ativo` → Ativo; `motivos` → Motivo; `movimentos` → Movimentos.

### Loja

Catálogo projection only; no discount controls.

## Seed / demo additions

Extend `casa-dos-frios` seed (architect/backend):

- At least one SKU with `desconto_max_pct > 0` for vendedor demo.
- Keep hidden + zero-available SKUs.
- One inactive SKU to prove picker/Loja exclusion.
- Opening movements visible on a seeded SKU detail.

## Acceptance criteria (product)

1. Admin creates a product with código, nome, unidade, preço, MOQ, estoque inicial, visível, ativo → appears in SaaS list and (if visible+ativo+available) in Loja.
2. Vendedor cannot create/edit/adjust/toggle; can read and sell.
3. Admin adjust with motivo updates on_hand, writes movement, rejects `on_hand < reserved`.
4. Pedido confirm/cancel/dispatch still reserve/release/consume on the **same** ledger; Loja qty tracks it.
5. Vendedor line discount above `desconto_max_pct` → 403/422; admin may exceed; Loja checkout never applies discretionary discount.
6. No second stock table; no price-list entity; no AI import path.
7. All operator copy pt-BR.

## Specialist handoff — acceptance checklist

### Architect

- [ ] Extend Sku + line snapshot contracts (`descricao`, `unidade`, `ativo`, `desconto_max_pct`, discount fields on orçamento/pedido lines).
- [ ] Confirm single ledger + movement math unchanged; document opening `adjust` on create.
- [ ] Authz matrix matches this brief; Loja projection filters `ativo && visivel_loja`.
- [ ] Rounding rule for % discount → centavos locked once in `docs/architecture/`.
- [ ] OpenAPI / api.md / data-model patched; threats: client price/discount/net spoofing.
- [ ] Explicitly **no** price-list table and **no** second Loja qty in schema.
- [ ] Seed fixtures for max-discount, inactive, hidden, zero-available.

### Backend

- [ ] `POST/PATCH /api/saas/estoque` support full master fields; create balance + optional opening movement.
- [ ] Enforce admin-only writes; vendedor read; discount cap on line create/update.
- [ ] Freeze list + discount + net on lines; reject client net/list tampering.
- [ ] Loja catalog + buy path honor `ativo`; inactive excluded from new SaaS pickers.
- [ ] Adjust + list movements; invariant `reserved ≤ on_hand`.
- [ ] Tenant isolation + tests for RBAC, discount cap, projection filters, reserve math.

### Frontend

- [ ] Estoque: **Novo produto**, edit master, ativo/visível toggles, adjust dialog, movements list (pt-BR).
- [ ] Hide illegal actions for vendedor.
- [ ] Orçamento/Pedido line UI: discount control respecting cap; show list vs net.
- [ ] Loja catalog unchanged pattern (projection); no discount UI.
- [ ] shadcn only; no parallel CSS kit; empty/error/loading states.

### QA (follow-up)

- [ ] Walk acceptance criteria above on seed; regression on Pedido stock machine and cadastro gate.
- [ ] Prove one ledger (Loja available moves with SaaS adjust/reserve).

## Open questions

**Resolved (do not reopen in implementation):**

| Question | Decision |
|---|---|
| Can vendedor create products? | **No** — admin only |
| Multiple price lists? | **No** this phase — single `preco_atacado_centavos` |
| What is desconto? | Line % on Orçamento/Pedido SaaS; cap `desconto_max_pct`; admin may exceed; Loja = list only |
| Fractional kg stock? | **No** — integer qty; `unidade` is label only |
| Soft delete? | `ativo=false`; no hard delete if movements/lines exist |
| AI import? | Still deferred |
| New roles? | No |

**Blocking open questions:** none for architect start.

## Doc map

| Doc | Role |
|---|---|
| This file | Inventory upgrade source of truth |
| `spec.md` | Patched pointer + condensed locked rules |
| `mvp.md` / `mvp-acceptance.md` | Thin MVP preserved; pointers to this upgrade |
| `brief.md` | Overview pointer |
| `docs/architecture/*` | Contracts after architect pass |
