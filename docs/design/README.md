# Design — Casa dos Frios CRM + loja atacado

Visual and UX source of truth for the MVP. Product: `docs/product/spec.md`. Architecture: `docs/architecture/`. Frontend implements; do not invent a parallel CSS kit.

| Doc | Owns |
|---|---|
| [overview.md](./overview.md) | Surfaces, IA, nav, shared patterns |
| [visual.md](./visual.md) | Art direction, type, chrome, composition |
| [tokens.md](./tokens.md) | Token contract + live preview |
| [tokens.json](./tokens.json) / [tokens.css](./tokens.css) | Machine-readable + CSS variables |
| [saas.md](./saas.md) | SaaS flows (login, admin, pipeline, stock) |
| [saas-desk.md](./saas-desk.md) | SaaS chrome / layout density |
| [crm-desk.md](./crm-desk.md) | **Chatwoot-parity Phase A** Conversas desk + CRM IA |
| [loja.md](./loja.md) | Loja (storefront) flows and layout |
| [shadcn.md](./shadcn.md) | shadcn/ui inventory per screen |
| [states.md](./states.md) | Empty, loading, error, cadastro gates |
| [copy-pt-BR.md](./copy-pt-BR.md) | Locked pt-BR strings |
| [account.md](./account.md) | **Out of MVP** — deferred stub |
| [a11y.md](./a11y.md) | Accessibility notes |

**CRM Phase A:** implement against [`crm-desk.md`](./crm-desk.md) + architecture `docs/architecture/crm-chatwoot-parity.md`. Legacy Inbox routes redirect to Conversas.

**Supersedes** the former `saas_frota` / Norte Atacado / Account / AI-chat design pack. Seed theme hex in architecture may be updated to match `tokens.md` without changing slug or marca.
