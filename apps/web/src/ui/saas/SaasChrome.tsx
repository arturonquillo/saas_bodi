"use client";

import type { SaasRole } from "@saas-frota/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { SkipLink } from "../layout";
import { useSession } from "../session";
import {
  canOpen,
  currentPageLabel,
  roleHome,
  roleLabel,
  saasNavSections,
  type NavItem,
} from "./nav";
import { NavIcon } from "./NavIcon";

function navActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Outer ACME-style header from saas-starter app/(dashboard)/layout.tsx
 * + nested dashboard shell from app/(dashboard)/dashboard/layout.tsx.
 */
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
          <Link href="/saas/inbox" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>{COPY.nav.inbox}</span>
          </Link>
        </DropdownMenuItem>
        <p className="px-2 py-1 text-xs text-gray-500">{roleLabel(role)}</p>
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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <BrandMark href="/saas/inbox" className="text-gray-900" />
        <div className="flex items-center space-x-4">
          <UserMenu role={role} />
        </div>
      </div>
    </header>
  );
}

function DashboardNav({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="h-full overflow-y-auto p-4">
      {items.map((item) => {
        const active = navActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} passHref>
            <Button
              variant={active ? "secondary" : "ghost"}
              className={`my-1 w-full justify-start shadow-none ${active ? "bg-gray-100" : ""}`}
              onClick={onNavigate}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
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
  const { main, adminItems } = saasNavSections(role);
  const navItems = [...main, ...adminItems];

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
    return <>{children}</>;
  }

  if (status === "loading") {
    return <div className="min-h-screen bg-gray-50" aria-busy="true" />;
  }

  return (
    <section className="flex min-h-screen flex-col bg-gray-50">
      <SkipLink />
      <Header role={role} />

      {/* Nested dashboard shell — saas-starter dashboard/layout.tsx */}
      <div className="mx-auto flex w-full max-w-7xl flex-col min-h-[calc(100dvh-68px)]">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 lg:hidden">
          <span className="font-medium text-gray-900">{pageLabel}</span>
          <Button
            className="-mr-3"
            variant="ghost"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <div className="relative flex h-full flex-1 overflow-hidden">
          <aside
            className={`absolute inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:relative lg:block lg:translate-x-0 lg:bg-gray-50 ${
              isSidebarOpen ? "block translate-x-0" : "hidden -translate-x-full"
            }`}
          >
            <DashboardNav
              items={navItems}
              pathname={pathname}
              onNavigate={() => setIsSidebarOpen(false)}
            />
          </aside>

          <main id="conteudo" className="flex-1 overflow-y-auto p-0 lg:p-4">
            {children}
          </main>
        </div>
      </div>
    </section>
  );
}
