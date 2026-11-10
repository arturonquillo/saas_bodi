# CRM desk — Conversas e configuração

O desk CRM é a mesa Chatwoot-parity nativa do SaaS (não é sidecar Chatwoot OSS). WhatsApp permanece **Pronto para conectar** (credenciais + simular; sem Meta live até unlock).

Home pós-login: `/saas/conversas`. Legacy `/saas/inbox` redireciona.

## Papéis

| Capacidade | Admin | Vendedor |
|---|---|---|
| Conversas (caixa / assign) | sim | sim (regras de membership) |
| Notas privadas, labels, respostas rápidas | sim | sim |
| Contatos / empresas | sim | sim |
| Credenciais de canal, caixas CRUD, equipes | sim | leitura limitada / sem credenciais |
| Automações, macros públicas, bots, webhooks | sim | macros privadas próprias; resto não |
| Campanhas, central de ajuda (autoria), relatórios | sim | — |
| SLA, Captain, auditoria, segurança, papéis custom | sim | — |
| Simular mensagem inbound | sim | — |

## Fluxo diário (Conversas)

1. Abra `/saas/conversas` — lista + thread + rail de contato/comércio.
2. Filtre por status (`open` / `pending` / `snoozed` / `resolved`), assignee, labels.
3. Responda (stub de entrega no WA) ou note privada.
4. Aplique labels de intent (Cadastro, Orçamento, …) e use deep-links para cadastro/orçamento.
5. Admin: **Simular mensagem** para gerar inbound de demo (telefone E.164, corpo, label opcional).

Disponibilidade do agente (online / ocupado / offline) e sino de notificações ficam no chrome superior.

## Mapa de navegação (estado atual A–E)

### CRM

| Rota | Fase | Uso |
|---|---|---|
| `/saas/conversas` | A | Mesa principal |
| `/saas/contatos` | A | Contatos (+ import CSV em B) |
| `/saas/empresas` | A | Empresas / CNPJ |

### Comércio (fora do desk, mas no mesmo SaaS)

Cadastros · Orçamentos · Pedidos · Vendas · [Estoque](./estoque.md) · Avisos (outbox)

### CRM config

| Rota | Fase | Notas |
|---|---|---|
| `/saas/crm/caixas` | A (+ D widget) | WhatsApp stub + widget Loja |
| `/saas/crm/equipes` | A | |
| `/saas/crm/labels` | A | |
| `/saas/crm/respostas-rapidas` | A | `/shortcode` |
| `/saas/crm/automacoes` | B | Preferir regras inativas no seed |
| `/saas/crm/macros` | B | |
| `/saas/crm/atributos` | B | |
| `/saas/crm/atribuicao` | B | |
| `/saas/crm/horarios` | B | |
| `/saas/crm/bots` | B | URL externa; entrega guardada |
| `/saas/crm/webhooks` | B | |
| `/saas/crm/csat` | B | |
| `/saas/crm/filtros` | B | |
| `/saas/crm/notificacoes` | A/B | |
| `/saas/crm/perfil` | A/B | |
| `/saas/crm/campanhas` | C | Envio stub; não dispara no boot |
| `/saas/crm/central-ajuda` | C | Autoria do portal (admin) |
| `/saas/guia` | C | Guia do usuário (artigos publicados; todos os papéis) |
| `/ajuda/casa-dos-frios-ajuda` | C | Portal público (Loja + link externo) |
| `/saas/crm/relatorios` | C | |
| `/saas/crm/modelos-email` | D | Stub |
| `/saas/crm/sla` | E | Políticas FRT/NRT/RT |
| `/saas/crm/capacidade` | E | |
| `/saas/crm/captain` | E | Assistente stub; sem provider live |
| `/saas/crm/auditoria` | E | |
| `/saas/crm/seguranca` | E | SAML/MFA config; seed login por senha |
| `/saas/crm/integracoes` | E | Catálogo stub |
| `/saas/crm/apps-painel` | E | |
| `/saas/crm/papeis` | E | Custom roles opcional |

## Canal WhatsApp

Em **Caixas** → canal WhatsApp: status máximo operacional no MVP = `ready_stub` (“Pronto para conectar”). Preencha campos Meta-shaped se for testar UI; **não** há Graph/webhook live. Mensagens públicas registram entrega stub; use **Simular** para inbound.

## Widget Loja (Phase D)

Inbox widget seed (`Loja — chat`) alimenta a **mesma** mesa de Conversas. Token demo: `wt_casa_dos_frios_demo`. Em QA (test3), `allowed_origins` precisa incluir o host público — ver [docs/dev](../dev/README.md#deploy-qa-test3).

## O que não fazer

- Esperar envio real Meta / SMTP / redes sociais.
- Tratar Contact sozinho como autorização de Pedido — o gate é **Cliente aprovado**.
- Misturar chrome de Account/assinatura no nav SaaS.
