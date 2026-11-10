# Login — SaaS e Loja

## SaaS (operadores)

1. Abra `/saas/entrar` (local: http://localhost:3000/saas/entrar).
2. Informe e-mail + senha de um membership do tenant `casa-dos-frios`.
3. Em sucesso, a sessão HttpOnly `cdf_sessao_saas` é criada e o destino padrão é **Conversas** (`/saas/conversas`).

Papéis MVP: **admin** e **vendedor**. O papel vem da membership no servidor — a UI só esconde; a API rejeita.

| Situação | Comportamento |
|---|---|
| Credenciais inválidas | Erro inline; sem cookie |
| Usuário inativo | Mensagem “Conta desativada.” |
| Já autenticado | Redirect para Conversas |
| Vendedor em rota admin | Redirect / 403 |

Sair: use a ação de logout do chrome SaaS (invalida o cookie da superfície).

Guia in-app (após login): menu **Guia** → `/saas/guia`, ou portal público `/ajuda/casa-dos-frios-ajuda`.

## Loja (clientes CNPJ)

1. Abra `/loja/entrar`.
2. Cookie de sessão: `cdf_sessao_loja` (separado do SaaS).
3. Prospecto (`cadastro pendente`) e cliente `aprovado` podem entrar; **checkout** só com cadastro aprovado.

## Contas seed (demo)

Senha compartilhada: **`Demo@1234`**.

| E-mail | Superfície | Papel |
|---|---|---|
| `admin@casadosfrios.local` | SaaS | admin |
| `vendedor@casadosfrios.local` | SaaS | vendedor |
| `cliente@mercadoexemplo.local` | Loja | Cliente aprovado |
| `prospecto@novaloja.local` | Loja | Cadastro pendente |

Guia completo: [contas-seed.md](./contas-seed.md). Contrato técnico: `docs/architecture/seed.md`.

## Tenant

Não há wizard de onboarding. O slug padrão é `casa-dos-frios` (`NEXT_PUBLIC_DEFAULT_TENANT_SLUG`). APIs autenticadas leem `tenantId` só da sessão.
