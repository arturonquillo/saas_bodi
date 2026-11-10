# Estoque

Um único ledger por tenant (`on_hand` / `reserved` / `available`). A Loja **projeta** esse ledger (`ativo` + `visivel_loja` + available) — não existe segundo livro de estoque.

## Capacidades (backend)

| Capacidade | Quem | Onde |
|---|---|---|
| Listar / detalhar SKUs + saldos + movimentos | admin, vendedor | `/saas/estoque`, `/saas/estoque/[id]`, `/movimentos` |
| Criar / editar produto (código, nome, unidade, preço lista, MOQ, `desconto_max_pct`, `ativo`, `visivel_loja`) | **admin** | `POST` / `PATCH /api/saas/estoque` |
| Ajuste de quantidade + motivo | **admin** | `POST .../ajuste` (`delta_on_hand`, `motivo`) |
| Desconto de linha em Orçamento/Pedido | admin (sem teto); vendedor ≤ `desconto_max_pct` | SaaS docs |
| Reserva / liberação / consumo | sistema | máquina de Pedido |

Seed: `PICANHA-KG` (kg, desconto máx. 10%), `LINGUICA-CX` (MOQ 5), `OCULTO-INTERNO`, `ESGOTADO-VITRINE`, `INATIVO-DEMO` — ver [contas-seed.md](./contas-seed.md) quando disponível.

## Regras rápidas

- `available = max(0, on_hand − reserved)` — só calculado, nunca coluna de ledger.
- Loja lista iff `ativo && visivel_loja`; Loja **não** aplica desconto (sempre preço lista).
- SKU inativo: fora da Loja e de **novas** linhas SaaS; snapshots históricos permanecem.
- Abrir estoque na criação com `on_hand > 0` grava movimento `adjust` / `estoque_inicial`.

## Fora deste guia (ainda)

- UI completa Novo/Editar/Ajustar (frontend follow-up)
- Múltiplos depósitos / papéis estoquista
- Chat de inventário com IA / import apply
- Listas de preços múltiplas
