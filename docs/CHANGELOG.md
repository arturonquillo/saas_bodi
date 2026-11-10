# Changelog — Casa dos Frios

Registro vivo do que já entrou na tip de produto/demo. Entradas mais novas no topo.  
Convenção: ao shippar feature, acrescente uma entrada **no mesmo PR** (ver [docs/README.md](./README.md#documentação-viva)).

## 2026-11-10 — Documentação viva do sistema

- Índice `docs/README.md`, guias de operador `docs/user/`, runbook local/QA `docs/dev/README.md`.
- Política: implementadores atualizam docs vivos ao entregar features (`AGENTS.md`).

## 2026-11-10 — Chatwoot parity **A–E** landed

Stack CRM nativo (não sidecar) na tip `cursor/chatwoot-phase-e-frontend-1ddf` / demo test3:

| Fase | Foco | Superfície principal |
|---|---|---|
| **A** | Desk foundation — Conversation, WA stub, contatos, labels, equipes, canned, simulate | `/saas/conversas`, caixas |
| **B** | Operator power — automações, macros, atributos, CSAT, bots, horários, assignment, webhooks | `/saas/crm/*` |
| **C** | Growth — campanhas stub, central de ajuda, relatórios | campanhas, ajuda, relatórios |
| **D** | Omnichannel stubs + widget Loja | caixas widget, `/api/loja/widget/*` |
| **E** | Enterprise & AI stubs — SLA, capacidade, Captain, auditoria, segurança, integrações | `/saas/crm/sla`, captain, auditoria, segurança |

WhatsApp / canais / Captain / integrações permanecem **stub** (sem Meta/SMTP/IdP live não pago). Seed e contratos: `docs/architecture/seed.md`, `docs/product/chatwoot-parity.md`.

Comércio MVP pré-existente permanece: cadastro CNPJ, Orçamento → Pedido → Venda (faturamento stub), estoque thin, Loja projection, outbox e-mail/WhatsApp stub.

## Upcoming (preferências / roadmap próximo)

| Tema | Estado | Notas |
|---|---|---|
| **Dark mode** (SaaS + Loja, toggle persistente) | Ainda não shipped | Preferência de produto; atualizar `docs/user/` + design tokens quando pousar |
| **Inventário completo** (CRUD produto, preço/desconto, controle full) | Ainda não shipped | Estoque atual é thin — ver `docs/user/estoque.md` |
| Account (billing / white-label) | Fora do MVP | Não misturar no nav operacional |
| Meta WhatsApp Cloud live | Bloqueado até unlock pago | UI “Pronto para conectar” |

## Antes de A–E (baseline pivot)

- Pivot Casa dos Frios CRM + atacado (spec/MVP/acceptance).
- Arquitetura tenant-ready, seed `casa-dos-frios`, shadcn + saas-starter shell.
- Loja pública + SaaS operações (cadastros, pipeline, estoque thin, tema).
