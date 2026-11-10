"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, netUnitCentavos, type OrcamentoStatus } from "@saas-frota/shared";
import type { OrcamentoDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  lineNetUnitCentavos,
  skuIsActive,
  type CadastroDto,
  type ClienteOption,
  type EstoqueItemDto,
} from "../api";
import { COPY } from "../copy";
import { formatDate, formatDateOnly, formatMoney } from "../format";
import { SaasPage } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  OrcamentoStatusBadge,
  legalOrcamentoTargets,
  orcamentoTransitionLabel,
} from "../order-ui";
import { DetailNavButton } from "../DetailNavRow";
import { useSession } from "../session";
import { ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

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
    <SaasPage
      title={COPY.orcamentos_title}
      actions={
        <Button asChild className="bg-primary text-white hover:bg-primary/90">
          <Link href="/saas/orcamentos/novo">{COPY.orcamento_novo}</Link>
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
            <CardTitle>{COPY.orcamentos_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.orcamentos_empty}</h3>
                <p className="mb-4 max-w-sm text-sm text-gray-500">
                  Crie um orçamento para iniciar a cotação com o cliente.
                </p>
                <Button asChild className="bg-primary text-white hover:bg-primary/90">
                  <Link href="/saas/orcamentos/novo">{COPY.orcamento_novo}</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((o) => (
                  <li key={o.id}>
                    <DetailNavButton
                      className="rounded-md px-2 py-2"
                      onClick={() => router.push(`/saas/orcamentos/${o.id}`)}
                      meta={
                        <>
                          <OrcamentoStatusBadge status={o.status} />
                          <MoneyCell centavos={docTotal(o.linhas ?? [])} />
                          <span className="text-sm text-muted-foreground">{formatDate(o.updated_at)}</span>
                        </>
                      }
                    >
                      <p className="font-medium text-foreground">{o.id}</p>
                      <p className="text-sm text-muted-foreground">{clienteDisplay(o)}</p>
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
      <SaasPage title={COPY.orcamentos_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.orcamentos_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  const targets = legalOrcamentoTargets(item.status);
  const linhas = item.linhas ?? [];
  const historico = item.historico ?? [];

  return (
    <SaasPage
      title={item.id}
      actions={<OrcamentoStatusBadge status={item.status} large />}
    >
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/orcamentos" className="hover:text-gray-900">
          ← {COPY.orcamentos_title}
        </Link>
      </p>

      {item.status === "expirado" ? (
        <p className="mb-6 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm">
          {COPY.orcamento_expired}
        </p>
      ) : null}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.customer}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">{COPY.customer}: </span>
            <span className="text-gray-900">{clienteDisplay(item)}</span>
          </p>
          <p>
            <span className="text-gray-500">{COPY.valido_ate}: </span>
            <span className="text-gray-900">{formatDateOnly(item.valido_ate)}</span>
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
                variant={to === "cancelado" || to === "recusado" ? "destructive" : "default"}
                className={
                  to === "cancelado" || to === "recusado"
                    ? undefined
                    : "bg-primary text-white hover:bg-primary/90"
                }
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
          {gate ? <GateBanner message={COPY.gate_not_approved} /> : null}
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
            {linhas.map((l) => (
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
                <div className="text-right text-sm">
                  <p className="text-gray-900">
                    {l.qty} × {formatMoney(lineNetUnitCentavos(l))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold text-gray-900">
            Total: <MoneyCell centavos={docTotal(linhas)} />
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.history}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {historico.map((h, i) => (
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

type DraftLine = {
  sku_id: string;
  qty: number;
  desconto_pct: number;
  label: string;
  preco_lista_centavos: number;
  desconto_max_pct: number;
};

export function NovoOrcamentoScreen() {
  const router = useRouter();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [skus, setSkus] = useState<EstoqueItemDto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [validoAte, setValidoAte] = useState("");
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState(1);
  const [descontoPct, setDescontoPct] = useState(0);
  const [linhas, setLinhas] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSku = skus.find((s) => s.id === skuId);
  const selectedCap = selectedSku?.desconto_max_pct ?? 0;

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
        setSkus(estoque.items.filter(skuIsActive));
      } catch {
        setClientes(buildClienteOptions({}));
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
        linhas: linhas.map(({ sku_id, qty: q, desconto_pct }) => ({
          sku_id,
          qty: q,
          desconto_pct,
        })),
      });
      router.push(`/saas/orcamentos/${orc.id}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.orcamento_novo}>
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/orcamentos" className="hover:text-gray-900">
          ← {COPY.orcamentos_title}
        </Link>
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.orcamento_novo}</CardTitle>
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
              <Input
                id="valido"
                type="date"
                value={validoAte}
                onChange={(e) => setValidoAte(e.target.value)}
              />
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
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" className="cursor-pointer bg-primary text-white hover:bg-primary/90" disabled={busy}>
              {COPY.criar_orcamento}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
