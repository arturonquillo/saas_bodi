"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CadastroStatus } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiGet, apiSend, asPage, isApiError, maskFromLast4, type CadastroDto } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { ListHeader, SaasMain } from "../layout";
import { CadastroStatusBadge, NotifyAlert } from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, TableSkeleton } from "../states";

const textareaClass =
  "border-input placeholder:text-muted-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function CadastrosListScreen() {
  const [items, setItems] = useState<CadastroDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CadastroDto>(await apiGet("/api/saas/cadastros")).items);
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
      <ListHeader title={COPY.cadastros_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.cadastros_empty} />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => router.push(`/saas/cadastros/${c.id}`)}
                  >
                    <div>
                      <p className="font-medium">{c.razao_social}</p>
                      <p className="text-sm text-muted-foreground">{maskFromLast4(c.cnpj_last4)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <CadastroStatusBadge status={c.status} />
                      <span className="text-muted-foreground">{c.source}</span>
                      <span className="text-muted-foreground">{formatDate(c.updated_at)}</span>
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

export function CadastroDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<CadastroDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<CadastroDto>(`/api/saas/cadastros/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(para: CadastroStatus) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CadastroDto>(`/api/saas/cadastros/${id}/transicao`, "POST", {
        para,
        motivo_recusa: para === "recusado" ? motivo : undefined,
      });
      setItem(next);
      setNotified(true);
      setRefuseOpen(false);
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
        <Link href="/saas/cadastros" className="hover:text-primary">
          {COPY.cadastros_title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{item.razao_social}</span>
      </p>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{item.razao_social}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{maskFromLast4(item.cnpj_last4)}</p>
        </div>
        <CadastroStatusBadge status={item.status} />
      </div>

      {item.cnpj_registro_pendente ? (
        <p className="mb-3 inline-flex rounded-md border border-[var(--color-warning)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
          {COPY.registry_pending_badge}
        </p>
      ) : null}

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="space-y-2 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">{COPY.contato}: </span>
            {item.contato_nome}
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.email}: </span>
            {item.email}
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.whatsapp}: </span>
            {item.whatsapp}
          </p>
          <p>
            <span className="text-muted-foreground">Origem: </span>
            {item.source}
          </p>
          {item.motivo_recusa ? (
            <p>
              <span className="text-muted-foreground">{COPY.refuse_reason}: </span>
              {item.motivo_recusa}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {item.status === "pendente" ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void transition("aprovado")}>
              {COPY.approve}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => setRefuseOpen((o) => !o)}
            >
              {COPY.refuse}
            </Button>
          </div>
          {refuseOpen ? (
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">{COPY.refuse_reason_required}</p>
                <div>
                  <Label htmlFor="motivo" className="mb-2">
                    {COPY.refuse_reason}
                  </Label>
                  <textarea
                    id="motivo"
                    className={textareaClass}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setRefuseOpen(false)}>
                    {COPY.actions.cancelar}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!motivo.trim() || busy}
                    onClick={() => void transition("recusado")}
                  >
                    {COPY.refuse}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      {notified ? <NotifyAlert canais="whatsapp" /> : null}
    </SaasMain>
  );
}
