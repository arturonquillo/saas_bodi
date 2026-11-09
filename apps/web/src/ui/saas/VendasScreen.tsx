"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { VendaStatus } from "@saas-frota/shared";
import type { VendaDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { SaasPage } from "../layout";
import { NotifyAlert, VendaStatusBadge, legalVendaTargets, vendaTransitionLabel } from "../order-ui";
import { ErrorState, FormSkeleton, TableSkeleton } from "../states";

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
    <SaasPage title={COPY.vendas_title}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.vendas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.vendas_empty}</h3>
                <p className="max-w-sm text-sm text-gray-500">
                  Vendas faturadas a partir de pedidos aparecerão nesta lista.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/saas/vendas/${v.id}`)}
                    >
                      <p className="font-medium text-gray-900">{v.id}</p>
                      <p className="text-sm text-gray-500">Pedido: {v.pedido_id}</p>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                      <VendaStatusBadge status={v.status} />
                      <span className="text-gray-500">{formatDate(v.updated_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </SaasPage>
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
      <SaasPage title={COPY.vendas_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.vendas_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  const targets = legalVendaTargets(item.status);

  return (
    <SaasPage
      title={item.id}
      actions={<VendaStatusBadge status={item.status} large />}
    >
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/vendas" className="hover:text-gray-900">
          ← {COPY.vendas_title}
        </Link>
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pedido vinculado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-500">{COPY.venda_stub_banner}</p>
          <p className="text-sm">
            <span className="text-gray-500">Pedido: </span>
            <Link href={`/saas/pedidos/${item.pedido_id}`} className="text-gray-900 hover:underline">
              {item.pedido_id}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {targets.map((to) => (
              <Button
                key={to}
                type="button"
                variant={to === "cancelado" ? "destructive" : "default"}
                className={to === "cancelado" ? undefined : "bg-primary text-white hover:bg-primary/90"}
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
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {notified ? <NotifyAlert canais="whatsapp" /> : null}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.history}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {item.historico.map((h, i) => (
              <li key={`${h.to}-${i}`} className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-gray-900">
                  {h.from ?? "—"} → {h.to}
                </p>
                <p className="text-xs text-gray-500">{formatDate(h.created_at)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
