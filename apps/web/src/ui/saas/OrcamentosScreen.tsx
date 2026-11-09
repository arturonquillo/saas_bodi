"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { OrcamentoStatus } from "@saas-frota/shared";
import type { OrcamentoDto } from "../api";
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
import { DeskWrap, ListHeader, SaasMain } from "../layout";
import {
  MoneyCell,
  NotifyAlert,
  OrcamentoStatusBadge,
  legalOrcamentoTargets,
  orcamentoTransitionLabel,
} from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

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
              {items.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/saas/orcamentos/${o.id}`)}
                >
                  <TableCell className="font-medium">{o.id}</TableCell>
                  <TableCell>{clienteDisplay(o)}</TableCell>
                  <TableCell>
                    <OrcamentoStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell>
                    <MoneyCell centavos={docTotal(o.linhas ?? [])} />
                  </TableCell>
                  <TableCell>{formatDate(o.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DeskWrap>
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
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/saas/orcamentos">{COPY.orcamentos_title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">{item.id}</h1>
        <OrcamentoStatusBadge status={item.status} large />
      </div>

      {item.status === "expirado" ? (
        <Alert className="mb-3 border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10">
          <AlertDescription>{COPY.orcamento_expired}</AlertDescription>
        </Alert>
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

      {gate ? <div className="mb-3"><GateBanner message={COPY.gate_not_approved} /></div> : null}
      {error ? (
        <Alert className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notified ? <div className="mb-3"><NotifyAlert canais="whatsapp" /></div> : null}

      <DeskWrap className="mb-4 space-y-1 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{COPY.customer}: </span>
          {clienteDisplay(item)}
        </p>
        <p>
          <span className="text-muted-foreground">{COPY.valido_ate}: </span>
          {formatDateOnly(item.valido_ate)}
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
            {linhas.map((l) => (
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
        <Field>
          <FieldLabel>{COPY.customer}</FieldLabel>
          <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Prospecto (sem cliente)</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="valido">{COPY.valido_ate}</FieldLabel>
          <Input id="valido" type="date" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
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
            <Input
              id="qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className="w-24"
            />
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {COPY.criar_orcamento}
        </Button>
      </form>
    </SaasMain>
  );
}
