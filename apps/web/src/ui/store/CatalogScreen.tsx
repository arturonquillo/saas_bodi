"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, asPage, whatsappLink, type CatalogItemDto, type LojaConfigDto } from "../api";
import { BrandMark } from "../BrandMark";
import { useCart } from "../cart";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { StoreMain } from "../layout";
import { PlaceholderMedia } from "../PlaceholderMedia";
import { useSession } from "../session";
import { CatalogSkeleton, EmptyState, ErrorState, GateBanner } from "../states";

export function CatalogScreen() {
  const { session, status: sessStatus } = useSession();
  const { add } = useCart();
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [config, setConfig] = useState<LojaConfigDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [page, cfg] = await Promise.all([
        apiGet("/api/loja/catalogo?tenant=casa-dos-frios").then((d) => asPage<CatalogItemDto>(d)),
        apiGet<LojaConfigDto>("/api/loja/config?tenant=casa-dos-frios"),
      ]);
      setItems(page.items);
      setConfig(cfg);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guest = sessStatus === "guest";
  const prospecto = session?.cliente_status === "pendente";
  const wa = whatsappLink(config?.whatsapp_comercial, "Olá, Casa dos Frios! Vim pela loja.");

  return (
    <>
      <section
        className="relative min-h-[70vh] overflow-hidden border-b border-border md:min-h-[78vh]"
        style={{
          background:
            "linear-gradient(165deg, color-mix(in srgb, var(--color-background) 88%, white) 0%, var(--color-background) 42%, color-mix(in srgb, var(--brand-accent) 12%, var(--color-background)) 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 70% 20%, color-mix(in srgb, var(--brand-accent) 18%, transparent), transparent 70%), radial-gradient(ellipse 50% 40% at 10% 90%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 65%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-[1200px] flex-col justify-end px-4 pb-16 pt-24 md:min-h-[78vh] md:px-6 md:pb-20">
          <BrandMark href="/loja" layout="hero" className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500" />
          <h1 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl animate-in fade-in slide-in-from-bottom-3 duration-700">
            {COPY.hero_headline}
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {COPY.hero_support}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in duration-1000">
            {wa ? (
              <Button size="lg" variant="outline" asChild className="border-[var(--brand-accent)] text-[var(--brand-accent)]">
                <a href={wa} target="_blank" rel="noreferrer">
                  {COPY.cta_whatsapp}
                </a>
              </Button>
            ) : null}
            {guest ? (
              <Button size="lg" asChild>
                <Link href="/loja/cadastro">{COPY.cta_cadastrar}</Link>
              </Button>
            ) : (
              <Button size="lg" asChild>
                <a href="#catalogo">{COPY.cta_ver_catalogo}</a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <StoreMain>
        {prospecto ? (
          <div className="mb-6">
            <GateBanner />
          </div>
        ) : null}

        <div id="catalogo" className="scroll-mt-24">
          <h2 className="font-display mb-4 text-2xl font-semibold">{COPY.nav_catalogo}</h2>
          {status === "loading" ? (
            <CatalogSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : items.length === 0 ? (
            <EmptyState title={COPY.catalog_empty} art="catalog" />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {items.map((item) => (
                <Card key={item.id} className="gap-0 overflow-hidden rounded-lg py-0 ring-border">
                  <Link href={`/loja/produto/${item.id}`}>
                    <PlaceholderMedia nome={item.nome} variant="card" dimmed={item.sem_estoque} />
                  </Link>
                  <CardHeader className="space-y-1 p-3 pb-1">
                    <CardTitle className="text-sm leading-snug">
                      <Link href={`/loja/produto/${item.id}`} className="hover:text-primary">
                        {item.nome}
                      </Link>
                    </CardTitle>
                    <p className="text-base font-semibold text-primary">{formatMoney(item.preco_atacado_centavos)}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.qtd_min_atacado > 1 ? (
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {COPY.moq(item.qtd_min_atacado)}
                        </span>
                      ) : null}
                      {item.sem_estoque ? (
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {COPY.sem_estoque}
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardFooter className="p-3 pt-1">
                    <Button
                      className="w-full"
                      disabled={item.sem_estoque}
                      onClick={() => {
                        add(item.id, item.qtd_min_atacado || 1);
                      }}
                    >
                      {COPY.add_to_cart}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </StoreMain>
    </>
  );
}
