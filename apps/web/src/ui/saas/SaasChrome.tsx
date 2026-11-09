"use client";

import type { SaasRole } from "@saas-frota/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { SkipLink } from "../layout";
import { useSession } from "../session";
import { canOpen, currentPageLabel, roleHome, roleLabel, saasNavSections } from "./nav";
import { NavIcon } from "./NavIcon";

function navActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UserMenu({ role }: { role: SaasRole | null | undefined }) {
  const { logout } = useSession();
  const router = useRouter();
  const initials = (roleLabel(role) || "SF").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2" aria-label="Conta">
          <Avatar className="size-9 cursor-pointer">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{roleLabel(role)}</p>
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

export function SaasChrome({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.saas_role;
  const loginPage = pathname === "/saas/entrar";
  const pageLabel = currentPageLabel(pathname, role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { main, adminItems } = saasNavSections(role);

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loginPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <div className="min-h-dvh bg-background" aria-busy="true" />;
  }

  const navButton = (item: { href: string; label: string; icon: Parameters<typeof NavIcon>[0]["name"] }) => {
    const active = navActive(pathname, item.href);
    return (
      <Button
        key={item.href}
        asChild
        variant={active ? "secondary" : "ghost"}
        className={cn("my-1 w-full justify-start shadow-none", active && "font-medium")}
      >
        <Link href={item.href} onClick={() => setSidebarOpen(false)}>
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      </Button>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Menu"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <Menu className="size-5" />
            </Button>
            <BrandMark href="/saas/inbox" layout="sidebar" />
          </div>
          <div className="flex items-center gap-3">
            <h1 className="hidden text-sm font-medium md:block">{pageLabel}</h1>
            <UserMenu role={role} />
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "w-64 shrink-0 border-r border-border bg-card lg:relative lg:block",
            sidebarOpen ? "absolute inset-y-0 left-0 z-40 block" : "hidden",
          )}
        >
          <nav className="h-full overflow-y-auto p-4">
            {main.map(navButton)}
            {adminItems.length ? (
              <>
                <p className="mt-4 mb-1 px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Admin
                </p>
                {adminItems.map(navButton)}
              </>
            ) : null}
            <p className="mt-4 px-2 text-xs text-muted-foreground">{roleLabel(role)}</p>
          </nav>
        </aside>
        {sidebarOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-30 bg-black/20 lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
