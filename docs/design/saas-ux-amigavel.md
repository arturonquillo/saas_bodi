# SaaS UX amigável — design note

Friendlier SaaS desk for Casa dos Frios: subtle elevation, clearer hierarchy, short pt-BR helpers on non-obvious screens, richer empty states. Frontend (CDF-58) applies this contract on the stacked UX branch.

## Source of truth

Full brief (references, elevation map, screen matrix, component patterns, acceptance checklist):

→ Project store: `docs/saas-ux-amigavel.md`  
  (absolute: `/cursor/stores/bc-01a1c09b-4da0-794b-bd07-cc52e37186e0/docs/saas-ux-amigavel.md`)

## Stack / brand locks

- Keep **shadcn/ui** + saas-starter patterns — no parallel CSS kit.
- Dark mode (Claro / Escuro / Sistema) must keep working.
- Cold-room brand: carmine primary + steel accent (`tokens.md` / `visual.md`). No purple glow, cream+serif terracotta, or broadsheet.
- Prefer soft `shadow-sm` / `--shadow-card` on Cards and list shells; Conversas panes stay border-first (no outer Card).

## What frontend should do

1. Extend `SaasPage` with optional `description` (`text-sm text-muted-foreground`).
2. Apply helpers only where the store brief marks **Yes** (canal WhatsApp, estoque, pipeline lists, cadastros, config/tema, avisos). Leave Conversas chrome, Guia, usuários, and obvious CRM CRUD alone.
3. Enrich `EmptyState` with optional body + one CTA; keep titles from `states.md`.
4. Map elevation to existing tokens (`tokens.css` / Tailwind `shadow-sm` · `shadow-md` · float on overlays).
5. Pass the acceptance checklist in the store brief before calling CDF-58 done.

## Related docs

- [`saas.md`](./saas.md) · [`saas-desk.md`](./saas-desk.md) · [`crm-desk.md`](./crm-desk.md)
- [`visual.md`](./visual.md) · [`tokens.md`](./tokens.md) · [`shadcn.md`](./shadcn.md)
- [`states.md`](./states.md) · [`copy-pt-BR.md`](./copy-pt-BR.md)
