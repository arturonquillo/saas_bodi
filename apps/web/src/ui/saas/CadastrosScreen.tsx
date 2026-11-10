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
import { DetailNavButton } from "../DetailNavRow";
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
    <SaasPage title={COPY.cadastros_title} description={COPY.cadastros_page_desc}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle>{COPY.cadastros_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState
                title={COPY.cadastros_empty}
                body={COPY.cadastros_empty_body}
                art="pedidos"
              />
            ) : (
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id}>
                    <DetailNavButton
                      className="rounded-md px-2 py-2"
                      onClick={() => router.push(`/saas/cadastros/${c.id}`)}
                      meta={
                        <>
                          <CadastroStatusBadge status={c.status} />
                          <span className="text-sm text-muted-foreground">{c.source}</span>
                          <span className="text-sm text-muted-foreground">{formatDate(c.updated_at)}</span>
                        </>
                      }
                    >
                      <p className="font-medium text-foreground">{c.razao_social}</p>
                      <p className="text-sm text-muted-foreground">{maskFromLast4(c.cnpj_last4)}</p>
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
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/saas/cadastros" className="cursor-pointer hover:text-foreground hover:underline">
          ← {COPY.cadastros_title}
        </Link>
      </p>

      <Card className="mb-8 shadow-sm">
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{COPY.cnpj}: </span>
            <span className="text-foreground">{maskFromLast4(item.cnpj_last4)}</span>
          </p>
          {item.cnpj_registro_pendente ? (
            <p className="inline-flex rounded-md border border-[var(--color-warning)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
              {COPY.registry_pending_badge}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">{COPY.contato}: </span>
            <span className="text-foreground">{item.contato_nome}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.email}: </span>
            <span className="text-foreground">{item.email}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.whatsapp}: </span>
            <span className="text-foreground">{item.whatsapp}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Origem: </span>
            <span className="text-foreground">{item.source}</span>
          </p>
          {item.motivo_recusa ? (
            <p>
              <span className="text-muted-foreground">{COPY.refuse_reason}: </span>
              <span className="text-foreground">{item.motivo_recusa}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {item.status === "pendente" ? (
        <Card className="mb-8 shadow-sm">
          <CardHeader className="border-b border-border bg-muted/40">
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
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
              <div className="space-y-3 rounded-md border border-border bg-card p-4 shadow-sm">
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
