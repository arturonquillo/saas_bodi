"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiGet, apiSend, asPage, isApiError, type CatalogItemDto, type PedidoDto } from "../api";
import { useCart } from "../cart";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { QtyStepper, StoreMain } from "../layout";
import { PlaceholderMedia } from "../PlaceholderMedia";
import { useSession } from "../session";
import { EmptyState, ErrorState, GateBanner } from "../states";

export function CartScreen() {
  const { lines, setQty, clear, count } = useCart();
  const { status: sessStatus, session } = useSession();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogItemDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setCatalog(asPage<CatalogItemDto>(await apiGet("/api/loja/catalogo?tenant=casa-dos-frios")).items);
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
  const aprovado = session?.cliente_status === "aprovado";

  const resolved = lines
    .map((l) => {
      const item = catalog.find((c) => c.id === l.sku_id);
      return item ? { line: l, item } : null;
    })
    .filter(Boolean) as { line: { sku_id: string; qty: number }; item: CatalogItemDto }[];

  const total = resolved.reduce((sum, r) => sum + r.line.qty * r.item.preco_atacado_centavos, 0);

  async function checkout() {
    if (!aprovado) return;
    setBusy(true);
    setError(null);
    try {
      const ped = await apiSend<PedidoDto>("/api/loja/pedidos", "POST", {
        linhas: lines.map((l) => ({ sku_id: l.sku_id, qty: l.qty })),
      });
      clear();
      router.push(`/loja/pedidos/${ped.id}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  return (
    <StoreMain>
      <h1 className="font-display mb-4 text-2xl font-semibold">{COPY.nav_carrinho}</h1>

      {prospecto ? (
        <div className="mb-4">
          <GateBanner />
        </div>
      ) : null}

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : count === 0 ? (
        <EmptyState
          title={COPY.cart_empty}
          art="cart"
          action={
            <Button asChild>
              <Link href="/loja#catalogo">{COPY.ver_catalogo}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {resolved.map(({ line, item }) => (
            <div key={line.sku_id} className="flex gap-3 border-b border-border pb-4">
              <PlaceholderMedia nome={item.nome} variant="thumb" />
              <div className="min-w-0 flex-1">
                <Link href={`/loja/produto/${item.id}`} className="font-medium hover:text-primary">
                  {item.nome}
                </Link>
                <p className="text-sm text-primary">{formatMoney(item.preco_atacado_centavos)}</p>
                {item.sem_estoque ? <p className="text-xs text-destructive">{COPY.sem_estoque}</p> : null}
                <div className="mt-2">
                  <QtyStepper
                    surface="store"
                    value={line.qty}
                    min={item.qtd_min_atacado || 1}
                    max={item.available > 0 ? item.available : undefined}
                    onChange={(n) => setQty(line.sku_id, n)}
                  />
                </div>
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(line.qty * item.preco_atacado_centavos)}
              </p>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-lg font-semibold">
              Total: <span className="text-primary">{formatMoney(total)}</span>
            </p>
            {guest ? (
              <Button asChild>
                <Link href={`/loja/entrar?return=${encodeURIComponent("/loja/carrinho")}`}>
                  {COPY.entrar_para_pedir}
                </Link>
              </Button>
            ) : aprovado ? (
              <Button disabled={busy || resolved.some((r) => r.item.sem_estoque)} onClick={() => void checkout()}>
                {COPY.checkout}
              </Button>
            ) : null}
          </div>

          {error ? (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    </StoreMain>
  );
}
