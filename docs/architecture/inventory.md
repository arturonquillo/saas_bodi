# Inventory / Estoque — architecture

Contracts for the **full inventory upgrade** (product source: `docs/product/inventory.md`). Extends the thin MVP catalog in [data-model.md](./data-model.md), [api.md](./api.md), [authz.md](./authz.md). Do not reopen product locks here.

**Non-negotiable:** exactly **one** stock ledger (`InventoryBalance` + append-only `InventoryMovement`). Loja never owns a second quantity. No price-list entity. No AI import / `import_apply` in this phase.

## Module boundary

| Concern | Lives in | Does not |
|---|---|---|
| SKU master + list price + discount cap | Catalog / Stock | Sales docs (only freeze snapshots) |
| `on_hand` / `reserved` / movements | Catalog / Stock ledger | Loja, CRM, Account |
| Line list/net price + `desconto_pct` | OrçamentoLine / PedidoLine snapshots | SKU row (cap only) |
| Loja catalog qty | Read projection of ledger | Own table / cache ledger |

Folder ownership unchanged: Prisma + `/api/saas/estoque*` + `/api/loja/catalogo*` = backend; SaaS Estoque UI + Loja catalog = frontend. Shared DTO enums in `packages/shared`.

## Data model

### Sku (extended)

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `codigo` | string | unique `(tenant_id, codigo)`; normalize **trim + uppercase** on write |
| `nome` | string | required |
| `descricao` | string? | max **500** chars; empty → store null |
| `unidade` | enum | `un` \| `kg` \| `cx` \| `pct` \| `lt`; default `un`. Label only — **no** UoM conversion |
| `preco_atacado_centavos` | int ≥ 0 | sole list price this phase |
| `desconto_max_pct` | int 0–100 | default **0**; vendedor line-discount ceiling |
| `qtd_min_atacado` | int ≥ 1 | MOQ; default 1 |
| `visivel_loja` | bool | default `true` on create |
| `ativo` | bool | default `true`; soft-active (no hard delete if movements/lines exist) |
| `created_at` / `updated_at` | datetime | |

**Forbidden columns / tables:** `preco_varejo` as a sales channel, price-list / promo-list entities, `store_stocks`, client-writable `reserved` / `available`, `imagem_url` (deferred), mandatory NCM/CEST.

### InventoryBalance — the only ledger

1:1 with Sku. Unchanged math.

| Column | Type | Notes |
|---|---|---|
| `sku_id` | pk/fk | |
| `tenant_id` | fk | denormalized |
| `on_hand` | int ≥ 0 | |
| `reserved` | int ≥ 0 | |
| invariant | `reserved ≤ on_hand` | enforce on every write |

`available = max(0, on_hand - reserved)` — **computed only**; never a persisted column.

### InventoryMovement — append-only

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | fk | |
| `sku_id` | fk | |
| `type` | enum | `adjust` \| `reserve` \| `release` \| `consume` |
| `qty` | int | for `adjust`: store **signed** delta in `qty` (or `delta_on_hand` alias in API); for others: positive qty |
| `motivo` | string? | **required** non-empty for `adjust`; null for system reserve/release/consume |
| `actor_user_id` | fk? | admin on adjust; null/system on pipeline |
| `pedido_id` | fk? | set for reserve/release/consume |
| `created_at` | datetime | |

#### Movement math (locked)

| Type | Effect | Who |
|---|---|---|
| `adjust` | `on_hand += delta` (`delta ≠ 0`); reject if resulting `on_hand < reserved` | admin |
| `reserve` | `reserved += qty` | Pedido → `confirmado` |
| `release` | `reserved -= qty` | cancel before `despachado` |
| `consume` | `on_hand -= qty`, `reserved -= qty` | → `despachado` |

**Create SKU:** insert `InventoryBalance` with `on_hand = initial` (default 0), `reserved = 0`. If `on_hand > 0`, append one `adjust` with `motivo = "estoque_inicial"` and `actor_user_id` = creator (audit continuity).

No `import_apply` type this phase.

### Document line snapshots (discount)

Extend `OrcamentoLine` and `PedidoLine`:

| Column | Type | Notes |
|---|---|---|
| `sku_id` | fk | |
| `codigo_snapshot` | string | |
| `nome_snapshot` | string | |
| `unidade_snapshot` | enum? | copy of SKU `unidade` at freeze (print/WhatsApp) |
| `qty` | int ≥ 1 | MOQ checked at freeze |
| `preco_lista_centavos` | int ≥ 0 | SKU `preco_atacado_centavos` at freeze |
| `desconto_pct` | int 0–100 | default 0; Loja path always 0 |
| `preco_unitario_centavos` | int ≥ 0 | **net** after discount — billing math |
| `notas` | string? | |

**Rename note:** legacy `unit_price_centavos` → `preco_unitario_centavos` (net). Migrations may keep a synonym during transition; shared types use the names above.

Document total = `sum(preco_unitario_centavos * qty)`.

#### Discount rounding (locked once)

```
gross = preco_lista_centavos
discount_centavos = floor( (gross * desconto_pct) / 100 + 0.5 )   // half-up to integer centavo
preco_unitario_centavos = max(0, gross - discount_centavos)
```

Integer arithmetic equivalent: `floor((gross * desconto_pct + 50) / 100)` then subtract from gross, floor at 0.

Server **computes** net from list + `desconto_pct`. Reject client-supplied `preco_lista_centavos` / `preco_unitario_centavos` that disagree with SKU + formula (**422** `validacao`).

#### Cap enforcement

| Actor | Rule |
|---|---|
| Vendedor | `desconto_pct ≤ sku.desconto_max_pct` at freeze → else **403** `forbidden` (or **422** `desconto_acima_max` — **lock: use 403** `forbidden` with details) |
| Admin | may exceed `desconto_max_pct` |
| Loja customer | no discount field accepted; always freeze list (`desconto_pct = 0`, net = list) |

One discount per line; no coupons / stacking / promo SKU override.

### Soft-active vs visibility

| Flag | Effect |
|---|---|
| `ativo=false` | Omit from Loja catalog; exclude from **new** SaaS line pickers; SaaS list/detail still readable (support); historical snapshots unchanged; **does not** change ledger |
| `visivel_loja=false` | Omit from Loja; SaaS unchanged; ledger unchanged |

Loja lists SKU **iff** `ativo === true && visivel_loja === true`.

### Indexes (additive)

| Table | Index |
|---|---|
| `skus` | unique `(tenant_id, codigo)`; `(tenant_id, ativo, visivel_loja)`; `(tenant_id, nome)` optional for search |
| `inventory_balances` | `(tenant_id)` |
| `inventory_movements` | `(tenant_id, sku_id, created_at DESC)` |

## API map

Envelope and pagination unchanged ([api.md](./api.md)).

### Error codes (inventory-specific)

| HTTP | `code` | When |
|---|---|---|
| 403 | `forbidden` | vendedor mutate SKU/stock; discount above cap |
| 404 | `nao_encontrado` | missing / other tenant / Loja hidden+inactive |
| 409 | `conflito` | duplicate `codigo` (`details.code = codigo_duplicado` acceptable) |
| 409 | `estoque_insuficiente` | reserve / adjust would break available / `on_hand < reserved` |
| 422 | `validacao` | Zod, empty motivo, `delta_on_hand === 0`, descricao > 500, bad enum |
| 422 | `moq_atacado` | qty &lt; MOQ |

### SaaS — product CRUD + stock

| Method | Path | Authz | Body / notes |
|---|---|---|---|
| GET | `/api/saas/estoque` | admin, vendedor | `?q=` código/nome; `?ativo=`; `?visivel_loja=`; cursor page. Returns master + `on_hand`, `reserved`, `available` |
| POST | `/api/saas/estoque` | **admin** | create SKU + balance + optional opening `adjust` |
| GET | `/api/saas/estoque/:id` | admin, vendedor | full master + balances; inactive included |
| PATCH | `/api/saas/estoque/:id` | **admin** | master fields + `ativo` + `visivel_loja`; **never** `on_hand`/`reserved`/`available` |
| POST | `/api/saas/estoque/:id/ajuste` | **admin** | `{ delta_on_hand: int ≠ 0, motivo: string }` → movement + balance |
| GET | `/api/saas/estoque/:id/movimentos` | admin, vendedor | newest first; cursor |

`PATCH .../visibilidade` remains an **optional alias** for `{ visivel_loja }` only; prefer single `PATCH /estoque/:id` for this phase. Do not add import/AI routes.

#### POST create body

```ts
{
  codigo: string
  nome: string
  descricao?: string | null
  unidade?: "un" | "kg" | "cx" | "pct" | "lt"  // default un
  preco_atacado_centavos: number               // int ≥ 0
  desconto_max_pct?: number                    // 0–100, default 0
  qtd_min_atacado?: number                     // ≥ 1, default 1
  visivel_loja?: boolean                       // default true
  ativo?: boolean                              // default true
  on_hand?: number                             // ≥ 0, default 0 — create only
}
```

#### PATCH body

Same master fields as create **except** `on_hand` (rejected if present). Partial update.

#### Estoque item DTO

```ts
{
  id: string
  codigo: string
  nome: string
  descricao: string | null
  unidade: "un" | "kg" | "cx" | "pct" | "lt"
  preco_atacado_centavos: number
  desconto_max_pct: number
  qtd_min_atacado: number
  visivel_loja: boolean
  ativo: boolean
  on_hand: number
  reserved: number
  available: number  // computed
  created_at: string
  updated_at: string
}
```

#### Movement DTO

```ts
{
  id: string
  type: "adjust" | "reserve" | "release" | "consume"
  qty: number            // signed for adjust
  motivo: string | null
  actor_user_id: string | null
  pedido_id: string | null
  created_at: string
}
```

### SaaS — sales lines (discount)

| Method | Path | Change |
|---|---|---|
| POST | `/api/saas/orcamentos` | lines: `{ sku_id, qty, desconto_pct? }` — server freezes list/net; picker excludes `ativo=false` |
| PATCH/lines (if exists) | orçamento lines | same freeze rules while `rascunho` |
| POST | `/api/saas/pedidos` | same; Loja-originated never; SaaS direct may discount |
| Accept Orçamento → Pedido | | copy frozen `preco_lista_centavos`, `desconto_pct`, `preco_unitario_centavos` |

Reject inactive SKU on **new** lines (**422** `validacao` or **404** — **lock: 422** with `sku_inativo`). Hidden SKU may still be used on SaaS lines (internal). Loja path rejects hidden/inactive.

### Loja — projection

| Method | Path | Auth | Filter |
|---|---|---|---|
| GET | `/api/loja/catalogo` | public | `ativo && visivel_loja`; join balance; `available` computed |
| GET | `/api/loja/produtos/:id` | public | same filter else **404** |
| POST | `/api/loja/pedidos` | customer aprovado | lines `{ sku_id, qty }` only — **no** `desconto_pct`; freeze list |

#### Catalog item DTO (extended)

```ts
{
  id: string
  codigo: string          // was `sku` — prefer `codigo`; keep `sku` alias during FE migrate if needed
  nome: string
  descricao: string | null
  unidade: "un" | "kg" | "cx" | "pct" | "lt"
  preco_atacado_centavos: number
  qtd_min_atacado: number
  available: number
  sem_estoque: boolean    // available <= 0
}
```

Zero `available` → listed but cannot add to cart / create Pedido line (`estoque_insuficiente` / `moq_atacado` as applicable).

## Authz matrix (inventory)

| Action | Admin | Vendedor | Cliente Loja |
|---|---|---|---|
| List/read SKUs + balances + movements | yes | yes | projection only |
| Create / edit SKU master | yes | no | no |
| Toggle `visivel_loja` / `ativo` | yes | no | no |
| `ajuste` with motivo | yes | no | no |
| Use SKU on SaaS Orçamento/Pedido | yes | yes (`ativo` only) | buy if aprovado |
| Line `desconto_pct` ≤ cap | yes | yes | no |
| Line `desconto_pct` > cap | yes | no | no |
| Client unit price / available / role | rejected | rejected | rejected |

Helpers: existing `requireSaasRole("admin")` on writes; discount check in domain at line freeze (`assertDescontoPermitido(session, sku, desconto_pct)`).

## Threats (inventory)

| Risk | Rule |
|---|---|
| Client spoofs net/list price | Server sets from SKU + formula; strip client price fields |
| Vendedor exceeds discount cap | Cap check in domain; 403 |
| Loja self-discount | Ignore/reject `desconto_pct` on Loja Pedido |
| Client writes `on_hand`/`reserved`/`available` on PATCH | Zod strip; adjust only via `/ajuste` |
| Second Loja stock table | Forbidden — architecture review blocker |
| Price-list / promo entity | Forbidden this phase |
| Inactive SKU still sold on Loja | Catalog filter `ativo && visivel_loja` |
| Adjust without audit | `motivo` required; actor + timestamp on movement |
| Partial adjust + failed invariant | Single transaction; `on_hand < reserved` → 409, no write |

## Seed additions (`casa-dos-frios`)

Extend [seed.md](./seed.md) SKUs:

| codigo | Notes |
|---|---|
| `PICANHA-KG` | keep; set `desconto_max_pct = 10`, `unidade = kg`, opening movement visible |
| `LINGUICA-CX` | keep MOQ 5; `unidade = cx` |
| `OCULTO-INTERNO` | `visivel_loja=false`, `ativo=true` |
| `ESGOTADO-VITRINE` | available 0 |
| `INATIVO-DEMO` | **new** — `ativo=false`, any balance; proves picker + Loja exclusion |

At least one SKU with `desconto_max_pct > 0`. Seed `InventoryMovement` opening `adjust` (`estoque_inicial`) on ≥1 SKU with `on_hand > 0`.

## Handoff

| Specialist | Tasks |
|---|---|
| **backend** | Prisma columns + migration; POST/PATCH/ajuste/movimentos; discount freeze; Loja `ativo` filter; seed; tests (RBAC, cap, projection, reserve math, one ledger) |
| **frontend** | Estoque Novo/Editar/Ajustar/Movimentos pt-BR; hide admin actions for vendedor; line discount UI; Loja catalog DTO fields |
| **qa** | Product acceptance in `docs/product/inventory.md`; prove Loja `available` moves with SaaS adjust/reserve on same ledger |
| **design** | Optional — forms/states if visual inventory pass needed; else FE follows existing SaaS patterns |

## Explicit non-goals (schema)

- `InventoryImportBatch` / AI chat apply
- Multi-warehouse / estoquista role
- Multi price-list tables
- Fractional stock
- Hard delete of SKUs with history
- Second stock ledger for Loja
