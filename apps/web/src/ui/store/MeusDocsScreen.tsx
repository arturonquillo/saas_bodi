"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, asPage, docTotal, type OrcamentoDto, type PedidoDto } from "../api";
import { COPY } from "../copy";
import { formatDate, formatMoney } from "../format";
import { StoreMain } from "../layout";
import { OrcamentoStatusBadge, PedidoStatusBadge } from "../order-ui";
import { useSession } from "../session";
import { EmptyState, ErrorState, FormSkeleton } from "../states";

export function MeusDocsScreen() {
  const { status: sessStatus } = useSession();
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState<OrcamentoDto[]>([]);
  const [pedidos, setPedidos] = useState<PedidoDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [o, p] = await Promise.all([
        apiGet("/api/loja/orcamentos").then((d) => asPage<OrcamentoDto>(d)),
        apiGet("/api/loja/pedidos").then((d) => asPage<PedidoDto>(d)),
      ]);
      setOrcamentos(o.items);
      setPedidos(p.items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (sessStatus === "guest") {
      router.replace(`/loja/entrar?return=${encodeURIComponent("/loja/meus-docs")}`);
      return;
    }
    if (sessStatus === "auth") void load();
  }, [sessStatus, load, router]);

  if (sessStatus === "loading" || status === "loading") {
    return (
      <StoreMain>
        <FormSkeleton />
      </StoreMain>
    );
  }

  if (status === "error") {
    return (
      <StoreMain>
        <ErrorState onRetry={() => void load()} />
      </StoreMain>
    );
  }

  const empty = orcamentos.length === 0 && pedidos.length === 0;

  return (
    <StoreMain>
      <h1 className="font-display mb-4 text-2xl font-semibold">{COPY.nav_meus_docs}</h1>
      {empty ? (
        <EmptyState
          title={COPY.docs_empty}
          art="pedidos"
          action={
            <Button asChild>
              <Link href="/loja#catalogo">{COPY.ver_catalogo}</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="orcamentos">
          <TabsList>
            <TabsTrigger value="orcamentos">{COPY.tab_orcamentos}</TabsTrigger>
            <TabsTrigger value="pedidos">{COPY.tab_pedidos}</TabsTrigger>
          </TabsList>
          <TabsContent value="orcamentos" className="mt-4 space-y-2">
            {orcamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.orcamentos_empty}</p>
            ) : (
              orcamentos.map((o) => (
                <Link
                  key={o.id}
                  href={`/loja/orcamentos/${o.id}`}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{o.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{formatMoney(docTotal(o.linhas))}</span>
                    <OrcamentoStatusBadge status={o.status} />
                  </div>
                </Link>
              ))
            )}
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4 space-y-2">
            {pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.pedidos_empty}</p>
            ) : (
              pedidos.map((p) => (
                <Link
                  key={p.id}
                  href={`/loja/pedidos/${p.id}`}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{p.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{formatMoney(docTotal(p.linhas))}</span>
                    <PedidoStatusBadge status={p.status} />
                  </div>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </StoreMain>
  );
}
