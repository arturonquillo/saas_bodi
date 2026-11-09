"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type { CrmNotificationDto, CrmNotificationPrefsDto } from "../../crm/types";
import { formatDate } from "../../format";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

const DEFAULT_PREFS: CrmNotificationPrefsDto = {
  assigned: true,
  unassigned: true,
  participating: true,
  all: false,
};

export function NotificacoesScreen() {
  const [items, setItems] = useState<CrmNotificationDto[]>([]);
  const [prefs, setPrefs] = useState<CrmNotificationPrefsDto>(DEFAULT_PREFS);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmNotificationDto>(await apiGet("/api/saas/crm/notificacoes")).items);
      const p = await apiGet<CrmNotificationPrefsDto>(
        "/api/saas/crm/notificacoes/preferencias",
      ).catch(() => DEFAULT_PREFS);
      setPrefs({ ...DEFAULT_PREFS, ...p });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await apiSend(`/api/saas/crm/notificacoes/${id}/ler`, "POST");
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch {
      /* ignore */
    }
  }

  async function savePrefs() {
    setBusy(true);
    try {
      await apiSend("/api/saas/crm/notificacoes/preferencias", "PUT", prefs);
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.nav_notificacoes}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{COPY.crm.nav_notificacoes}</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {COPY.crm.notificacoes_empty}
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((n) => (
                    <li key={n.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={n.read_at ? "text-sm" : "text-sm font-medium"}>{n.title}</p>
                          {n.body ? (
                            <p className="text-xs text-muted-foreground">{n.body}</p>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(n.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {!n.read_at ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => void markRead(n.id)}>
                              Ler
                            </Button>
                          ) : null}
                          {n.conversation_id ? (
                            <Button type="button" size="sm" variant="link" asChild>
                              <Link href={`/saas/conversas/${n.conversation_id}`}>Abrir</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{COPY.crm.notificacoes_prefs}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["assigned", "Atribuídas a mim"],
                  ["unassigned", "Não atribuídas"],
                  ["participating", "Participando"],
                  ["all", "Todas"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={prefs[key]}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: Boolean(v) }))}
                  />
                  {label}
                </label>
              ))}
              <Button type="button" disabled={busy} onClick={() => void savePrefs()}>
                {COPY.actions.salvar}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </SaasPage>
  );
}
