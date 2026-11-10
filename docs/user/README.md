# Guia do operador — Casa dos Frios

A superfície **voltada ao usuário** (operador e cliente) é a **Central de Ajuda / Guia no navegador**, não estes Markdown.

| Superfície | URL (local) | URL (QA test3) |
|---|---|---|
| Guia no SaaS (admin/vendedor) | http://localhost:3000/saas/guia | https://test3.lecrunch.com.br/saas/guia |
| Portal público | http://localhost:3000/ajuda/casa-dos-frios-ajuda | https://test3.lecrunch.com.br/ajuda/casa-dos-frios-ajuda |
| Autoria (admin) | http://localhost:3000/saas/crm/central-ajuda | https://test3.lecrunch.com.br/saas/crm/central-ajuda |

Artigos seed (pt-BR) cobrem login, conversas, cadastros, orçamentos/pedidos, estoque, campanhas, tema e Loja. Após deploy: `migrate` + `seed` para popular o portal.

Os arquivos abaixo são **notas de mantenedor / QA** (espelho do produto). Atualize-os quando a tip de demo mudar (ver [política de docs](../README.md#documentação-viva)), e mantenha o portal in-app alinhado via seed ou Central de ajuda.

## Guias (repo)

| Guia | Conteúdo |
|---|---|
| [Login e contas seed](./login.md) | Entrar no SaaS e na Loja; cookies; contas de demo |
| [Contas seed](./contas-seed.md) | Tabela completa de e-mails, papéis e o que cada conta pode fazer |
| [CRM desk](./crm-desk.md) | Conversas, caixas, config Chatwoot-parity (fases A–E) |
| [Conectar WhatsApp](./conectar-whatsapp.md) | Meta Cloud API: webhook, credenciais, status live |
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
