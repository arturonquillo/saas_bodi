# Estoque — estado atual

O estoque MVP é **thin**: um único ledger por tenant (`on_hand` / `reserved` / `available`). A Loja **projeta** esse ledger (`visivel_loja` + available) — não existe segundo livro de estoque.

## O que existe hoje

| Capacidade | Quem | Onde |
|---|---|---|
| Listar SKUs + saldos | admin, vendedor | `/saas/estoque` |
| Detalhe (on_hand, reserved, available, visível na Loja) | admin, vendedor | `/saas/estoque/[id]` |
| Ajuste de quantidade + motivo | **admin** | detalhe |
| Alternar `visivel_loja` | **admin** | detalhe |
| Reserva automática | sistema | ao criar/confirmar Pedido |
| Liberar reserva | sistema | cancelamento de Pedido (antes do despacho) |

Seed demo: `PICANHA-KG`, `LINGUICA-CX` (MOQ 5), `OCULTO-INTERNO`, `ESGOTADO-VITRINE` — ver [contas-seed.md](./contas-seed.md).

## O que **não** está no estado atual

Preferências de produto pedem um módulo de inventário mais completo — **ainda não shipped**:

- CRUD completo de produto (criar/editar SKU comercial na UI além do ajuste thin)
- Preço de venda / desconto como fluxo de inventário dedicado
- Controle de estoque “full” (movimentações ricas, múltiplos depósitos, etc.)
- Papéis estoquista / entregador
- Chat de inventário com IA

Enquanto isso, catálogo e preços atacado seguem o modelo de produto/arquitetura existentes; vendedor permanece **read-only** no estoque.

## Relação com a Loja

- Só itens `visivel_loja` e com available &gt; 0 (e MOQ) entram no caminho de compra.
- Não invente um estoque “só da loja”.

Quando o módulo expandido de inventário pousar, **atualize este guia** (e o CHANGELOG) no mesmo PR da feature.
