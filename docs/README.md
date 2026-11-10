# Documentação — Casa dos Frios

Índice da documentação do monorepo. **Fonte de verdade de produto:** [`product/spec.md`](./product/spec.md).

## Mapa

| Área | Path | Público |
|---|---|---|
| **Produto** | [`product/`](./product/) | Spec, MVP, acceptance, Chatwoot parity |
| **Arquitetura** | [`architecture/`](./architecture/) | Stack, data model, API, authz, seed, CRM contracts |
| **Design** | [`design/`](./design/) | UX, tokens, CRM desk, Loja, shadcn inventory |
| **Operador (pt-BR)** | [`user/`](./user/) | Login, CRM, estoque (estado atual), Loja, contas seed |
| **Desenvolvimento** | [`dev/README.md`](./dev/README.md) | Run, migrate, seed, ponteiro deploy test3 |
| **Changelog** | [`CHANGELOG.md`](./CHANGELOG.md) | O que já shipou / upcoming |

README raiz do repo: [`../README.md`](../README.md).

### Atalhos úteis

- Brief: [`product/brief.md`](./product/brief.md)
- Seed / contas demo: [`architecture/seed.md`](./architecture/seed.md) · [`user/contas-seed.md`](./user/contas-seed.md)
- CRM parity: [`product/chatwoot-parity.md`](./product/chatwoot-parity.md) · [`user/crm-desk.md`](./user/crm-desk.md)
- Como rodar: [`dev/README.md`](./dev/README.md) · [`architecture/stack.md`](./architecture/stack.md)

## Documentação viva

Estes docs (sobretudo `user/`, `dev/`, `CHANGELOG.md`) **mudam com o produto**.

**Regra para implementadores:** todo PR que entregue comportamento novo ou altere fluxos/scripts/env/deploy deve, no mesmo PR:

1. Atualizar o guia de operador afetado em `docs/user/` (ou criar um).
2. Atualizar `docs/dev/README.md` se mudar setup/migrate/seed/deploy.
3. Acrescentar entrada em `docs/CHANGELOG.md`.
4. Se mudar contrato, atualizar também `docs/product/` / `docs/architecture/` / `docs/design/` conforme o especialista dono.

Não deixar a tip “na frente” dos guias. Agentes: ver também `AGENTS.md`.
