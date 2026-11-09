"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { VendaStatus } from "@saas-frota/shared";
import type { VendaDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { ListHeader, SaasMain } from "../layout";
import { NotifyAlert, VendaStatusBadge, legalVendaTargets, vendaTransitionLabel } from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, TableSkeleton } from "../states";

export function VendasListScreen() {
  const [items, setItems] = useState<VendaDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<VendaDto>(await apiGet("/api/saas/vendas")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SaasMain>
      <ListHeader title={COPY.vendas_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.vendas_empty} />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => router.push(`/saas/vendas/${v.id}`)}
                  >
                    <div>
                      <p className="font-medium">{v.id}</p>
                      <p className="text-sm text-muted-foreground">Pedido: {v.pedido_id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <VendaStatusBadge status={v.status} />
                      <span className="text-muted-foreground">{formatDate(v.updated_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </SaasMain>
  );
}

export function VendaDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<VendaDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<VendaDto>(`/api/saas/vendas/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(para: VendaStatus) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<VendaDto>(`/api/saas/vendas/${id}/transicao`, "POST", { para });
      setItem(next);
      setNotified(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasMain>
        <FormSkeleton />
      </SaasMain>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasMain>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasMain>
    );
  }

  const targets = legalVendaTargets(item.status);

  return (
    <SaasMain>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/saas/vendas" className="hover:text-primary">
          {COPY.vendas_title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.id}</span>
      </p>

      <p className="mb-4 rounded-md border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/8 px-3 py-2 text-sm">
        {COPY.venda_stub_banner}
      </p>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">{item.id}</h1>
        <VendaStatusBadge status={item.status} large />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {targets.map((to) => (
          <Button
            key={to}
            type="button"
            variant={to === "cancelado" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void transition(to)}
          >
            {vendaTransitionLabel(to)}
          </Button>
        ))}
        <Button variant="outline" asChild>
          <Link href={`/saas/pedidos/${item.pedido_id}`}>Ver pedido</Link>
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      {notified ? (
        <div className="mb-3">
          <NotifyAlert canais="whatsapp" />
        </div>
      ) : null}

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="space-y-1 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Pedido: </span>
            {item.pedido_id}
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold">{COPY.history}</h2>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {item.historico.map((h, i) => (
          <li key={`${h.to}-${i}`}>
            {h.from ?? "—"} → {h.to} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </SaasMain>
  );
}
