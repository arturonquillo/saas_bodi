"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { VendaDto, VendaStatus } from "@saas-frota/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { DeskWrap, ListHeader, SaasMain } from "../layout";
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
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/saas/vendas/${v.id}`)}>
                  <TableCell className="font-medium">{v.id}</TableCell>
                  <TableCell>{v.cliente?.razao_social ?? "—"}</TableCell>
                  <TableCell>{v.pedido_id}</TableCell>
                  <TableCell>
                    <VendaStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell>{formatDate(v.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DeskWrap>
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
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/saas/vendas">{COPY.vendas_title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Alert className="mb-4 border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/8">
        <AlertDescription>{COPY.venda_stub_banner}</AlertDescription>
      </Alert>

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

      {error ? (
        <Alert className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notified ? <div className="mb-3"><NotifyAlert canais="whatsapp" /></div> : null}

      <DeskWrap className="mb-4 space-y-1 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{COPY.customer}: </span>
          {item.cliente?.razao_social ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Pedido: </span>
          {item.pedido_id}
        </p>
      </DeskWrap>

      <h2 className="mb-2 text-sm font-semibold">{COPY.history}</h2>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {item.history.map((h, i) => (
          <li key={`${h.to_status}-${i}`}>
            {h.from_status ?? "—"} → {h.to_status} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </SaasMain>
  );
}
