"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { OrcamentoStatus } from "@saas-frota/shared";
import type { OrcamentoDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiSend, docTotal, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDate, formatMoney } from "../format";
import { StoreMain } from "../layout";
import { MoneyCell, OrcamentoStatusBadge } from "../order-ui";
import { useSession } from "../session";
import { ErrorState, FormSkeleton, GateBanner } from "../states";

export function OrcamentoDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { status: sessStatus, session } = useSession();
  const router = useRouter();
  const [item, setItem] = useState<OrcamentoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<OrcamentoDto>(`/api/loja/orcamentos/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    if (sessStatus === "guest") {
      router.replace(`/loja/entrar?return=${encodeURIComponent(`/loja/orcamentos/${id}`)}`);
      return;
    }
    if (sessStatus === "auth") void load();
  }, [sessStatus, load, router, id]);

  async function transition(para: Extract<OrcamentoStatus, "aceito" | "recusado">) {
    setBusy(true);
    setError(null);
    setGate(false);
    try {
      const next = await apiSend<OrcamentoDto>(`/api/loja/orcamentos/${id}/transicao`, "POST", { para });
      setItem(next);
      if (para === "aceito" && next.pedido_id) {
        router.push(`/loja/pedidos/${next.pedido_id}`);
      }
    } catch (err) {
      if (isApiError(err) && err.code === "cadastro_nao_aprovado") setGate(true);
      else setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (sessStatus === "loading" || status === "loading") {
    return (
      <StoreMain>
        <FormSkeleton />
      </StoreMain>
    );
  }
  if (status === "error" || !item) {
    return (
      <StoreMain>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </StoreMain>
    );
  }

  const canAct = item.status === "enviado";
  const aprovado = session?.cliente_status === "aprovado";

  return (
    <StoreMain>
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/loja/meus-docs" className="hover:text-primary">
          {COPY.nav_meus_docs}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.id}</span>
      </p>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{item.id}</h1>
        <OrcamentoStatusBadge status={item.status} large />
      </div>

      {item.status === "expirado" ? (
        <p className="mb-4 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm">
          {COPY.orcamento_expired}
        </p>
      ) : null}

      {gate || (canAct && !aprovado) ? (
        <div className="mb-4">
          <GateBanner />
        </div>
      ) : null}

      {canAct && aprovado ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void transition("aceito")}>
            {COPY.orcamento_aceitar}
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void transition("recusado")}>
            {COPY.orcamento_recusar}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            <li className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Item</span>
              <span>Qtd</span>
              <span>Preço</span>
            </li>
            {item.linhas.map((l) => (
              <li key={l.id} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
                <span>{l.nome}</span>
                <span>{l.qty}</span>
                <span>{formatMoney(l.unit_price_centavos)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="mb-4 font-semibold">
        Total: <MoneyCell centavos={docTotal(item.linhas ?? [])} />
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {item.historico.map((h, i) => (
          <li key={`${h.to}-${i}`}>
            {h.from ?? "—"} → {h.to} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </StoreMain>
  );
}
