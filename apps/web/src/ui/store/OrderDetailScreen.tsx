"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PedidoDto } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, docTotal } from "../api";
import { COPY } from "../copy";
import { formatDate, formatMoney } from "../format";
import { StoreMain } from "../layout";
import { MoneyCell, PedidoStatusBadge, PedidoStatusTrail } from "../order-ui";
import { useSession } from "../session";
import { ErrorState, FormSkeleton } from "../states";

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { status: sessStatus } = useSession();
  const router = useRouter();
  const [item, setItem] = useState<PedidoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<PedidoDto>(`/api/loja/pedidos/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    if (sessStatus === "guest") {
      router.replace(`/loja/entrar?return=${encodeURIComponent(`/loja/pedidos/${id}`)}`);
      return;
    }
    if (sessStatus === "auth") void load();
  }, [sessStatus, load, router, id]);

  if (sessStatus === "loading" || status === "loading") {
    return (
      <StoreMain>
        <FormSkeleton />
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
        <Link href="/loja/meus-docs" className="hover:text-primary">
          {COPY.nav_meus_docs}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.id}</span>
      </p>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{item.id}</h1>
        <PedidoStatusBadge status={item.status} large />
      </div>
      <div className="mb-6">
        <PedidoStatusTrail status={item.status} />
      </div>

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            <li className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Item</span>
              <span>Qtd</span>
              <span>Preço</span>
            </li>
            {item.linhas.map((l) => (
              <li key={l.id} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
                <span>{l.nome}</span>
                <span>{l.qty}</span>
                <span>{formatMoney(l.unit_price_centavos)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="mb-4 font-semibold">
        Total: <MoneyCell centavos={docTotal(item.linhas ?? [])} />
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {item.historico.map((h, i) => (
          <li key={`${h.to}-${i}`}>
            {h.from ?? "—"} → {h.to} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </StoreMain>
  );
}
