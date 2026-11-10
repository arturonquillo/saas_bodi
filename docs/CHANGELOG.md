# Changelog — Casa dos Frios

Registro vivo do que já entrou na tip de produto/demo. Entradas mais novas no topo.  
Convenção: ao shippar feature, acrescente uma entrada **no mesmo PR** (ver [docs/README.md](./README.md#documentação-viva)).

## 2026-11-10 — SaaS UX amigável (hierarquia + helpers)

- `SaasPage` aceita `description` (pt-BR, uma linha) nas telas não óbvias: Caixas/Canal, Estoque, Orçamentos/Pedidos/Vendas, Cadastros, Configuração, Tema, Avisos.
- Cards/listas Level-1 (`shadow-sm` + `bg-card`); faixas `bg-muted/40` em filtros/status; `EmptyState` com body + CTA onde o brief pede.
- Conversas: chrome intacto; empty zero com body + simular/caixas; filtro vazio só limpa filtros.
- Guia / Usuários / Contatos·Empresas·Labels·Equipes·Respostas sem essay de página.
- Preferência: desk menos flat, dark mode e cursor pointer mantidos.

## 2026-11-10 — WhatsApp Meta Cloud API (live)

- Webhook público `GET/POST /api/webhooks/whatsapp` (+ `/api/webhooks/whatsapp/:inboxId`): challenge Meta + inbound → mesa Conversas; assinatura `X-Hub-Signature-256`.
- Outbound: respostas do agente em caixas WA com `connection_status=live` usam Graph Cloud API (mockável nos testes).
- Admin Caixas → Canal: Phone Number ID, WABA ID, Access Token, App Secret, Verify Token; botão **Conectar Meta (live)**; URL do webhook na UI.
- Somente WhatsApp pode ir a `live` (exige segredos + IDs); demais canais continuam ≤ `ready_stub`.
- Docs: `docs/user/conectar-whatsapp.md`; Guia seed **Conectar WhatsApp**; `.env.example` com `PUBLIC_APP_URL`.
- Seed demo permanece `ready_stub` (sem token Meta real).

## 2026-11-10 — Guia do usuário in-app (Central de Ajuda)

- SaaS: nav + menu **Guia** → `/saas/guia` (artigos publicados do portal seed; admin e vendedor).
- Loja: link **Ajuda** no header/rodapé → `/ajuda/casa-dos-frios-ajuda`.
- Portal público com tema + toggle de aparência (dark mode).
- Seed: categorias Operador / Estoque / Campanhas-tema / Loja + artigos pt-BR (login, conversas, cadastros, orçamentos/pedidos, produto/preço, desconto, ajuste, campanhas, tema, Loja cadastro/pedidos/WhatsApp) + rascunho interno.
- `docs/user/` aponta a superfície web como guia do usuário; Markdown do repo permanece nota de mantenedor.
- Deploy test3: precisa tip + `migrate` + `seed` para os artigos aparecerem.

## 2026-11-10 — test3: inventário + dark mode

- Demo tip `cursor/test3-inventory-dark-8325` @ `202ad23` (merge PR #33 inventário + PR #30 dark mode) em https://test3.lecrunch.com.br.
- Verificado: `/saas/estoque`, toggle de tema no header SaaS/Loja, `/loja`; widget Origin test3 restaurado pós-seed.

## 2026-11-10 — Dark mode + affordances clicáveis

- SaaS + Loja: `ColorModeToggle` persistente no chrome; tokens/tema escuros.
- Listas/navegação: `DetailNavButton` / cursor pointer em controles clicáveis.

## 2026-11-10 — Inventário / Estoque UI + backend

- SaaS UI: lista/busca, **Novo produto**, editar master, toggles `ativo`/`visivel_loja`, **Ajustar quantidade**, histórico de movimentos; vendedor somente leitura no estoque.
- Orçamento/Pedido: desconto de linha com preview lista→líquido e teto `desconto_max_pct` (admin pode exceder).
- Backend: `POST`/`PATCH /api/saas/estoque`, `/ajuste`, `/movimentos`; freeze de desconto nas linhas; Loja `ativo && visivel_loja`.
- Seed: `INATIVO-DEMO`, `PICANHA-KG` desconto máx. 10% + `estoque_inicial`. Guia: `docs/user/estoque.md`.

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
| **Dark mode** (SaaS + Loja, toggle persistente) | Shipped (demo test3) | Tip merge inventário+dark; ver entradas acima |
| **Inventário completo** (CRUD produto, preço/desconto, controle full) | Shipped (backend + SaaS UI) | Ver `docs/user/estoque.md` |
| **SaaS UX amigável** (depth + helpers) | Shipped (UI) | Ver entrada acima + `docs/design/saas-ux-amigavel.md` |
| Account (billing / white-label) | Fora do MVP | Não misturar no nav operacional |
| Meta WhatsApp Cloud live | Shipped (conectar com credenciais Meta) | Ver `docs/user/conectar-whatsapp.md` |

## Antes de A–E (baseline pivot)

- Pivot Casa dos Frios CRM + atacado (spec/MVP/acceptance).
- Arquitetura tenant-ready, seed `casa-dos-frios`, shadcn + saas-starter shell.
- Loja pública + SaaS operações (cadastros, pipeline, estoque thin, tema).
