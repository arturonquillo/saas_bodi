# Contas seed — `casa-dos-frios`

Após `npm run db:seed` (ou `db:reset`), estas contas existem. Senha de **todas**: `Demo@1234` (somente demo).

## Operadores SaaS

| E-mail | Papel | O que usar para |
|---|---|---|
| `admin@casadosfrios.local` | `admin` | Config CRM, canal WA stub, simular inbound, usuários, tema, config tenant, ajuste de estoque, campanhas, relatórios, SLA, Captain stub, auditoria, segurança |
| `vendedor@casadosfrios.local` | `vendedor` | Conversas (membership), contatos, labels, respostas rápidas, cadastros, orçamentos/pedidos/vendas, estoque **somente leitura** |

Vendedor padrão do tenant (assignee default): `vendedor@casadosfrios.local`.

## Clientes Loja

| E-mail | Status | O que esperar |
|---|---|---|
| `cliente@mercadoexemplo.local` | Cliente **aprovado** (CNPJ `11222333000181`, Mercado Exemplo LTDA) | Catálogo, carrinho, enviar pedido, aceitar/recusar orçamentos, meus docs |
| `prospecto@novaloja.local` | Cadastro **pendente** (CNPJ distinto) | Login OK; banner de aprovação; **sem** checkout |

## SKUs seed (carnes/frios)

| Código | Unidade | Visível | Ativo | Uso |
|---|---|---|---|---|
| `PICANHA-KG` | kg | sim | sim | Happy path; `desconto_max_pct=10`; movimento `estoque_inicial` |
| `LINGUICA-CX` | cx | sim | sim | MOQ = 5 |
| `OCULTO-INTERNO` | un | **não** | sim | Só SaaS / ledger |
| `ESGOTADO-VITRINE` | un | sim | sim | Available = 0 — não compra |
| `INATIVO-DEMO` | un | sim | **não** | Fora da Loja e de novas linhas SaaS |

## CRM seed (resumo)

- Inbox WhatsApp padrão + inbox widget Loja (Phase D+)
- Labels de intent: cadastro, orçamento, info empresa, outro
- Equipe “Vendas”, respostas rápidas, conversas de demo
- Widget token demo: `wt_casa_dos_frios_demo` (ver deploy QA)
- Phases A–E: objetos stub/seed conforme `docs/architecture/seed.md` — **sem** Meta/SMTP live no boot

## Reset

`npm run db:reset` volta exatamente a este contrato. Não há segundo tenant no seed de demo.
