# CRM Desk UX — Chatwoot parity Phase A

Design for the SaaS conversation desk that replaces the simulated WhatsApp inbox. Product: `docs/product/chatwoot-parity.md`. Architecture: `docs/architecture/crm-chatwoot-parity.md`. Chrome base: saas-starter admin shell ([`saas-desk.md`](./saas-desk.md)). Kit: [`shadcn.md`](./shadcn.md).

**Docs only — Phase A.** Phases B–E appear in IA as labeled stubs where a nav hole would confuse operators; no full screen specs.

## 1. Context

### Users

| Role | Jobs on this desk |
|---|---|
| **Admin** | Full CRM: conversas, contatos, empresas, labels, equipes, caixas, canal WhatsApp (credenciais + stub), respostas rápidas, notificações, simular inbound |
| **Vendedor** | Conversas visíveis (membership + assign rules), contatos/empresas, labels, respostas rápidas, próprias notificações / disponibilidade; **sem** credenciais de canal nem CRUD de equipes/membros de caixa |

### Jobs to be done

1. Triage and reply to WhatsApp-led demand without leaving `/saas`.
2. Assign / label / link commerce (cadastro, orçamento) from the thread context rail.
3. Keep channel “Pronto para conectar” honest — credentials + simulate, no Meta send.

### Primary goal

**One cold-room desk** at Chatwoot IA familiarity, composed only from saas-starter / shadcn pack primitives.

### Constraints

- pt-BR only.
- Evolve `/saas/inbox` → `/saas/conversas` (redirect legacy).
- No parallel CSS kit; no Chatwoot-cloned custom chrome.
- Tenant theme tints actions + active nav only.
- WA connection status max Phase A: `ready_stub` (“Pronto para conectar”).
- Cadastro / pipeline gates unchanged; CRM **links**, does not replace commerce.
- Zero Account / billing chrome.

## 2. Information hierarchy

1. **Open work** — unread / unassigned / mine in Conversas.
2. **Thread + composer** — what to say or note next.
3. **Contact + commerce links** — who, Cliente gate, cadastro/orçamento deep links.
4. **Assignment / labels / priority / status** — routing metadata.
5. **CRM config** — caixas, canal WA, equipes (admin, secondary).

## 3. Visual direction

### Three approaches considered

| | Concept | Strengths | Risks |
|---|---|---|---|
| **A — Chatwoot clone chrome** | Dark inbox rail + custom panes outside starter | Familiar to Chatwoot users | Parallel kit; fights saas-starter shell |
| **B — Starter Card inbox** | Keep dual Cards + TeamMembers list | Zero new patterns | Too slow / boxed for triage; not Chatwoot-legible |
| **C — Hybrid cold desk (selected)** | saas-starter shell + **full-bleed three-pane** Conversas; other CRM pages use starter `SaasPage` + Card sections | Ops speed + kit consistency | Must document when Cards are forbidden |

### Selected — Hybrid cold desk

- **Concept:** refrigerated wholesale ops desk that *reads* like Chatwoot’s conversation workspace, built from Sidebar + ScrollArea + Button/Badge/Dialog/Sheet/Command — not a second product skin.
- **Focal point (Conversas):** the **open thread message stream + composer**; list and contact rail are flanking scanners.
- **Composition:** three horizontal panes inside main (no outer Card wrapping panes). Secondary CRM screens keep saas-starter Card / list rhythm from PR #7.
- **Personality:** precise, cool fog canvas, Archivo titles, IBM Plex body — same Cold room language as [`visual.md`](./visual.md).
- **Why:** matches Chatwoot operator mental model without inventing chrome; respects locked UI kit.

## 4. Information architecture (nav)

Home after login: **`/saas/conversas`**.

### Sidebar groups (saas-starter rhythm)

```
CRM
  Conversas          → /saas/conversas
  Contatos           → /saas/contatos
  Empresas           → /saas/empresas
  ── Separator ──
Comércio
  Cadastros
  Orçamentos
  Pedidos
  Vendas
  Estoque
  Avisos             (commerce outbox — unchanged)
  ── Separator ──
CRM config (admin unless noted)
  Caixas de entrada  → /saas/crm/caixas          admin
  Equipes            → /saas/crm/equipes          admin
  Labels             → /saas/crm/labels           admin + vendedor
  Respostas rápidas  → /saas/crm/respostas-rapidas  both
  ── Separator ──
Admin
  Usuários / Configuração / Tema                 admin
```

Header chrome (starter): keep top bar. Add **Notificações** bell (`DropdownMenu` / `Popover`) + agent availability `Select` (online / ocupado / offline) — not sidebar items.

### Legacy

| Old | New |
|---|---|
| `/saas/inbox` | redirect → `/saas/conversas` |
| `/saas/inbox/:id` | redirect → `/saas/conversas/:id` |
| Nav label “Inbox” | **Conversas** |

### Phase B–E — IA stubs only

Show as **disabled** nav rows with `Tooltip` “Em breve — fase {B|C|D|E}” **or** omit until phase ships. Prefer **omit** for vendedor. For admin, optional stub group under CRM config:

| Stub label | Phase | Do not build |
|---|---|---|
| Automações | B | page shell OK only if product asks; default **omit** |
| Macros | B | omit |
| Atributos | B | omit |
| Horário comercial | B | omit |
| Campanhas | C | omit |
| Central de ajuda | C | omit |
| Relatórios | C | **placeholder route allowed**: `/saas/crm/relatorios` with empty state “Relatórios na fase C” — single `SaasPage` + `Alert`, no fake charts |
| Outros canais | D | omit |
| Captain / SLA | E | omit |

**Must not** invent fake KPI dashboards for Relatórios.

## 5. Screen list (Phase A)

| # | Screen | Route | Roles |
|---|---|---|---|
| 1 | Conversas desk (list + thread) | `/saas/conversas` · `/saas/conversas/:id` | admin, vendedor |
| 2 | Contatos list | `/saas/contatos` | both |
| 3 | Contato detail | `/saas/contatos/:id` | both |
| 4 | Empresas list | `/saas/empresas` | both |
| 5 | Empresa detail | `/saas/empresas/:id` | both |
| 6 | Labels | `/saas/crm/labels` | both |
| 7 | Equipes list + detail/members | `/saas/crm/equipes` · `…/:id` | admin (vendedor: read-only membership via GET only — **no nav** for vendedor) |
| 8 | Respostas rápidas | `/saas/crm/respostas-rapidas` | both |
| 9 | Caixas de entrada list | `/saas/crm/caixas` | admin |
| 10 | Caixa detail + membros | `/saas/crm/caixas/:id` | admin |
| 11 | Canal WhatsApp (ready_stub) | `/saas/crm/caixas/:id/canal` | admin |
| 12 | Templates WA (stub cache) | tab on canal page | admin |
| 13 | Notificações popover + preferências | header + `/saas/crm/notificacoes` | self |
| 14 | Perfil agente (disponibilidade / assinatura) | `/saas/crm/perfil` or header sheet | self |
| 15 | Busca global | `Command` palette (⌘K) | both |
| 16 | Relatórios placeholder (optional) | `/saas/crm/relatorios` | admin |

## 6. Layout — Conversas desk

### Desktop (≥1280px)

```
┌─ saas sidebar ─┬─ filter strip 220px ─┬─ list 320px ─┬─ thread flex ─┬─ context 280px ─┐
│ Conversas …    │ Status / Caixa      │ rows         │ messages      │ Contato         │
│ Contatos …     │ Atribuição / Labels │              │ composer      │ Labels          │
│                │ Equipe              │              │               │ Atribuição      │
│                │                     │              │               │ Comércio links  │
└────────────────┴─────────────────────┴──────────────┴───────────────┴─────────────────┘
```

- Main area: **edge-to-edge** under starter header — drop `SaasPage` outer Card; use pane borders only (`border-r`).
- Filter strip: vertical list of filter chips / `Button` ghost + counts (Mine / Não atribuídas / Abertas / Pendentes / Adiadas / Resolvidas + per-inbox + labels). Chatwoot “folders” feel without custom tree widgets — use `ScrollArea` + `Button`/`Badge`.
- List rows: phone/nome, preview, time, status Badge, priority mark, unread dot, label color dots (max 3 +N).
- Thread: sticky header (contact name, status `Select`, priority `Select`, assign `Select`, more `DropdownMenu`); `ScrollArea` messages; composer sticky bottom.
- Context rail: contact card-less stacked sections with `Separator`; commerce deep links as `Button` link variant.

### Tablet (768–1279)

- Hide filter strip behind `Sheet` (“Filtros”).
- Keep list | thread; context rail → `Sheet` from header “Detalhes”.

### Mobile (&lt;768)

- List full width → navigate to `/saas/conversas/:id` full-screen thread.
- Context + filters via Sheets.
- Composer full width; primary send ≥ 48px.

## 7. Flows

### Entry

Login → `/saas/conversas`. Deep link `/saas/conversas/:id` opens list (desktop) or thread (mobile) with that conversation selected if visible.

### Happy path — triage + reply

1. Vendedor opens Conversas → filter **Não atribuídas** or **Abertas**.
2. Selects row → thread loads; presence heartbeat marks viewing (collision: muted “{nome} está vendo”).
3. Assigns self (`Select` Atribuir) → status stays `open`.
4. Types reply or `/atalho` canned → inserts text → **Enviar** (stub outbox for WA) **or** toggle **Nota privada**.
5. Applies label `intent:cadastro` / opens linked Solicitação / creates link.
6. Resolves via status `Select` → `resolved`.

### Happy path — admin simulate

1. Header or empty CTA **Simular mensagem** → `Dialog`: caixa, phone E.164, body, optional system label.
2. Conversation appears `open`; no Meta HTTP.

### Happy path — WhatsApp “Pronto para conectar”

1. Admin → Caixas → default WA → Canal.
2. Fills provider fields → Salvar → status Badge **Credenciais salvas** → action **Marcar pronto para conectar** → Badge **Pronto para conectar**.
3. `Alert` honesty: envio/recebimento real aguarda integração Meta aprovada. Simulate remains available.
4. Secrets never shown plaintext after save — masked + “Alterar”.

### Alternate paths

- Bulk: checkbox multi-select on list → `DropdownMenu` Atribuir / Resolver / Label / Silenciar.
- Snooze: `Popover` + datetime (or presets) → status `snoozed`.
- Mute: menu item; muted row shows muted icon + meta.
- Draft: autosave composer via PUT draft; restore on reopen.
- Collision: another agent viewing → non-blocking `Alert` inline under thread header.
- Forbidden conversation (vendedor visibility) → “Não encontrado.” (same as 404).
- Cadastro deep link when contact has no Cliente → gate copy on commerce actions only.

### Completion

Thread resolved; list filter updates via SSE / poll fallback. Sonner optional for assign/resolve.

## 8. Components — shadcn inventory

| Component | Screen / region | Notes |
|---|---|---|
| Sidebar / SidebarProvider | App shell | Existing starter |
| Button | Everywhere | default / outline / ghost / destructive |
| Badge | Status, priority, WA connection, labels | text + color |
| Input / Textarea / Label / Form | Composer, CRM forms, canal | |
| Select | Status, priority, assign, team, availability, filters | |
| Checkbox | Bulk select, prefs | |
| Switch | Mute display prefs, inbox flags | |
| ScrollArea | Filter strip, list, messages, context | |
| Separator | Context sections, nav groups | |
| Dialog | Simular; criar label/equipe/resposta; nova conversa outbound | |
| AlertDialog | Delete label/resposta; destructive bulk | |
| Sheet | Mobile filters / context / nav | |
| DropdownMenu | Thread more, bulk, row actions, notifications overflow | |
| Popover | Snooze, notifications panel, color picker labels | |
| Command | Global search + canned `/` palette in composer | **add if missing** |
| Skeleton | All panes / tables | |
| Alert | Stub honesty, collision, load error | |
| Sonner | Optional success | |
| Avatar | Contact / agent initials | |
| Tooltip | Truncation, stub nav, shortcut hints | |
| Breadcrumb | Contato/Empresa/Caixa detail | |
| Tabs | Canal page: Credenciais \| Templates \| Membros (or separate) | |
| Card | Contatos/Empresas/Labels/Equipes/Respostas/Caixas **list & settings only** — **forbidden** wrapping Conversas panes |
| Table | Optional dense Labels/Respostas admin tables inside Card | Prefer starter `ul.space-y-4` rows for lists to match PR #7 |

### Composition notes

- **Conversas:** panes = bordered flex regions, not Cards.
- **Message bubbles:** Tailwind only on `div`s inside ScrollArea — incoming muted wash, outgoing primary 8% wash, private notes warning wash + “Nota privada” caption. Not a new kit component.
- **Label color:** small 8px round span + name; create form uses preset swatches (`Button` ghost color), not a custom picker library.
- **Unread:** 8px primary dot — always paired with bold title, never color-alone.

## 9. Interaction behavior

| Action | Behavior |
|---|---|
| Send public | POST message `private:false`; optimistic append; stub delivery badge “Registrado (stub)” |
| Private note | Toggle before send; never leaves desk |
| `/shortcode` | Command list filters canned; Tab/Enter inserts; supports `{{contact.name}}` etc. as plain substitution preview |
| Assign / team / priority / status | PATCH conversation; SSE fans out |
| Labels on conversation | multi `Popover` checklist → POST labels |
| Bulk | requires ≥1 selection; confirm destructive |
| Presence | POST heartbeat while thread focused; stop on blur/unmount |
| SSE | subscribe on desk mount; reconnect + 15s poll fallback per architecture |
| Secrets | password-style inputs; after save show bullets + Alterar |

## 10. States

### Loading

- Keep shell + pane chrome.
- List: 8 Skeleton rows; thread: Skeleton bubbles; context: Skeleton blocks.
- Never blank white main.

### Empty

| Context | Title | CTA |
|---|---|---|
| Conversas (no rows for filter) | Nenhuma conversa neste filtro. | Limpar filtros / Simular (admin) |
| Conversas (tenant zero) | Nenhuma conversa ainda. | Simular mensagem (admin) |
| Contatos | Nenhum contato. | Novo contato |
| Empresas | Nenhuma empresa. | Nova empresa |
| Labels | Nenhum label. | Criar label |
| Equipes | Nenhuma equipe. | Criar equipe |
| Respostas rápidas | Nenhuma resposta rápida. | Criar resposta |
| Caixas | Nenhuma caixa. | Criar caixa (seed should prevent) |
| Notificações | Nenhuma notificação. | — |
| Relatórios stub | Relatórios na fase C. | — |
| Busca sem hits | Nenhum resultado para “{q}”. | — |

### Error

- Pane-level: “Não foi possível carregar.” + **Tentar de novo**.
- Send fail: keep composer text; inline error.
- Canal save fail: keep form; domain message.
- SSE drop: silent reconnect; optional muted “Atualizando a cada 15s…” caption.

### Forbidden

| Who | Where | UX |
|---|---|---|
| Vendedor | Caixas / Canal / Equipes CRUD | omit nav; direct URL → redirect Conversas |
| Vendedor | Conversation outside visibility | Não encontrado |
| Any | Transition to `live` | API rejects; UI never offers “Ao vivo” |

### Success / async

- Simulate: Sonner “Mensagem simulada adicionada.”
- Canal ready_stub: Badge update + Alert honesty remains.
- Outbox stub note under outgoing bubble.

### WA connection Badges

| Status | Label | Tone |
|---|---|---|
| `not_configured` | Não configurado | secondary |
| `credentials_saved` | Credenciais salvas | warning |
| `ready_stub` | Pronto para conectar | success + Alert stub |
| `live` | — | **not offered** in Phase A |

## 11. Responsive behavior

| Element | &lt;768 | 768–1279 | ≥1280 |
|---|---|---|---|
| Filter strip | Sheet | Sheet | visible |
| List | full route | 40% width | 320px |
| Thread | full route | flex | flex |
| Context | Sheet | Sheet | 280px |
| Composer | sticky bottom full | sticky | sticky |
| Bulk bar | bottom sticky | top of list | top of list |

## 12. Tokens used

Reuse Cold room — **no new brand colors**. Map:

| Need | Token |
|---|---|
| Canvas / panes | `--background` `#F4F6F7`, pane fill `--card` white |
| Borders | `--border` / `#E5E9EC` pane rules |
| Unread / active list | primary 8% wash + bar |
| Private note wash | `--color-warning` at low opacity |
| Incoming bubble | muted |
| Outgoing bubble | primary 8% |
| Focus | `--ring` ← accent |
| Status open | outline primary |
| pending | warning |
| snoozed | secondary |
| resolved | success |
| priority urgent | destructive text/icon |
| priority high | warning |

Density: Conversas uses **compact** (row ~40px). Contatos/settings use starter medium `SaasPage` padding.

## 13. Accessibility

- Conversas list: `role="listbox"` / options or linked rows with clear selected state (`aria-selected` / `aria-current`).
- Thread region `aria-label="Conversa"`; messages list polite live region for new incoming while open.
- Composer: `aria-keyshortcuts` documented; private toggle announced.
- Collision / stub Alerts not color-only.
- Secrets fields `autocomplete="off"`.
- Skip link still targets main; on Conversas main is the three-pane region.
- See [`a11y.md`](./a11y.md).

## 14. Copy (pt-BR)

Canonical keys in [`copy-pt-BR.md`](./copy-pt-BR.md) § CRM desk. Highlights:

- Nav: Conversas, Contatos, Empresas, Caixas de entrada, Equipes, Labels, Respostas rápidas, Notificações.
- Statuses: Aberta, Pendente, Adiada, Resolvida.
- Priorities: Baixa, Média, Alta, Urgente.
- Canal: Pronto para conectar; stub honesty Alert.
- Empty / errors as §10.

Intent system labels (seed): Cadastro, Orçamento, Info empresa, Outro — shown as Labels, not a separate Intent `Select` (legacy intent control removed).

## 15. Per-screen specs (secondary CRM)

### Contatos / Empresas

- `SaasPage` title + primary CTA.
- Search `Input` + optional label `Select`.
- List: starter `Card` > `ul.space-y-4` rows (avatar initials, nome, phone/CNPJ masked, labels).
- Detail: breadcrumb; sections Contato | Conversas | Notas | Comércio (Cliente link or gate).
- CTA **Nova conversa** → Dialog pick inbox → POST outbound (stub).

### Labels

- List + Dialog create (nome, cor swatch, description).
- System labels (`intent:*`): Badge “Sistema”; edit color/name allowed; delete blocked with Tooltip.

### Equipes (admin)

- List Card rows; detail members multi-select users `Checkbox` list → PUT members.

### Respostas rápidas

- List shortcode + preview; Dialog create/edit: shortcode, content `Textarea` with `{{vars}}` helper caption.
- Insert path is primarily composer Command — this page is CRUD.

### Caixas + Canal

- List inboxes (name, channel type Badge WhatsApp, member count).
- Detail: Tabs **Geral** (greeting, flags Switches) | **Membros** | **Canal**.
- Canal form fields per product credential table; connection Badge; templates JSON as editable list (key + body) — stub cache, no Meta sync button that claims live sync.

### Notificações

- Header bell with unread count Badge.
- Popover list rows → mark read; link to conversation.
- Preferências page: Checkbox group assigned / unassigned / participating / all (match API prefs).

### Perfil

- Availability `Select`; signature `Textarea`; Salvar.

### Busca

- `CommandDialog`: groups Conversas / Contatos / Mensagens; Enter navigates.

## 16. Quality scores (self-critique)

| Criterion | Score |
|---|---|
| Usability | 9 |
| Visual hierarchy | 9 |
| Visual impact | 7 (ops desk — no spectacle) |
| Originality | 8 (hybrid Chatwoot×cold room) |
| Typography | 8 |
| Brand personality | 8 |
| Responsive quality | 9 |
| Accessibility | 8 |
| Design-system consistency | 9 |

## 17. Handoff to frontend

### Must implement

- Nav IA + redirects from inbox.
- Conversas three-pane desk + mobile stack.
- Contatos, Empresas, Labels, Equipes, Respostas, Caixas/Canal, Notificações, Perfil, Command search.
- States §10; copy keys; WA ready_stub honesty.
- SSE + poll fallback UX caption.
- shadcn only; install `command` if absent.

### Must not improvise

- Parallel Chatwoot skin or `.sf-*` kit.
- Cards wrapping Conversas panes.
- Live Meta / “Conectar agora” that implies Graph traffic.
- Fake Relatórios charts.
- Account billing links.
- Intent enum `Select` (use Labels).
- Offering connection status `live`.

### Existing reuse

Starter `SaasPage` / Sidebar / Card list rhythm for non-desk pages; evolve `InboxScreen` → Conversas desk layout.

### Install

```bash
npx shadcn@latest add command
```

(Other primitives already in pack from SaaS shell.)

### Token changes

None required beyond existing Cold room mapping in [`tokens.md`](./tokens.md) / [`shadcn.md`](./shadcn.md).

### Unresolved design questions

None blocking Phase A. Optional later: whether Relatórios stub nav is shown — default **admin-only single placeholder**, omit for vendedor.
