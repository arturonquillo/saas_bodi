"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PedidoStatus } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SaasPage } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  PedidoStatusBadge,
  PedidoStatusTrail,
  legalPedidoTargets,
  pedidoTransitionLabel,
} from "../order-ui";
import { ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

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
    <SaasPage
      title={COPY.pedidos_title}
      actions={
        <Button asChild className="bg-primary text-white hover:bg-primary/90">
          <Link href="/saas/pedidos/novo">{COPY.pedido_novo}</Link>
        </Button>
      }
    >
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.pedidos_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.pedidos_empty}</h3>
                <p className="mb-4 max-w-sm text-sm text-gray-500">
                  Crie um pedido para clientes com cadastro aprovado.
                </p>
                <Button asChild className="bg-primary text-white hover:bg-primary/90">
                  <Link href="/saas/pedidos/novo">{COPY.pedido_novo}</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/saas/pedidos/${p.id}`)}
                    >
                      <p className="font-medium text-gray-900">{p.id}</p>
                      <p className="text-sm text-gray-500">{p.cliente_id}</p>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                      <PedidoStatusBadge status={p.status} />
                      <MoneyCell centavos={docTotal(p.linhas)} />
                      <span className="text-gray-500">{formatDate(p.updated_at)}</span>
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
      <SaasPage title={COPY.pedidos_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.pedidos_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  const targets = legalPedidoTargets(item.status);

  return (
    <SaasPage
      title={item.id}
      actions={<PedidoStatusBadge status={item.status} large />}
    >
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/pedidos" className="hover:text-gray-900">
          ← {COPY.pedidos_title}
        </Link>
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.customer}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="mb-2">
            <PedidoStatusTrail status={item.status} />
          </div>
          <p className="text-sm">
            <span className="text-gray-500">{COPY.customer}: </span>
            <span className="text-gray-900">{item.cliente_id}</span>
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Canal: </span>
            <span className="text-gray-900">{item.channel}</span>
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
            <div className="space-y-3 rounded-md border border-gray-200 p-4">
              <p className="font-medium text-gray-900">
                {confirmTo === "despachado" ? COPY.to_despachado : COPY.cancel_pedido}
              </p>
              <p className="text-sm text-gray-500">
                {confirmTo === "despachado" ? COPY.confirm_dispatch : COPY.cancel_confirm}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmTo(null)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={busy}
                  onClick={() => void runTransition(confirmTo)}
                >
                  {COPY.actions.confirmar}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {notified ? <NotifyAlert canais="whatsapp" /> : null}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.section_items}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {item.linhas.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{l.codigo}</p>
                  <p className="text-sm text-gray-500">{l.nome}</p>
                </div>
                <div className="text-right text-sm text-gray-900">
                  {l.qty} × {formatMoney(l.unit_price_centavos)}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold text-gray-900">
            Total: <MoneyCell centavos={docTotal(item.linhas)} />
          </p>
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
    <SaasPage title={COPY.pedido_novo}>
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/pedidos" className="hover:text-gray-900">
          ← {COPY.pedidos_title}
        </Link>
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.pedido_novo}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
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
              <ul className="space-y-4">
                {linhas.map((l, i) => (
                  <li key={`${l.sku_id}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-900">
                      {l.label} × {l.qty}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
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
            <Button type="submit" className="bg-primary text-white hover:bg-primary/90" disabled={busy}>
              {COPY.criar_pedido}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
