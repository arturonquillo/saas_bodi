"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/loja">{COPY.nav_catalogo}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 md:grid-cols-2">
        <PlaceholderMedia nome={item.nome} variant="pdp" dimmed={item.sem_estoque} />
        <div>
          <h1 className="font-display text-3xl font-semibold">{item.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.sku}</p>
          <p className="mt-4 text-2xl font-semibold text-primary">{formatMoney(item.preco_atacado_centavos)}</p>
          <p className="text-sm text-muted-foreground">{COPY.price_atacado}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.qtd_min_atacado > 1 ? <Badge variant="secondary">{COPY.moq(item.qtd_min_atacado)}</Badge> : null}
            {item.sem_estoque ? <Badge variant="outline">{COPY.sem_estoque}</Badge> : null}
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
                toast.success(COPY.added_to_cart);
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
