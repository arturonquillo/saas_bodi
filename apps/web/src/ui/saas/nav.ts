import type { SaasRole } from "@saas-frota/shared";
import { isAdmin } from "@saas-frota/shared";
import { COPY } from "../copy";

export type NavIconName =
  | "conversas"
  | "contatos"
  | "empresas"
  | "cadastros"
  | "orcamentos"
  | "pedidos"
  | "vendas"
  | "estoque"
  | "usuarios"
  | "tema"
  | "config"
  | "avisos"
  | "labels"
  | "equipes"
  | "respostas"
  | "caixas"
  | "relatorios"
  | "automacoes"
  | "macros"
  | "atributos"
  | "bots"
  | "webhooks"
  | "horarios"
  | "atribuicao"
  | "csat"
  | "filtros"
  | "campanhas"
  | "ajuda"
  | "modelos_email"
  | "sla"
  | "capacidade"
  | "captain"
  | "auditoria"
  | "seguranca"
  | "papeis"
  | "integracoes"
  | "apps_painel";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  adminOnly?: boolean;
  /** When true, shown only to admin (CRM config). */
  crmConfig?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const CRM_NAV: NavItem[] = [
  { href: "/saas/conversas", label: COPY.crm.nav_conversas, icon: "conversas" },
  { href: "/saas/contatos", label: COPY.crm.nav_contatos, icon: "contatos" },
  { href: "/saas/empresas", label: COPY.crm.nav_empresas, icon: "empresas" },
];

const COMERCIO_NAV: NavItem[] = [
  { href: "/saas/cadastros", label: COPY.nav.cadastros, icon: "cadastros" },
  { href: "/saas/orcamentos", label: COPY.nav.orcamentos, icon: "orcamentos" },
  { href: "/saas/pedidos", label: COPY.nav.pedidos, icon: "pedidos" },
  { href: "/saas/vendas", label: COPY.nav.vendas, icon: "vendas" },
  { href: "/saas/estoque", label: COPY.nav.estoque, icon: "estoque" },
  { href: "/saas/avisos", label: COPY.nav.avisos, icon: "avisos" },
];

const CRM_CONFIG_NAV: NavItem[] = [
  { href: "/saas/crm/caixas", label: COPY.crm.nav_caixas, icon: "caixas", adminOnly: true, crmConfig: true },
  {
    href: "/saas/crm/modelos-email",
    label: COPY.crm.nav_modelos_email,
    icon: "modelos_email",
    adminOnly: true,
    crmConfig: true,
  },
  { href: "/saas/crm/equipes", label: COPY.crm.nav_equipes, icon: "equipes", adminOnly: true, crmConfig: true },
  { href: "/saas/crm/labels", label: COPY.crm.nav_labels, icon: "labels", crmConfig: true },
  {
    href: "/saas/crm/respostas-rapidas",
    label: COPY.crm.nav_respostas_rapidas,
    icon: "respostas",
    crmConfig: true,
  },
  { href: "/saas/crm/macros", label: COPY.crm.nav_macros, icon: "macros", crmConfig: true },
  { href: "/saas/crm/atributos", label: COPY.crm.nav_atributos, icon: "atributos", crmConfig: true },
  { href: "/saas/crm/filtros", label: COPY.crm.nav_filtros, icon: "filtros", crmConfig: true },
  {
    href: "/saas/crm/automacoes",
    label: COPY.crm.nav_automacoes,
    icon: "automacoes",
    adminOnly: true,
    crmConfig: true,
  },
  { href: "/saas/crm/bots", label: COPY.crm.nav_bots, icon: "bots", adminOnly: true, crmConfig: true },
  {
    href: "/saas/crm/webhooks",
    label: COPY.crm.nav_webhooks,
    icon: "webhooks",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/horarios",
    label: COPY.crm.nav_horarios,
    icon: "horarios",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/atribuicao",
    label: COPY.crm.nav_atribuicao,
    icon: "atribuicao",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/capacidade",
    label: COPY.crm.nav_capacidade,
    icon: "capacidade",
    adminOnly: true,
    crmConfig: true,
  },
  { href: "/saas/crm/sla", label: COPY.crm.nav_sla, icon: "sla", adminOnly: true, crmConfig: true },
  { href: "/saas/crm/csat", label: COPY.crm.nav_csat, icon: "csat", adminOnly: true, crmConfig: true },
  {
    href: "/saas/crm/captain",
    label: COPY.crm.nav_captain,
    icon: "captain",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/auditoria",
    label: COPY.crm.nav_auditoria,
    icon: "auditoria",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/seguranca",
    label: COPY.crm.nav_seguranca,
    icon: "seguranca",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/papeis",
    label: COPY.crm.nav_papeis,
    icon: "papeis",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/integracoes",
    label: COPY.crm.nav_integracoes,
    icon: "integracoes",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/apps-painel",
    label: COPY.crm.nav_apps_painel,
    icon: "apps_painel",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/campanhas",
    label: COPY.crm.nav_campanhas,
    icon: "campanhas",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/central-ajuda",
    label: COPY.crm.nav_central_ajuda,
    icon: "ajuda",
    adminOnly: true,
    crmConfig: true,
  },
  {
    href: "/saas/crm/relatorios",
    label: COPY.crm.nav_relatorios,
    icon: "relatorios",
    adminOnly: true,
    crmConfig: true,
  },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/saas/usuarios", label: COPY.nav.usuarios, icon: "usuarios", adminOnly: true },
  { href: "/saas/configuracao", label: COPY.nav.configuracao, icon: "config", adminOnly: true },
  { href: "/saas/tema", label: COPY.nav.tema, icon: "tema", adminOnly: true },
];

function visible(items: NavItem[], admin: boolean) {
  return items.filter((item) => (item.adminOnly ? admin : true));
}

export function saasNavSections(role: SaasRole | null | undefined): {
  sections: NavSection[];
  flat: NavItem[];
} {
  if (!role) return { sections: [], flat: [] };
  const admin = isAdmin(role);
  const sections: NavSection[] = [
    { id: "crm", label: COPY.crm.nav_crm, items: visible(CRM_NAV, admin) },
    { id: "comercio", label: COPY.crm.nav_comercio, items: visible(COMERCIO_NAV, admin) },
  ];
  const configItems = visible(CRM_CONFIG_NAV, admin).filter((i) =>
    admin ? true : !i.adminOnly && i.href !== "/saas/crm/relatorios",
  );
  if (configItems.length) {
    sections.push({ id: "crm-config", label: COPY.crm.nav_crm_config, items: configItems });
  }
  const adminItems = visible(ADMIN_NAV, admin);
  if (adminItems.length) {
    sections.push({ id: "admin", label: COPY.crm.nav_admin, items: adminItems });
  }
  return { sections, flat: sections.flatMap((s) => s.items) };
}

/** @deprecated Prefer saasNavSections */
export function saasNav(role: SaasRole | null | undefined): NavItem[] {
  return saasNavSections(role).flat;
}

export function roleHome(_role?: SaasRole | null) {
  void _role;
  return "/saas/conversas";
}

const BOTH_CRM_PATHS = [
  "/saas/crm/labels",
  "/saas/crm/respostas-rapidas",
  "/saas/crm/macros",
  "/saas/crm/atributos",
  "/saas/crm/filtros",
  "/saas/crm/notificacoes",
  "/saas/crm/perfil",
  "/saas/contatos/importar",
];

const ADMIN_CRM_PATHS = [
  "/saas/crm/caixas",
  "/saas/crm/modelos-email",
  "/saas/crm/equipes",
  "/saas/crm/relatorios",
  "/saas/crm/automacoes",
  "/saas/crm/bots",
  "/saas/crm/webhooks",
  "/saas/crm/horarios",
  "/saas/crm/atribuicao",
  "/saas/crm/capacidade",
  "/saas/crm/sla",
  "/saas/crm/csat",
  "/saas/crm/captain",
  "/saas/crm/auditoria",
  "/saas/crm/seguranca",
  "/saas/crm/papeis",
  "/saas/crm/integracoes",
  "/saas/crm/apps-painel",
  "/saas/crm/campanhas",
  "/saas/crm/central-ajuda",
];

export function canOpen(role: SaasRole | null | undefined, path: string) {
  if (!role) return path.startsWith("/saas/entrar");
  if (path.startsWith("/saas/entrar")) return true;

  const normalized =
    path.startsWith("/saas/inbox") ? path.replace("/saas/inbox", "/saas/conversas") : path;

  if (normalized === "/saas" || normalized.startsWith("/saas/conversas")) return true;
  if (normalized.startsWith("/saas/contatos")) return true;
  if (normalized.startsWith("/saas/empresas")) return true;
  if (normalized.startsWith("/saas/cadastros")) return true;
  if (normalized.startsWith("/saas/orcamentos")) return true;
  if (normalized.startsWith("/saas/pedidos")) return true;
  if (normalized.startsWith("/saas/vendas")) return true;
  if (normalized.startsWith("/saas/estoque")) return true;
  if (normalized.startsWith("/saas/avisos")) return true;

  if (BOTH_CRM_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return true;
  }

  if (ADMIN_CRM_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return isAdmin(role);
  }

  if (
    normalized.startsWith("/saas/usuarios") ||
    normalized.startsWith("/saas/tema") ||
    normalized.startsWith("/saas/configuracao")
  ) {
    return isAdmin(role);
  }
  if (normalized.startsWith("/saas/chat-estoque")) return false;
  return false;
}

export function currentNavItem(pathname: string, role: SaasRole | null | undefined) {
  const path = pathname.startsWith("/saas/inbox")
    ? pathname.replace("/saas/inbox", "/saas/conversas")
    : pathname;
  return saasNav(role).find((item) => path === item.href || path.startsWith(`${item.href}/`));
}

export function currentPageLabel(pathname: string, role: SaasRole | null | undefined) {
  const match = currentNavItem(pathname, role);
  if (match) return match.label;
  if (pathname.startsWith("/saas/conversas") || pathname.startsWith("/saas/inbox")) {
    return COPY.crm.nav_conversas;
  }
  if (pathname.startsWith("/saas/contatos/importar")) return COPY.crm.nav_importar_contatos;
  if (pathname.startsWith("/saas/contatos")) return COPY.crm.nav_contatos;
  if (pathname.startsWith("/saas/empresas")) return COPY.crm.nav_empresas;
  if (pathname.startsWith("/saas/crm/labels")) return COPY.crm.nav_labels;
  if (pathname.startsWith("/saas/crm/equipes")) return COPY.crm.nav_equipes;
  if (pathname.startsWith("/saas/crm/respostas-rapidas")) return COPY.crm.nav_respostas_rapidas;
  if (pathname.startsWith("/saas/crm/caixas")) return COPY.crm.nav_caixas;
  if (pathname.startsWith("/saas/crm/modelos-email")) return COPY.crm.nav_modelos_email;
  if (pathname.startsWith("/saas/crm/notificacoes")) return COPY.crm.nav_notificacoes;
  if (pathname.startsWith("/saas/crm/perfil")) return COPY.crm.nav_perfil_crm;
  if (pathname.startsWith("/saas/crm/relatorios")) return COPY.crm.nav_relatorios;
  if (pathname.startsWith("/saas/crm/campanhas")) return COPY.crm.nav_campanhas;
  if (pathname.startsWith("/saas/crm/central-ajuda")) return COPY.crm.nav_central_ajuda;
  if (pathname.startsWith("/saas/crm/automacoes")) return COPY.crm.nav_automacoes;
  if (pathname.startsWith("/saas/crm/macros")) return COPY.crm.nav_macros;
  if (pathname.startsWith("/saas/crm/atributos")) return COPY.crm.nav_atributos;
  if (pathname.startsWith("/saas/crm/bots")) return COPY.crm.nav_bots;
  if (pathname.startsWith("/saas/crm/webhooks")) return COPY.crm.nav_webhooks;
  if (pathname.startsWith("/saas/crm/horarios")) return COPY.crm.nav_horarios;
  if (pathname.startsWith("/saas/crm/atribuicao")) return COPY.crm.nav_atribuicao;
  if (pathname.startsWith("/saas/crm/capacidade")) return COPY.crm.nav_capacidade;
  if (pathname.startsWith("/saas/crm/sla")) return COPY.crm.nav_sla;
  if (pathname.startsWith("/saas/crm/csat")) return COPY.crm.nav_csat;
  if (pathname.startsWith("/saas/crm/captain")) return COPY.crm.nav_captain;
  if (pathname.startsWith("/saas/crm/auditoria")) return COPY.crm.nav_auditoria;
  if (pathname.startsWith("/saas/crm/seguranca")) return COPY.crm.nav_seguranca;
  if (pathname.startsWith("/saas/crm/papeis")) return COPY.crm.nav_papeis;
  if (pathname.startsWith("/saas/crm/integracoes")) return COPY.crm.nav_integracoes;
  if (pathname.startsWith("/saas/crm/apps-painel")) return COPY.crm.nav_apps_painel;
  if (pathname.startsWith("/saas/crm/filtros")) return COPY.crm.nav_filtros;
  if (pathname.startsWith("/saas/cadastros")) return COPY.nav.cadastros;
  if (pathname.startsWith("/saas/orcamentos")) return COPY.nav.orcamentos;
  if (pathname.startsWith("/saas/pedidos")) return COPY.nav.pedidos;
  if (pathname.startsWith("/saas/vendas")) return COPY.nav.vendas;
  if (pathname.startsWith("/saas/estoque")) return COPY.nav.estoque;
  if (pathname.startsWith("/saas/usuarios")) return COPY.nav.usuarios;
  if (pathname.startsWith("/saas/tema")) return COPY.nav.tema;
  if (pathname.startsWith("/saas/configuracao")) return COPY.nav.configuracao;
  if (pathname.startsWith("/saas/avisos")) return COPY.nav.avisos;
  return COPY.crm.nav_conversas;
}

export function roleLabel(role: SaasRole | null | undefined) {
  if (role === "admin") return COPY.role_admin;
  if (role === "vendedor") return COPY.role_vendedor;
  return "";
}

export function isConversasPath(pathname: string) {
  return pathname.startsWith("/saas/conversas") || pathname.startsWith("/saas/inbox");
}
