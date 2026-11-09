"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CadastroStatus } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiGet, apiSend, asPage, isApiError, maskFromLast4, type CadastroDto } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { SaasPage } from "../layout";
import { CadastroStatusBadge, NotifyAlert } from "../order-ui";
import { ErrorState, FormSkeleton, TableSkeleton } from "../states";

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
    <SaasPage title={COPY.cadastros_title}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.cadastros_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.cadastros_empty}</h3>
                <p className="max-w-sm text-sm text-gray-500">
                  Solicitações de cadastro da loja ou do WhatsApp aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/saas/cadastros/${c.id}`)}
                    >
                      <p className="font-medium text-gray-900">{c.razao_social}</p>
                      <p className="text-sm text-gray-500">{maskFromLast4(c.cnpj_last4)}</p>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                      <CadastroStatusBadge status={c.status} />
                      <span className="text-gray-500">{c.source}</span>
                      <span className="text-gray-500">{formatDate(c.updated_at)}</span>
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
      <SaasPage title={COPY.cadastros_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.cadastros_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={item.razao_social}
      actions={<CadastroStatusBadge status={item.status} />}
    >
      <p className="mb-6 text-sm text-gray-500">
        <Link href="/saas/cadastros" className="hover:text-gray-900">
          ← {COPY.cadastros_title}
        </Link>
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-gray-500">{COPY.cnpj}: </span>
            <span className="text-gray-900">{maskFromLast4(item.cnpj_last4)}</span>
          </p>
          {item.cnpj_registro_pendente ? (
            <p className="inline-flex rounded-md border border-[var(--color-warning)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
              {COPY.registry_pending_badge}
            </p>
          ) : null}
          <p>
            <span className="text-gray-500">{COPY.contato}: </span>
            <span className="text-gray-900">{item.contato_nome}</span>
          </p>
          <p>
            <span className="text-gray-500">{COPY.email}: </span>
            <span className="text-gray-900">{item.email}</span>
          </p>
          <p>
            <span className="text-gray-500">{COPY.whatsapp}: </span>
            <span className="text-gray-900">{item.whatsapp}</span>
          </p>
          <p>
            <span className="text-gray-500">Origem: </span>
            <span className="text-gray-900">{item.source}</span>
          </p>
          {item.motivo_recusa ? (
            <p>
              <span className="text-gray-500">{COPY.refuse_reason}: </span>
              <span className="text-gray-900">{item.motivo_recusa}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {item.status === "pendente" ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-primary text-white hover:bg-primary/90"
                disabled={busy}
                onClick={() => void transition("aprovado")}
              >
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
              <div className="space-y-3 rounded-md border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{COPY.refuse_reason_required}</p>
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
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {notified ? <NotifyAlert canais="whatsapp" /> : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
          {notified ? <NotifyAlert canais="whatsapp" /> : null}
        </>
      )}
    </SaasPage>
  );
}
