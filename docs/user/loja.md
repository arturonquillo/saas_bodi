# Loja pública

Base: `/loja`. Densidade confortável; marca first (Casa dos Frios). Atacado **CNPJ** no MVP — sem checkout de convidado.

## Superfícies

| Rota | Uso |
|---|---|
| `/loja` | Hero + catálogo |
| `/loja/cadastro` | Solicitação CNPJ |
| `/loja/entrar` | Login cliente |
| Carrinho / pedido | Cliente **aprovado**, `loja_modo=pedido_direto` (seed) |
| Meus docs | Orçamentos / pedidos do cliente |

## Fluxos

### Visitante

1. Vê marca + CTA WhatsApp / catálogo / cadastro.
2. WhatsApp abre `wa.me` do tenant (`whatsapp_comercial` seed).
3. Catálogo mostra só SKUs visíveis; esgotado aparece sem compra.

### Cadastro CNPJ

1. `/loja/cadastro` — CNPJ, razão (registry), contato, WhatsApp, e-mail/senha.
2. Checksum inválido bloqueia; registry down permite seguir com flag `cnpj_registro_pendente`.
3. Status inicial: **pendente**. Operador aprova em `/saas/cadastros`.

### Cliente aprovado

1. Login → adicionar ao carrinho (respeita MOQ e available).
2. **Enviar pedido** → Pedido `confirmado` + reserva no ledger.
3. Pode aceitar/recusar orçamentos enviados pelo SaaS.

### Prospecto

Login OK; banner “cadastro ainda não aprovado”; checkout bloqueado.

## Widget de chat (Phase D)

A Loja pode embutir o widget da caixa website. Bootstrap:

`/api/loja/widget/bootstrap?website_token=…`

Token seed: `wt_casa_dos_frios_demo`. Mensagens caem na mesa `/saas/conversas` (mesma Conversation). Origem do browser precisa estar em `allowed_origins` da caixa.

**Ajuda in-app:** link **Ajuda** no header/rodapé da Loja → `/ajuda/casa-dos-frios-ajuda` (portal seed Phase C). Operadores usam `/saas/guia` (mesmos artigos publicados).

## Contas para testar

Ver [contas-seed.md](./contas-seed.md): `cliente@…` (aprovado) e `prospecto@…` (pendente), senha `Demo@1234`.

## Limites MVP

- Sem varejo/CPF, PIX, NF-e.
- Sem Account/billing na Loja.
- Tema vem do tenant (SaaS admin → Tema).
