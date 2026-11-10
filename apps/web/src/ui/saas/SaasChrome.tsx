"use client";

import type { SaasRole } from "@saas-frota/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { SkipLink } from "../layout";
import { useSession } from "../session";
import { ColorModeToggle } from "../theme/ColorModeToggle";
import { CrmHeaderChrome } from "./CrmHeaderChrome";
import { LAYOUT_KEYS, usePersistedBool } from "./layout-prefs";
import {
  canOpen,
  currentPageLabel,
  isConversasPath,
  roleHome,
  roleLabel,
  saasNavSections,
  type NavItem,
  type NavSection,
} from "./nav";
import { NavIcon } from "./NavIcon";

function navActive(pathname: string, href: string) {
  const path = pathname.startsWith("/saas/inbox")
    ? pathname.replace("/saas/inbox", "/saas/conversas")
    : pathname;
  return path === href || path.startsWith(`${href}/`);
}

function UserMenu({ role }: { role: SaasRole | null | undefined }) {
  const { logout, session } = useSession();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const label = roleLabel(role) || session?.user_id || "SF";
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "SF";

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="size-9 cursor-pointer">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/saas/conversas" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>{COPY.crm.nav_conversas}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/saas/crm/perfil" className="flex w-full items-center">
            <span>{COPY.crm.nav_perfil_crm}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/saas/guia" className="flex w-full items-center">
            <BookOpen className="mr-2 h-4 w-4" />
            <span>{COPY.nav_guia}</span>
          </Link>
        </DropdownMenuItem>
        <p className="px-2 py-1 text-xs text-muted-foreground">{roleLabel(role)}</p>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => {
            void logout().then(() => router.push("/saas/entrar"));
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{COPY.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header({ role }: { role: SaasRole | null | undefined }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <BrandMark href="/saas/conversas" className="text-foreground" />
        <div className="flex items-center gap-2 sm:gap-4">
          <CrmHeaderChrome />
          <ColorModeToggle />
          <UserMenu role={role} />
        </div>
      </div>
    </header>
  );
}

function SectionNav({
  sections,
  pathname,
  onNavigate,
  collapsed,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <nav className={cn("h-full overflow-y-auto", collapsed ? "p-2" : "p-3")}>
        {sections.map((section, idx) => (
          <div key={section.id} className="mb-2">
            {idx > 0 ? <Separator className={cn("my-3", collapsed && "mx-1")} /> : null}
            {!collapsed ? (
              <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
            ) : (
              <span className="sr-only">{section.label}</span>
            )}
            {section.items.map((item: NavItem) => {
              const active = navActive(pathname, item.href);
              const button = (
                <Button
                  variant="ghost"
                  className={cn(
                    "my-0.5 cursor-pointer shadow-none",
                    collapsed ? "size-10 justify-center px-0" : "w-full justify-start",
                    active &&
                      (collapsed
                        ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-foreground"
                        : "rounded-l-none border-l-[3px] border-l-primary bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] text-foreground"),
                  )}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                >
                  <NavIcon name={item.icon} />
                  {!collapsed ? item.label : null}
                </Button>
              );
              if (!collapsed) {
                return (
                  <Link key={item.href} href={item.href} passHref>
                    {button}
                  </Link>
                );
              }
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href} passHref>
                      {button}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}

export function SaasChrome({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.saas_role;
  const loginPage = pathname === "/saas/entrar";
  const pageLabel = currentPageLabel(pathname, role);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedBool(
    LAYOUT_KEYS.sidebarCollapsed,
    false,
  );
  const { sections } = saasNavSections(role);
  const conversas = isConversasPath(pathname);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest" && !loginPage) {
      router.replace(`/saas/entrar?return=${encodeURIComponent(pathname)}`);
    }
    if (status === "auth" && loginPage) {
      router.replace(roleHome(role));
    }
    if (status === "auth" && !canOpen(role, pathname)) {
      router.replace(roleHome(role));
    }
  }, [status, loginPage, pathname, role, router]);

  if (loginPage) {
    return (
      <>
        <div className="fixed top-3 right-3 z-40">
          <ColorModeToggle />
        </div>
        {children}
      </>
    );
  }

  if (status === "loading") {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <section className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <Header role={role} />
      <Toaster richColors position="top-right" />

      <div
        className={cn(
          "mx-auto flex w-full flex-col min-h-[calc(100dvh-68px)]",
          conversas ? "max-w-none" : "max-w-7xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border bg-card p-4 lg:hidden">
          <span className="font-medium text-foreground">{pageLabel}</span>
          <Button
            className="-mr-3 cursor-pointer"
            variant="ghost"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <div className="relative flex h-full flex-1 overflow-hidden">
          <aside
            className={cn(
              "absolute inset-y-0 left-0 z-40 flex transform flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-300 ease-in-out lg:relative lg:translate-x-0",
              sidebarCollapsed ? "lg:w-14" : "w-64",
              isSidebarOpen ? "block w-64 translate-x-0" : "hidden -translate-x-full lg:flex",
            )}
          >
            <div
              className={cn(
                "hidden shrink-0 items-center border-b border-sidebar-border lg:flex",
                sidebarCollapsed ? "justify-center p-2" : "justify-end px-2 py-2",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-pressed={sidebarCollapsed}
                aria-label={
                  sidebarCollapsed ? COPY.layout.expandir_menu : COPY.layout.recolher_menu
                }
                title={sidebarCollapsed ? COPY.layout.expandir : COPY.layout.recolher}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <SectionNav
                sections={sections}
                pathname={pathname}
                onNavigate={() => setIsSidebarOpen(false)}
                collapsed={sidebarCollapsed && !isSidebarOpen}
              />
            </div>
          </aside>

          <main
            id="conteudo"
            className={cn(
              "min-w-0 flex-1 overflow-y-auto",
              conversas ? "p-0" : "p-0 lg:p-4",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </section>
  );
}
