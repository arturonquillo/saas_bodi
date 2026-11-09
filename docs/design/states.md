# States — Casa dos Frios

Empty, loading, error, forbidden, and **cadastro gates**. Copy: [`copy-pt-BR.md`](./copy-pt-BR.md).

**No subscription entitlement states** in MVP.

## Loading

- Keep chrome (Loja header / SaaS sidebar).
- Body → skeletons matching layout (tiles on Loja, rows on SaaS tables, Conversas panes).
- No spinner-only blank page.

## Empty

| Surface | Context | Title | Next step |
|---|---|---|---|
| Loja | Catalog, no visible SKUs | Nenhum produto visível na loja. | None for customer |
| Loja | Cart | Seu carrinho está vazio. | Ver catálogo |
| Loja | Meus docs | Você ainda não tem orçamentos ou pedidos. | Ver catálogo / WhatsApp |
| SaaS | Conversas (zero) | Nenhuma conversa ainda. | Simular mensagem (admin) |
| SaaS | Conversas (filter) | Nenhuma conversa neste filtro. | Limpar filtros |
| SaaS | Contatos | Nenhum contato. | Novo contato |
| SaaS | Empresas | Nenhuma empresa. | Nova empresa |
| SaaS | Labels | Nenhum label. | Criar label |
| SaaS | Equipes | Nenhuma equipe. | Criar equipe |
| SaaS | Respostas rápidas | Nenhuma resposta rápida. | Criar resposta |
| SaaS | Notificações | Nenhuma notificação. | — |
| SaaS | Relatórios stub | Relatórios na fase C. | — |
| SaaS | Cadastros | Nenhum cadastro. | — |
| SaaS | Orçamentos | Nenhum orçamento. | Novo orçamento |
| SaaS | Pedidos | Nenhum pedido. | Novo pedido (aprovado) |
| SaaS | Vendas | Nenhuma venda. | Faturar a partir de um pedido |
| SaaS | Estoque | Nenhum SKU. | Criar SKU (admin) |
| SaaS | Outbox | Nenhum aviso registrado. | — |
| SaaS | Usuários | Nenhum usuário. | Criar usuário |

Empty = title + optional one secondary action. Optional cool gradient tile — no marketing illustration packs. CRM detail: [`crm-desk.md`](./crm-desk.md).

## Error (recoverable)

- Load fail: “Não foi possível carregar.” + **Tentar de novo**.
- Save / transition fail: keep form; show domain reason (MOQ, estoque, `cadastro_nao_aprovado`, 409) or “Não foi possível concluir.”
- Network: generic + retry.
- No stack traces.

## Forbidden

| Who | Where | UX |
|---|---|---|
| Guest | Meus docs / checkout | Redirect `entrar` with return |
| Customer | Someone else’s doc | “Não encontrado.” |
| Vendedor | Usuários / Tema / Config / Caixas / Canal / Equipes / Simular | Redirect Conversas; omit nav |
| Worker | Illegal transition | 403/409 toast; refresh; no side effects |
| Other tenant | Any id | Same as not found |

## Cadastro gates (replace old entitlement)

### Loja — prospecto `pendente`

- Catalog/PDP OK.
- Cart may exist for browsing qty, but **Enviar pedido** removed.
- Banner (`role="status"`): “Seu cadastro ainda não foi aprovado. Você será avisado no WhatsApp.”
- Orçamento accept that creates Pedido: same gate.

### Loja — guest

- Checkout → entrar. Cadastro CTA visible.

### SaaS — accept orçamento / create pedido / faturar

- If cliente not `aprovado`: primary blocked; Alert “Cadastro não aprovado. Aprove o cadastro antes de continuar.”
- Orçamento may remain `enviado`.

## Registry-down (CNPJ)

- Warning Alert (not hard error): “Não consultamos o CNPJ agora. Você pode continuar e completar os dados.”
- Submit allowed; `cnpj_registro_pendente`.
- SaaS cadastro detail shows Badge **Registro pendente**.

## Orçamento expirado

- Badge `expirado`; accept/refuse removed.
- Copy: “Este orçamento expirou.”

## Indisponível / MOQ (Loja)

- Available 0: **Sem estoque**, add disabled, still listed if `visivel_loja`.
- Not visible: not listed.
- Qty &lt; MOQ: inline “Quantidade mínima: N.”

## Success

- Cadastro submitted: confirmation panel, no checkout CTA.
- Pedido placed: “Pedido confirmado.” + link meus docs.
- Cadastro aprovado/recusado: Sonner + detail refresh + notify line.
- Faturado: success Badge + “Faturamento interno registrado (stub).”

## Async / stub honesty

- Outbox rows may show `enviado` without Meta — UI copy still names the **intended** channel.
- Simulate inbound: success toast “Mensagem simulada adicionada.”
- WA canal `ready_stub`: Badge **Pronto para conectar** + Alert that real send/receive awaits Meta approval — never imply live Graph.
- Conversas SSE drop: muted “Atualizando a cada 15s…” + poll fallback; no error explosion.

## CRM connection statuses (Phase A)

| Status | Empty / banner behavior |
|---|---|
| `not_configured` | Canal form empty; primary Salvar |
| `credentials_saved` | Masked secrets; CTA Marcar pronto para conectar |
| `ready_stub` | Success Badge + stub Alert; Simular still available |
| `live` | Not offered |
