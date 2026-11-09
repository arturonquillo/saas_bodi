"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { OrcamentoStatus } from "@saas-frota/shared";
import type { OrcamentoDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiGet,
  apiSend,
  asPage,
  buildClienteOptions,
  clienteDisplay,
  docTotal,
  isApiError,
  type CadastroDto,
  type ClienteOption,
  type EstoqueItemDto,
} from "../api";
import { COPY } from "../copy";
import { formatDate, formatDateOnly, formatMoney } from "../format";
import { ListHeader, SaasMain } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  OrcamentoStatusBadge,
  legalOrcamentoTargets,
  orcamentoTransitionLabel,
} from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

const selectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function OrcamentosListScreen() {
  const [items, setItems] = useState<OrcamentoDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<OrcamentoDto>(await apiGet("/api/saas/orcamentos")).items);
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
        title={COPY.orcamentos_title}
        actions={
          <Button asChild>
            <Link href="/saas/orcamentos/novo">{COPY.orcamento_novo}</Link>
          </Button>
        }
      />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={COPY.orcamentos_empty}
          action={
            <Button asChild>
              <Link href="/saas/orcamentos/novo">{COPY.orcamento_novo}</Link>
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => router.push(`/saas/orcamentos/${o.id}`)}
                  >
                    <div>
                      <p className="font-medium">{o.id}</p>
                      <p className="text-sm text-muted-foreground">{clienteDisplay(o)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <OrcamentoStatusBadge status={o.status} />
                      <MoneyCell centavos={docTotal(o.linhas ?? [])} />
                      <span className="text-muted-foreground">{formatDate(o.updated_at)}</span>
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

export function OrcamentoDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<OrcamentoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<OrcamentoDto>(`/api/saas/orcamentos/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(para: OrcamentoStatus) {
    setBusy(true);
    setError(null);
    setGate(false);
    try {
      const next = await apiSend<OrcamentoDto>(`/api/saas/orcamentos/${id}/transicao`, "POST", { para });
      setItem(next);
      setNotified(true);
    } catch (err) {
      if (isApiError(err) && err.code === "cadastro_nao_aprovado") {
        setGate(true);
      } else {
        setError(isApiError(err) ? err.message : COPY.save_fail);
      }
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

  const targets = legalOrcamentoTargets(item.status);
  const linhas = item.linhas ?? [];
  const historico = item.historico ?? [];

  return (
    <SaasMain>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/saas/orcamentos" className="hover:text-primary">
          {COPY.orcamentos_title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.id}</span>
      </p>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">{item.id}</h1>
        <OrcamentoStatusBadge status={item.status} large />
      </div>

      {item.status === "expirado" ? (
        <p className="mb-3 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm">
          {COPY.orcamento_expired}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {targets.map((to) => (
          <Button
            key={to}
            type="button"
            variant={to === "cancelado" || to === "recusado" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void transition(to)}
          >
            {orcamentoTransitionLabel(to)}
          </Button>
        ))}
        {item.pedido_id ? (
          <Button variant="outline" asChild>
            <Link href={`/saas/pedidos/${item.pedido_id}`}>Ver pedido</Link>
          </Button>
        ) : null}
      </div>

      {gate ? (
        <div className="mb-3">
          <GateBanner message={COPY.gate_not_approved} />
        </div>
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
            {clienteDisplay(item)}
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.valido_ate}: </span>
            {formatDateOnly(item.valido_ate)}
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
            {linhas.map((l) => (
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
        Total: <MoneyCell centavos={docTotal(linhas)} />
      </p>

      <h2 className="mb-2 text-sm font-semibold">{COPY.history}</h2>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {historico.map((h, i) => (
          <li key={`${h.to}-${i}`}>
            {h.from ?? "—"} → {h.to} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </SaasMain>
  );
}

export function NovoOrcamentoScreen() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [skus, setSkus] = useState<EstoqueItemDto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [validoAte, setValidoAte] = useState("");
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState(1);
  const [linhas, setLinhas] = useState<{ sku_id: string; qty: number; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [orcamentos, estoque, cadastros] = await Promise.all([
          apiGet("/api/saas/orcamentos").then((d) => asPage<OrcamentoDto>(d)),
          apiGet("/api/saas/estoque").then((d) => asPage<EstoqueItemDto>(d)),
          apiGet("/api/saas/cadastros").then((d) => asPage<CadastroDto>(d)),
        ]);
        setClientes(
          buildClienteOptions({ orcamentos: orcamentos.items, cadastros: cadastros.items }),
        );
        setSkus(estoque.items);
      } catch {
        setClientes(buildClienteOptions({}));
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
    if (!linhas.length) {
      setError("Adicione ao menos um item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const orc = await apiSend<OrcamentoDto>("/api/saas/orcamentos", "POST", {
        cliente_id: clienteId || undefined,
        valido_ate: validoAte || undefined,
        linhas: linhas.map(({ sku_id, qty: q }) => ({ sku_id, qty: q })),
      });
      router.push(`/saas/orcamentos/${orc.id}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  return (
    <SaasMain>
      <ListHeader title={COPY.orcamento_novo} />
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
            <option value="none">Prospecto (sem cliente)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="valido" className="mb-2">
            {COPY.valido_ate}
          </Label>
          <Input id="valido" type="date" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
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
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {COPY.criar_orcamento}
        </Button>
      </form>
    </SaasMain>
  );
}
