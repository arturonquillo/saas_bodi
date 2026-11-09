"use client";

import type { SaasRole } from "@saas-frota/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
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

function SaasNav({ pathname, role }: { pathname: string; role: SaasRole | null | undefined }) {
  const { setOpenMobile, isMobile } = useSidebar();
  const { main, adminItems } = saasNavSections(role);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-3 py-3">
        <BrandMark href="/saas/inbox" layout="sidebar" className="text-sidebar-foreground" />
      </SidebarHeader>
      <SidebarContent className="gap-1 px-2">
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={navActive(pathname, item.href)}
                    tooltip={item.label}
                    className={cn(
                      "h-9 rounded-md text-[13.5px]",
                      "data-[active=true]:border-l-[3px] data-[active=true]:border-l-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium",
                    )}
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                    }}
                  >
                    <Link href={item.href}>
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {adminItems.length ? (
          <>
            <SidebarSeparator />
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={navActive(pathname, item.href)}
                        tooltip={item.label}
                        className={cn(
                          "h-9 rounded-md text-[13.5px]",
                          "data-[active=true]:border-l-[3px] data-[active=true]:border-l-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium",
                        )}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <Link href={item.href}>
                          <NavIcon name={item.icon} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <SidebarSeparator className="mx-0 mb-2" />
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="rounded-md">
            {roleLabel(role)}
          </Badge>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function LogoutButton() {
  const { logout } = useSession();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void logout().then(() => router.push("/saas/entrar"));
      }}
    >
      {COPY.logout}
    </Button>
  );
}

export function SaasChrome({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.saas_role;
  const loginPage = pathname === "/saas/entrar";
  const pageLabel = currentPageLabel(pathname, role);

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
    return <div className="min-h-dvh bg-background" aria-busy="true" />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "240px" } as React.CSSProperties} className="min-h-svh">
      <SkipLink />
      <SaasNav pathname={pathname} role={role} />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1 size-8" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-display text-sm font-medium">{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
