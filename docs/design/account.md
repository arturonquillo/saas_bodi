# Account — out of MVP

The **Account** surface (selling this SaaS to other companies, subscription chrome, entitlement gating) is **deferred**.

## Rules for implementers

- Do **not** ship `/conta` routes in MVP.
- Do **not** add Assinatura / Planos / Fatura links in SaaS or Loja.
- Do **not** show entitlement banners (`inadimplente` / `cancelada`). Seed tenant is always operational (`docs/architecture/authz.md`).
- Do **not** load a separate `[data-theme="product"]` billing chrome.

When product reopens Account, Design will author a new spec. Until then, ignore legacy Account sections from the former saas_frota design pack.
