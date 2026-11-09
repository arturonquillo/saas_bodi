"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PedidoStatus } from "@saas-frota/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DeskWrap, ListHeader, SaasMain } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  PedidoStatusBadge,
  PedidoStatusTrail,
  legalPedidoTargets,
  pedidoTransitionLabel,
} from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

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
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/saas/pedidos/${p.id}`)}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell>{p.cliente_id}</TableCell>
                  <TableCell>
                    <PedidoStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <MoneyCell centavos={docTotal(p.linhas)} />
                  </TableCell>
                  <TableCell>{formatDate(p.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DeskWrap>
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
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/saas/pedidos">{COPY.pedidos_title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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

      {error ? (
        <Alert className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notified ? (
        <div className="mb-3">
          <NotifyAlert canais="whatsapp" />
        </div>
      ) : null}

      <DeskWrap className="mb-4 space-y-1 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{COPY.customer}: </span>
          {item.cliente_id}
        </p>
        <p>
          <span className="text-muted-foreground">Canal: </span>
          {item.channel}
        </p>
      </DeskWrap>

      <h2 className="mb-2 text-sm font-semibold">{COPY.section_items}</h2>
      <DeskWrap className="mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {item.linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.codigo}</TableCell>
                <TableCell>{l.nome}</TableCell>
                <TableCell>{l.qty}</TableCell>
                <TableCell>{formatMoney(l.unit_price_centavos)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DeskWrap>
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

      <AlertDialog open={!!confirmTo} onOpenChange={(o) => !o && setConfirmTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTo === "despachado" ? COPY.to_despachado : COPY.cancel_pedido}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTo === "despachado" ? COPY.confirm_dispatch : COPY.cancel_confirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{COPY.actions.cancelar}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTo && void runTransition(confirmTo)}>
              {COPY.actions.confirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <Field>
          <FieldLabel>{COPY.customer}</FieldLabel>
          <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.cliente_id!} value={c.cliente_id!}>
                  {c.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-[220px] flex-1">
            <FieldLabel>SKU</FieldLabel>
            <Select value={skuId || "none"} onValueChange={(v) => setSkuId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="SKU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {skus.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo} · {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="qty">{COPY.qty}</FieldLabel>
            <Input id="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="w-24" />
          </Field>
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setLinhas((p) => p.filter((_, j) => j !== i))}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {gate ? <GateBanner message={COPY.gate_not_approved} /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {COPY.criar_pedido}
        </Button>
      </form>
    </SaasMain>
  );
}
