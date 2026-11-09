"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiSend, asPage, isApiError, type EstoqueItemDto } from "../api";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { ListHeader, SaasMain } from "../layout";
import { useSession } from "../session";
import { EmptyState, ErrorState, FormSkeleton, TableSkeleton } from "../states";

export function EstoqueListScreen() {
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [items, setItems] = useState<EstoqueItemDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<EstoqueItemDto>(await apiGet("/api/saas/estoque")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleVisibility(item: EstoqueItemDto, visivel_loja: boolean) {
    if (!admin) return;
    const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${item.id}/visibilidade`, "PATCH", {
      visivel_loja,
    });
    setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)));
  }

  return (
    <SaasMain>
      <ListHeader title={COPY.estoque_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.estoque_empty} art="warehouse" />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/saas/estoque/${item.id}`)}
                  >
                    <p className="font-medium text-primary">
                      <Link href={`/saas/estoque/${item.id}`} className="hover:underline">
                        {item.codigo}
                      </Link>
                    </p>
                    <p className="text-sm">{item.nome}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {COPY.on_hand}: {item.on_hand} · {COPY.reserved}: {item.reserved} · {COPY.available}:{" "}
                      {item.available} · {formatMoney(item.preco_atacado_centavos)}
                    </p>
                  </button>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={item.visivel_loja}
                      disabled={!admin}
                      onChange={(e) => void toggleVisibility(item, e.target.checked)}
                      aria-label={COPY.visivel_loja}
                    />
                    <span className="text-muted-foreground">{COPY.visivel_loja}</span>
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </SaasMain>
  );
}

export function SkuDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [item, setItem] = useState<EstoqueItemDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [delta, setDelta] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<EstoqueItemDto>(`/api/saas/estoque/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${id}/ajuste`, "POST", {
        delta_on_hand: Number(delta),
        motivo,
      });
      setItem(next);
      setOpen(false);
      setDelta("0");
      setMotivo("");
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

  return (
    <SaasMain>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/saas/estoque" className="hover:text-primary">
          {COPY.estoque_title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.codigo}</span>
      </p>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{item.nome}</h1>
          <p className="text-sm text-muted-foreground">{item.codigo}</p>
        </div>
        {admin ? (
          <Button type="button" onClick={() => setOpen((o) => !o)}>
            {COPY.adjust_qty}
          </Button>
        ) : null}
      </div>

      {open ? (
        <Card className="mb-4 gap-0 py-0">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label htmlFor="delta" className="mb-2">
                Delta
              </Label>
              <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="motivo" className="mb-2">
                {COPY.motivo}
              </Label>
              <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void adjust()}>
                {COPY.actions.confirmar}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{COPY.on_hand}</p>
            <p className="text-lg font-semibold tabular-nums">{item.on_hand}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{COPY.reserved}</p>
            <p className="text-lg font-semibold tabular-nums">{item.reserved}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{COPY.available}</p>
            <p className="text-lg font-semibold tabular-nums text-primary">{item.available}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 py-0">
        <CardContent className="space-y-2 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">{COPY.price_atacado}: </span>
            {formatMoney(item.preco_atacado_centavos)}
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.moq(item.qtd_min_atacado)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.visivel_loja}: </span>
            {item.visivel_loja ? "Sim" : "Não"}
          </p>
        </CardContent>
      </Card>

      {!admin ? <p className="mt-4 text-sm text-muted-foreground">Somente leitura para vendedor.</p> : null}
    </SaasMain>
  );
}
