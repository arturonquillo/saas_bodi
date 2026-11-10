# Conectar WhatsApp (Meta Cloud API)

Guia mantenedor / operador. A superfície in-app espelha este fluxo no artigo **Conectar WhatsApp** (Guia / portal).

## O que você precisa no Meta Business

No [Meta for Developers](https://developers.facebook.com/) → seu App → **WhatsApp** → **API Setup** / **Configuration**:

| Campo no CRM (Caixas → Canal) | De onde vem no Meta |
|---|---|
| **Phone Number ID** | WhatsApp → API Setup → Phone number ID |
| **WhatsApp Business Account ID (WABA)** | WhatsApp → API Setup → WhatsApp Business Account ID |
| **Access Token permanente** | System User token (Business Settings) ou token permanente do app — **não** use o token temporário de 24h em produção |
| **App Secret** | App settings → Basic → App Secret (para validar `X-Hub-Signature-256`) |
| **Verify Token** | String que **você escolhe**; a mesma deve estar no CRM e no formulário de webhook da Meta |

Também anote o número de exibição (E.164) no campo telefone da caixa.

## URL do webhook (QA test3)

Preferencial (por caixa seed):

```text
https://test3.lecrunch.com.br/api/webhooks/whatsapp/inx_wa_default
```

Global (resolve pelo `phone_number_id` no payload):

```text
https://test3.lecrunch.com.br/api/webhooks/whatsapp
```

Local:

```text
http://localhost:3000/api/webhooks/whatsapp/<inbox_id>
```

Defina `PUBLIC_APP_URL` (ou `WEBHOOK_BASE_URL`) no `.env` para a UI mostrar a URL absoluta.

## Passos (pt-BR)

1. SaaS → **CRM → Caixas** → caixa WhatsApp → aba **Canal**.
2. Preencha Phone Number ID, WABA ID e os três segredos; **Salvar** (status sobe para *Credenciais salvas* se estava vazio).
3. Opcional: **Marcar pronto para conectar** (`ready_stub`) — ainda sem Graph outbound.
4. No Meta → Webhook: cole a URL acima + o **mesmo** Verify Token → Verify and Save (challenge `GET`).
5. Assine o campo **messages**.
6. No CRM: **Conectar Meta (live)** — exige todos os campos; status vira *Conectado (live)*.
7. Envie uma mensagem do celular para o número conectado → deve abrir/continuar conversa em `/saas/conversas`.
8. Responda na mesa — a entrega vai para a Cloud API (não stub).

**Simular mensagem** continua disponível para demos sem Meta.

## Segurança / LGPD

- Tokens nunca voltam em plaintext na API/UI (máscara `••••••••`).
- Criptografia em repouso: `CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM).
- Webhook POST valida assinatura HMAC-SHA256 (`X-Hub-Signature-256`) com o App Secret.
- Isolamento por tenant: canal e conversas sempre filtrados por `tenant_id`.
- Não registre Access Token / App Secret em logs.

## Env

| Variável | Uso |
|---|---|
| `CREDENTIALS_ENCRYPTION_KEY` | Obrigatória (já existente) |
| `PUBLIC_APP_URL` / `WEBHOOK_BASE_URL` | Origem pública para montar a URL do webhook na UI |
| `WHATSAPP_INBOX_MODE` | Documentação; envio live é controlado por `connection_status=live` |
| `META_GRAPH_API_BASE_URL` | Só testes (mock); produção usa `graph.facebook.com` |

## Outros canais

E-mail, SMS, redes sociais, voz e widget permanecem ≤ `ready_stub` (sem HTTP de provedor live).
