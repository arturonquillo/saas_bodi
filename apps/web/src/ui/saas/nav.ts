import type { SaasRole } from "@saas-frota/shared";
import { isAdmin } from "@saas-frota/shared";
import { COPY } from "../copy";

export type NavIconName =
  | "inbox"
  | "cadastros"
  | "orcamentos"
  | "pedidos"
  | "vendas"
  | "estoque"
  | "usuarios"
  | "tema"
  | "config"
  | "avisos";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  adminOnly?: boolean;
};

const ALL_NAV: NavItem[] = [
  { href: "/saas/inbox", label: COPY.nav.inbox, icon: "inbox" },
  { href: "/saas/cadastros", label: COPY.nav.cadastros, icon: "cadastros" },
  { href: "/saas/orcamentos", label: COPY.nav.orcamentos, icon: "orcamentos" },
  { href: "/saas/pedidos", label: COPY.nav.pedidos, icon: "pedidos" },
  { href: "/saas/vendas", label: COPY.nav.vendas, icon: "vendas" },
  { href: "/saas/estoque", label: COPY.nav.estoque, icon: "estoque" },
  { href: "/saas/usuarios", label: COPY.nav.usuarios, icon: "usuarios", adminOnly: true },
  { href: "/saas/tema", label: COPY.nav.tema, icon: "tema", adminOnly: true },
  { href: "/saas/configuracao", label: COPY.nav.configuracao, icon: "config", adminOnly: true },
  { href: "/saas/avisos", label: COPY.nav.avisos, icon: "avisos" },
];

export function saasNav(role: SaasRole | null | undefined): NavItem[] {
  if (!role) return [];
  const admin = isAdmin(role);
  return ALL_NAV.filter((item) => (item.adminOnly ? admin : true));
}

export function saasNavSections(role: SaasRole | null | undefined) {
  const items = saasNav(role);
  const main = items.filter((i) => !i.adminOnly);
  const adminItems = items.filter((i) => i.adminOnly);
  return { main, adminItems };
}

export function roleHome(_role?: SaasRole | null) {
  return "/saas/inbox";
}

export function canOpen(role: SaasRole | null | undefined, path: string) {
  if (!role) return path.startsWith("/saas/entrar");
  if (path.startsWith("/saas/entrar")) return true;
  if (path === "/saas" || path.startsWith("/saas/inbox")) return true;
  if (path.startsWith("/saas/cadastros")) return true;
  if (path.startsWith("/saas/orcamentos")) return true;
  if (path.startsWith("/saas/pedidos")) return true;
  if (path.startsWith("/saas/vendas")) return true;
  if (path.startsWith("/saas/estoque")) return true;
  if (path.startsWith("/saas/avisos")) return true;
  if (
    path.startsWith("/saas/usuarios") ||
    path.startsWith("/saas/tema") ||
    path.startsWith("/saas/configuracao")
  ) {
    return isAdmin(role);
  }
  if (path.startsWith("/saas/chat-estoque")) return false;
  return false;
}

export function currentNavItem(pathname: string, role: SaasRole | null | undefined) {
  return saasNav(role).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function currentPageLabel(pathname: string, role: SaasRole | null | undefined) {
  const match = currentNavItem(pathname, role);
  if (match) return match.label;
  if (pathname.startsWith("/saas/inbox")) return COPY.nav.inbox;
  if (pathname.startsWith("/saas/cadastros")) return COPY.nav.cadastros;
  if (pathname.startsWith("/saas/orcamentos")) return COPY.nav.orcamentos;
  if (pathname.startsWith("/saas/pedidos")) return COPY.nav.pedidos;
  if (pathname.startsWith("/saas/vendas")) return COPY.nav.vendas;
  if (pathname.startsWith("/saas/estoque")) return COPY.nav.estoque;
  if (pathname.startsWith("/saas/usuarios")) return COPY.nav.usuarios;
  if (pathname.startsWith("/saas/tema")) return COPY.nav.tema;
  if (pathname.startsWith("/saas/configuracao")) return COPY.nav.configuracao;
  if (pathname.startsWith("/saas/avisos")) return COPY.nav.avisos;
  return COPY.nav.inbox;
}

export function roleLabel(role: SaasRole | null | undefined) {
  if (role === "admin") return COPY.role_admin;
  if (role === "vendedor") return COPY.role_vendedor;
  return "";
}
