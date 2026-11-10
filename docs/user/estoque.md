# Estoque / inventário

Guia do operador para o módulo de **produtos + estoque** no SaaS. Idioma: **pt-BR**.

Um único ledger por tenant (`on_hand` / `reserved` / `available`). A Loja **projeta** esse ledger (`ativo` + `visivel_loja` + available) — não existe segundo livro de estoque.

Contratos: `docs/product/inventory.md`, `docs/architecture/inventory.md`.

## Quem faz o quê

| Ação | Admin | Vendedor |
|---|---|---|
| Listar / buscar / abrir detalhe | sim | sim |
| Ver movimentos | sim | sim |
| **Novo produto** / editar master | sim | não |
| Alternar `visivel_loja` e `ativo` | sim | não |
| **Ajustar quantidade** (com motivo) | sim | não |
| Usar SKU em Orçamento / Pedido | sim | sim (só `ativo`) |
| Desconto de linha ≤ `desconto_max_pct` | sim | sim |
| Desconto acima do teto do SKU | sim | não |

A UI esconde ações ilegais; a API reforça.

## Telas SaaS

| Rota | Uso |
|---|---|
| `/saas/estoque` | Lista + busca + filtros ativo / visível na loja. CTA **Novo produto** (admin). Linhas com affordance de detalhe. |
| `/saas/estoque/novo` | Cadastro (admin): código, nome, descrição, unidade, preço de venda, desconto máx. %, MOQ, estoque inicial, visível, ativo. |
| `/saas/estoque/[id]` | Detalhe: quantidades, master, toggles, **Ajustar quantidade**, histórico de **Movimentos**. |

### Campos do produto

- **Código (SKU)** — único por tenant; normalizado em maiúsculas.
- **Preço de venda** — lista atacado (`preco_atacado_centavos`); única lista nesta fase.
- **Desconto máx. (%)** — teto para o vendedor nas linhas de Orçamento/Pedido.
- **Unidade** — `un` \| `kg` \| `cx` \| `pct` \| `lt` (rótulo; sem conversão).
- **Ativo** — inativo some da Loja e dos pickers de linha nova; permanece no SaaS para suporte.
- **Visível na loja** — só afeta a projeção da Loja.

### Ajuste e movimentos

- Ajuste: `{ delta_on_hand ≠ 0, motivo }` → movimento `adjust` + atualiza `on_hand`.
- Tipos no histórico: Ajuste, Reserva, Liberação, Consumo.
- Pedido confirmado / cancelado / despachado continua reservando / liberando / consumindo o **mesmo** ledger.

## Desconto em Orçamento / Pedido

Nas telas **Novo orçamento** e **Novo pedido**:

1. Escolha um SKU ativo (picker mostra preço lista e disponível).
2. Informe quantidade e, se permitido, **Desconto (%)**.
3. Preview mostra lista → líquido (arredondamento half-up para centavo no servidor quando o backend upgrade estiver ativo).
4. Vendedor não ultrapassa `desconto_max_pct`; admin pode.

A Loja **não** tem UI de desconto — sempre preço de lista.

## Relação com a Loja

Catálogo público lista SKU **somente se** `ativo && visivel_loja`. Quantidade = `available` do ledger. Sem estoque (`available ≤ 0`) não entra no caminho de compra.

## API (SaaS)

| Método | Path |
|---|---|
| GET/POST | `/api/saas/estoque` |
| GET/PATCH | `/api/saas/estoque/:id` |
| POST | `/api/saas/estoque/:id/ajuste` |
| GET | `/api/saas/estoque/:id/movimentos` |
| PATCH | `/api/saas/estoque/:id/visibilidade` (alias de `visivel_loja`) |

## Seed demo

`PICANHA-KG`, `LINGUICA-CX`, `OCULTO-INTERNO`, `ESGOTADO-VITRINE`, e (com upgrade de seed) `INATIVO-DEMO` + `desconto_max_pct` em pelo menos um SKU. Contas: [contas-seed.md](./contas-seed.md) quando presente na tip.

## Fora desta fase

Importação por IA, multi-depósito, listas de preço múltiplas, `preco_varejo`, imagens de produto, papéis estoquista/entregador.
