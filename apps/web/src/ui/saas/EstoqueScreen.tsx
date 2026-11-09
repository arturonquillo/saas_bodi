"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiSend, asPage, isApiError, type EstoqueItemDto } from "../api";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { SaasPage } from "../layout";
import { useSession } from "../session";
import { ErrorState, FormSkeleton, TableSkeleton } from "../states";

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
    <SaasPage title={COPY.estoque_title}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.estoque_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.estoque_empty}</h3>
                <p className="max-w-sm text-sm text-gray-500">
                  SKUs cadastrados no estoque aparecerão nesta lista.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/saas/estoque/${item.id}`)}
                    >
                      <p className="font-medium text-gray-900">{item.codigo}</p>
                      <p className="text-sm text-gray-500">{item.nome}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {COPY.on_hand}: {item.on_hand} · {COPY.reserved}: {item.reserved} · {COPY.available}:{" "}
                        {item.available} · {formatMoney(item.preco_atacado_centavos)}
                      </p>
                    </button>
                    <label className="inline-flex shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-gray-200"
                        checked={item.visivel_loja}
                        disabled={!admin}
                        onChange={(e) => void toggleVisibility(item, e.target.checked)}
                        aria-label={COPY.visivel_loja}
                      />
                      <span className="text-gray-500">{COPY.visivel_loja}</span>
                    </label>
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
      <SaasPage title={COPY.estoque_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.estoque_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={item.nome}
      actions={
        admin ? (
          <Button
            type="button"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => setOpen((o) => !o)}
          >
            {COPY.adjust_qty}
          </Button>
        ) : null
      }
    >
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/estoque" className="hover:text-gray-900">
          ← {COPY.estoque_title}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-gray-900">{item.codigo}</span>
      </p>

      {open ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.adjust_qty}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void adjust();
              }}
            >
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
                <Button type="submit" className="bg-primary text-white hover:bg-primary/90" disabled={busy}>
                  {COPY.actions.confirmar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quantidades</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            <li className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{COPY.on_hand}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900">{item.on_hand}</p>
            </li>
            <li className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{COPY.reserved}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900">{item.reserved}</p>
            </li>
            <li className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{COPY.available}</p>
              <p className="text-lg font-semibold tabular-nums text-primary">{item.available}</p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-gray-500">{COPY.price_atacado}: </span>
            <span className="text-gray-900">{formatMoney(item.preco_atacado_centavos)}</span>
          </p>
          <p className="text-gray-500">{COPY.moq(item.qtd_min_atacado)}</p>
          <p>
            <span className="text-gray-500">{COPY.visivel_loja}: </span>
            <span className="text-gray-900">{item.visivel_loja ? "Sim" : "Não"}</span>
          </p>
          {!admin ? <p className="text-gray-500">Somente leitura para vendedor.</p> : null}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
