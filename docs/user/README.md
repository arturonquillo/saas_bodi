# Guia do operador — Casa dos Frios

Documentação **viva** para quem opera o SaaS e a Loja no dia a dia. Idioma: **pt-BR**.

Atualize estes guias sempre que uma feature chegar à tip usada em demo/QA (ver [política de docs](../README.md#documentação-viva)).

## Guias

| Guia | Conteúdo |
|---|---|
| [Login e contas seed](./login.md) | Entrar no SaaS e na Loja; cookies; contas de demo |
| [Contas seed](./contas-seed.md) | Tabela completa de e-mails, papéis e o que cada conta pode fazer |
| [CRM desk](./crm-desk.md) | Conversas, caixas, config Chatwoot-parity (fases A–E) |
| [Estoque](./estoque.md) | Ledger único, CRUD admin, desconto de linha, projeção Loja |
| [Loja](./loja.md) | Vitrine pública, cadastro CNPJ, compra, widget |

## URLs úteis

| Ambiente | Loja | SaaS |
|---|---|---|
| Local | http://localhost:3000/loja | http://localhost:3000/saas |
| QA (test3) | https://test3.lecrunch.com.br/loja | https://test3.lecrunch.com.br/saas |

Senha de todas as contas seed: `Demo@1234`. Detalhes: [contas-seed.md](./contas-seed.md).

## Fora deste guia

- Contratos de produto/arquitetura/design → `docs/product/`, `docs/architecture/`, `docs/design/`
- Como subir o app / migrate / seed → [docs/dev/README.md](../dev/README.md)
