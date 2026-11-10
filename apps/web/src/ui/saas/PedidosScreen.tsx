"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, netUnitCentavos, type PedidoStatus } from "@saas-frota/shared";
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
  lineNetUnitCentavos,
  skuIsActive,
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
import { DetailNavButton } from "../DetailNavRow";
import { useSession } from "../session";
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
    <SaasPage
      title={COPY.pedidos_title}
      description={COPY.pedidos_page_desc}
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
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle>{COPY.pedidos_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState
                title={COPY.pedidos_empty}
                body={COPY.pedidos_empty_body}
                art="pedidos"
                action={
                  <Button asChild className="bg-primary text-white hover:bg-primary/90">
                    <Link href="/saas/pedidos/novo">{COPY.pedido_novo}</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {items.map((p) => (
                  <li key={p.id}>
                    <DetailNavButton
                      className="rounded-md px-2 py-2"
                      onClick={() => router.push(`/saas/pedidos/${p.id}`)}
                      meta={
                        <>
                          <PedidoStatusBadge status={p.status} />
                          <MoneyCell centavos={docTotal(p.linhas)} />
                          <span className="text-sm text-muted-foreground">{formatDate(p.updated_at)}</span>
                        </>
                      }
                    >
                      <p className="font-medium text-foreground">{p.id}</p>
                      <p className="text-sm text-muted-foreground">{p.cliente_id}</p>
                    </DetailNavButton>
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
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/saas/pedidos" className="cursor-pointer hover:text-foreground hover:underline">
          ← {COPY.pedidos_title}
        </Link>
      </p>

      <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <PedidoStatusTrail status={item.status} />
        <p className="mt-2 text-sm text-muted-foreground">{COPY.pedidos_page_desc}</p>
      </div>

      <Card className="mb-8 shadow-sm">
        <CardHeader>
          <CardTitle>{COPY.customer}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="text-muted-foreground">{COPY.customer}: </span>
            <span className="text-foreground">{item.cliente_id}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Canal: </span>
            <span className="text-foreground">{item.channel}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8 shadow-sm">
        <CardHeader className="border-b border-border bg-muted/40">
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
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
                  {typeof l.desconto_pct === "number" && l.desconto_pct > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {COPY.desconto}: {l.desconto_pct}% · {COPY.lista_preco}:{" "}
                      {formatMoney(l.preco_lista_centavos ?? l.unit_price_centavos)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm text-gray-900">
                  {l.qty} × {formatMoney(lineNetUnitCentavos(l))}
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

type PedidoDraftLine = {
  sku_id: string;
  qty: number;
  desconto_pct: number;
  label: string;
  preco_lista_centavos: number;
  desconto_max_pct: number;
};

export function NovoPedidoScreen() {
  const router = useRouter();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [clientes, setClientes] = useState<CadastroDto[]>([]);
  const [skus, setSkus] = useState<EstoqueItemDto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState(1);
  const [descontoPct, setDescontoPct] = useState(0);
  const [linhas, setLinhas] = useState<PedidoDraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState(false);

  const selectedSku = skus.find((s) => s.id === skuId);
  const selectedCap = selectedSku?.desconto_max_pct ?? 0;

  useEffect(() => {
    void (async () => {
      try {
        setClientes(
          asPage<CadastroDto>(await apiGet("/api/saas/cadastros")).items.filter(
            (c) => c.status === "aprovado" && c.cliente_id,
          ),
        );
        setSkus(asPage<EstoqueItemDto>(await apiGet("/api/saas/estoque")).items.filter(skuIsActive));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!admin && selectedCap >= 0) {
      setDescontoPct((d) => Math.min(d, selectedCap));
    }
  }, [selectedCap, admin]);

  function addLine() {
    const sku = skus.find((s) => s.id === skuId);
    if (!sku) return;
    const cap = sku.desconto_max_pct ?? 0;
    const pct = admin ? Math.max(0, Math.min(100, descontoPct)) : Math.max(0, Math.min(cap, descontoPct));
    setLinhas((prev) => [
      ...prev,
      {
        sku_id: sku.id,
        qty: Math.max(sku.qtd_min_atacado, qty),
        desconto_pct: pct,
        label: `${sku.codigo} · ${sku.nome}`,
        preco_lista_centavos: sku.preco_atacado_centavos,
        desconto_max_pct: cap,
      },
    ]);
    setSkuId("");
    setQty(1);
    setDescontoPct(0);
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
        linhas: linhas.map(({ sku_id, qty: q, desconto_pct }) => ({
          sku_id,
          qty: q,
          desconto_pct,
        })),
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
                      {s.codigo} · {s.nome} · {formatMoney(s.preco_atacado_centavos)} · disp. {s.available}
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
              <div>
                <Label htmlFor="desconto" className="mb-2">
                  {COPY.desconto}
                </Label>
                <Input
                  id="desconto"
                  type="number"
                  min={0}
                  max={admin ? 100 : selectedCap}
                  value={descontoPct}
                  onChange={(e) => setDescontoPct(Number(e.target.value) || 0)}
                  className="w-24"
                  disabled={!skuId || (!admin && selectedCap === 0)}
                />
                {skuId ? (
                  <p className="mt-1 text-xs text-muted-foreground">{COPY.desconto_cap_hint(selectedCap)}</p>
                ) : null}
              </div>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={addLine} disabled={!skuId}>
                {COPY.add_line}
              </Button>
            </div>
            {linhas.length ? (
              <ul className="space-y-4">
                {linhas.map((l, i) => {
                  const net = netUnitCentavos(l.preco_lista_centavos, l.desconto_pct);
                  return (
                    <li key={`${l.sku_id}-${i}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm">
                        <p className="text-gray-900">
                          {l.label} × {l.qty}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {l.desconto_pct > 0
                            ? `${COPY.desconto} ${l.desconto_pct}% · ${COPY.lista_preco} ${formatMoney(l.preco_lista_centavos)} → ${COPY.preco_liquido} ${formatMoney(net)}`
                            : `${COPY.preco_liquido}: ${formatMoney(net)}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => setLinhas((p) => p.filter((_, j) => j !== i))}
                      >
                        Remover
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {gate ? <GateBanner message={COPY.gate_not_approved} /> : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" className="cursor-pointer bg-primary text-white hover:bg-primary/90" disabled={busy}>
              {COPY.criar_pedido}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
