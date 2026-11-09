"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PedidoStatus } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiGet,
  apiSend,
  asPage,
  docTotal,
  isApiError,
  type CadastroDto,
  type EstoqueItemDto,
  type PedidoDto,
  type VendaDto,
} from "../api";
import { COPY } from "../copy";
import { formatDate, formatMoney } from "../format";
import { ListHeader, SaasMain } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  PedidoStatusBadge,
  PedidoStatusTrail,
  legalPedidoTargets,
  pedidoTransitionLabel,
} from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

const selectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function PedidosListScreen() {
  const [items, setItems] = useState<PedidoDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<PedidoDto>(await apiGet("/api/saas/pedidos")).items);
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
      <ListHeader
        title={COPY.pedidos_title}
        actions={
          <Button asChild>
            <Link href="/saas/pedidos/novo">{COPY.pedido_novo}</Link>
          </Button>
        }
      />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={COPY.pedidos_empty}
          action={
            <Button asChild>
              <Link href="/saas/pedidos/novo">{COPY.pedido_novo}</Link>
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => router.push(`/saas/pedidos/${p.id}`)}
                  >
                    <div>
                      <p className="font-medium">{p.id}</p>
                      <p className="text-sm text-muted-foreground">{p.cliente_id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <PedidoStatusBadge status={p.status} />
                      <MoneyCell centavos={docTotal(p.linhas)} />
                      <span className="text-muted-foreground">{formatDate(p.updated_at)}</span>
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

export function PedidoDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PedidoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);
  const [confirmTo, setConfirmTo] = useState<PedidoStatus | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<PedidoDto>(`/api/saas/pedidos/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTransition(para: PedidoStatus) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<PedidoDto>(`/api/saas/pedidos/${id}/transicao`, "POST", { para });
      setItem(next);
      setNotified(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
      setConfirmTo(null);
    }
  }

  async function faturar() {
    setBusy(true);
    setError(null);
    try {
      const venda = await apiSend<VendaDto>(`/api/saas/pedidos/${id}/faturar`, "POST");
      window.location.href = `/saas/vendas/${venda.id}`;
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  function onClickTransition(to: PedidoStatus) {
    if (to === "despachado" || to === "cancelado") {
      setConfirmTo(to);
      return;
    }
    void runTransition(to);
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

  const targets = legalPedidoTargets(item.status);

  return (
    <SaasMain>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/saas/pedidos" className="hover:text-primary">
          {COPY.pedidos_title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.id}</span>
      </p>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">{item.id}</h1>
        <PedidoStatusBadge status={item.status} large />
      </div>
      <div className="mb-4">
        <PedidoStatusTrail status={item.status} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {targets.map((to) => (
          <Button
            key={to}
            type="button"
            variant={to === "cancelado" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => onClickTransition(to)}
          >
            {pedidoTransitionLabel(to)}
          </Button>
        ))}
        {item.status !== "cancelado" ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void faturar()}>
            {COPY.faturar}
          </Button>
        ) : null}
      </div>

      {confirmTo ? (
        <Card className="mb-4 gap-0 py-0">
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">
              {confirmTo === "despachado" ? COPY.to_despachado : COPY.cancel_pedido}
            </p>
            <p className="text-sm text-muted-foreground">
              {confirmTo === "despachado" ? COPY.confirm_dispatch : COPY.cancel_confirm}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmTo(null)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void runTransition(confirmTo)}>
                {COPY.actions.confirmar}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      {notified ? (
        <div className="mb-3">
          <NotifyAlert canais="whatsapp" />
        </div>
      ) : null}

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="space-y-1 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">{COPY.customer}: </span>
            {item.cliente_id}
          </p>
          <p>
            <span className="text-muted-foreground">Canal: </span>
            {item.channel}
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold">{COPY.section_items}</h2>
      <Card className="mb-4 gap-0 py-0">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            <li className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>SKU</span>
              <span>Nome</span>
              <span>Qtd</span>
              <span>Preço</span>
            </li>
            {item.linhas.map((l) => (
              <li key={l.id} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                <span>{l.codigo}</span>
                <span>{l.nome}</span>
                <span>{l.qty}</span>
                <span>{formatMoney(l.unit_price_centavos)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="mb-4 text-sm font-semibold">
        Total: <MoneyCell centavos={docTotal(item.linhas)} />
      </p>

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

export function NovoPedidoScreen() {
  const router = useRouter();
  const [clientes, setClientes] = useState<CadastroDto[]>([]);
  const [skus, setSkus] = useState<EstoqueItemDto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState(1);
  const [linhas, setLinhas] = useState<{ sku_id: string; qty: number; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setClientes(
          asPage<CadastroDto>(await apiGet("/api/saas/cadastros")).items.filter(
            (c) => c.status === "aprovado" && c.cliente_id,
          ),
        );
        setSkus(asPage<EstoqueItemDto>(await apiGet("/api/saas/estoque")).items);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function addLine() {
    const sku = skus.find((s) => s.id === skuId);
    if (!sku) return;
    setLinhas((prev) => [
      ...prev,
      { sku_id: sku.id, qty: Math.max(sku.qtd_min_atacado, qty), label: `${sku.codigo} · ${sku.nome}` },
    ]);
    setSkuId("");
    setQty(1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || !linhas.length) {
      setError("Selecione cliente e itens.");
      return;
    }
    setBusy(true);
    setError(null);
    setGate(false);
    try {
      const ped = await apiSend<PedidoDto>("/api/saas/pedidos", "POST", {
        cliente_id: clienteId,
        linhas: linhas.map(({ sku_id, qty: q }) => ({ sku_id, qty: q })),
      });
      router.push(`/saas/pedidos/${ped.id}`);
    } catch (err) {
      if (isApiError(err) && err.code === "cadastro_nao_aprovado") setGate(true);
      else setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  return (
    <SaasMain>
      <ListHeader title={COPY.pedido_novo} />
      <form className="max-w-xl space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="cliente" className="mb-2">
            {COPY.customer}
          </Label>
          <select
            id="cliente"
            className={selectClass}
            value={clienteId || "none"}
            onChange={(e) => setClienteId(e.target.value === "none" ? "" : e.target.value)}
          >
            <option value="none">—</option>
            {clientes.map((c) => (
              <option key={c.cliente_id!} value={c.cliente_id!}>
                {c.razao_social}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="sku" className="mb-2">
              SKU
            </Label>
            <select
              id="sku"
              className={selectClass}
              value={skuId || "none"}
              onChange={(e) => setSkuId(e.target.value === "none" ? "" : e.target.value)}
            >
              <option value="none">—</option>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} · {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="qty" className="mb-2">
              {COPY.qty}
            </Label>
            <Input
              id="qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className="w-24"
            />
          </div>
          <Button type="button" variant="outline" onClick={addLine} disabled={!skuId}>
            {COPY.add_line}
          </Button>
        </div>
        {linhas.length ? (
          <ul className="space-y-1 text-sm">
            {linhas.map((l, i) => (
              <li key={`${l.sku_id}-${i}`} className="flex justify-between gap-2">
                <span>
                  {l.label} × {l.qty}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinhas((p) => p.filter((_, j) => j !== i))}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {gate ? <GateBanner message={COPY.gate_not_approved} /> : null}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {COPY.criar_pedido}
        </Button>
      </form>
    </SaasMain>
  );
}
