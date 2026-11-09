"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "../BrandMark";
import { useCart } from "../cart";
import { apiGet, whatsappLink, type LojaConfigDto } from "../api";
import { COPY } from "../copy";
import { SkipLink } from "../layout";
import { useSession } from "../session";

export function StoreChrome({ children }: { children: React.ReactNode }) {
  const { status, session, logout } = useSession();
  const { count } = useCart();
  const pathname = usePathname();
  const [config, setConfig] = useState<LojaConfigDto | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    void apiGet<LojaConfigDto>("/api/loja/config?tenant=casa-dos-frios")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const autenticado = status === "auth";
  const prospecto = session?.cliente_status === "pendente";
  const aprovado = session?.cliente_status === "aprovado";
  const wa = whatsappLink(config?.whatsapp_comercial, "Olá, Casa dos Frios! Vim pela loja.");

  const navLinks = (
    <>
      <Button variant="ghost" asChild>
        <Link href="/loja#catalogo" onClick={() => setMobileOpen(false)}>
          {COPY.nav_catalogo}
        </Link>
      </Button>
      {wa ? (
        <Button variant="outline" asChild className="border-[var(--brand-accent)] text-[var(--brand-accent)]">
          <a href={wa} target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}>
            {COPY.cta_whatsapp}
          </a>
        </Button>
      ) : null}
      <Button variant="ghost" asChild>
        <Link href="/loja/carrinho" onClick={() => setMobileOpen(false)}>
          {COPY.nav_carrinho}
          {count > 0 ? ` (${count})` : ""}
        </Link>
      </Button>
      {!autenticado ? (
        <>
          <Button variant="ghost" asChild>
            <Link href="/loja/cadastro" onClick={() => setMobileOpen(false)}>
              {COPY.nav_cadastro}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/loja/entrar" onClick={() => setMobileOpen(false)}>
              {COPY.submit_login}
            </Link>
          </Button>
        </>
      ) : (
        <>
          {(prospecto || aprovado) && (
            <Button variant="ghost" asChild>
              <Link href="/loja/meus-docs" onClick={() => setMobileOpen(false)}>
                {COPY.nav_meus_docs}
              </Link>
            </Button>
          )}
          {prospecto ? (
            <Button variant="ghost" asChild>
              <Link href="/loja/cadastro" onClick={() => setMobileOpen(false)}>
                {COPY.status_pendente}
              </Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center" aria-label="Conta">
                <Avatar className="size-9 cursor-pointer">
                  <AvatarFallback>
                    {(session?.cnpj_last4 ?? "CF").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  void logout();
                }}
              >
                {COPY.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </>
  );

  const hideChrome =
    pathname.startsWith("/loja/entrar") || pathname.startsWith("/loja/cadastro");

  if (hideChrome) {
    return (
      <>
        <SkipLink />
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 md:px-6">
          <BrandMark href="/loja" />
          <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
        {mobileOpen ? (
          <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">{navLinks}</nav>
        ) : null}
      </header>
      {children}
      <footer className="mt-auto border-t border-border bg-[var(--color-background)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-8 md:px-6">
          <BrandMark href="/loja" />
          {wa ? (
            <Button variant="outline" asChild className="border-[var(--brand-accent)] text-[var(--brand-accent)]">
              <a href={wa} target="_blank" rel="noreferrer">
                {COPY.cta_whatsapp}
              </a>
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
