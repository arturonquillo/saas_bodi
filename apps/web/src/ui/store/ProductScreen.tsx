"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiGet, type CatalogItemDto } from "../api";
import { useCart } from "../cart";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { QtyStepper, StoreMain } from "../layout";
import { PlaceholderMedia } from "../PlaceholderMedia";
import { CardSkeleton, ErrorState } from "../states";

export function ProductScreen() {
  const { id } = useParams<{ id: string }>();
  const { add } = useCart();
  const [item, setItem] = useState<CatalogItemDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [qty, setQty] = useState(1);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await apiGet<CatalogItemDto>(`/api/loja/produtos/${id}?tenant=casa-dos-frios`);
      setItem(data);
      setQty(data.qtd_min_atacado || 1);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <StoreMain>
        <CardSkeleton />
      </StoreMain>
    );
  }
  if (status === "error" || !item) {
    return (
      <StoreMain>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </StoreMain>
    );
  }

  return (
    <StoreMain>
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/loja" className="hover:text-primary">
          {COPY.nav_catalogo}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.nome}</span>
      </p>

      <div className="grid gap-8 md:grid-cols-2">
        <PlaceholderMedia nome={item.nome} variant="pdp" dimmed={item.sem_estoque} />
        <div>
          <h1 className="font-display text-3xl font-semibold">{item.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.sku}</p>
          <p className="mt-4 text-2xl font-semibold text-primary">{formatMoney(item.preco_atacado_centavos)}</p>
          <p className="text-sm text-muted-foreground">{COPY.price_atacado}</p>
          <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">{COPY.qty}</p>
            <QtyStepper
              surface="store"
              value={qty}
              min={item.qtd_min_atacado || 1}
              max={item.available > 0 ? item.available : undefined}
              onChange={setQty}
            />
            <Button
              className="h-11 w-full sm:w-auto"
              disabled={item.sem_estoque}
              onClick={() => {
                add(item.id, qty);
              }}
            >
              {COPY.add_to_cart}
            </Button>
          </div>
        </div>
      </div>
    </StoreMain>
  );
}
