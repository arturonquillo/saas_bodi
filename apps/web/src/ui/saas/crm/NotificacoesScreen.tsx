"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type {
  CrmNotificationDto,
  CrmNotificationPrefsDto,
  CrmPushSubscriptionDto,
} from "../../crm/types";
import { formatDate } from "../../format";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

const DEFAULT_PREFS: CrmNotificationPrefsDto = {
  assigned: true,
  unassigned_conversation: true,
  conversation_activity: true,
  email_enabled: false,
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificacoesScreen() {
  const [items, setItems] = useState<CrmNotificationDto[]>([]);
  const [prefs, setPrefs] = useState<CrmNotificationPrefsDto>(DEFAULT_PREFS);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [vapidPublic, setVapidPublic] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<"unknown" | "ready" | "unavailable" | "unsupported">(
    "unknown",
  );
  const [pushSubId, setPushSubId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmNotificationDto>(await apiGet("/api/saas/crm/notificacoes")).items);
      const p = await apiGet<CrmNotificationPrefsDto>(
        "/api/saas/crm/notificacoes/preferencias",
      ).catch(() => DEFAULT_PREFS);
      setPrefs({ ...DEFAULT_PREFS, ...p });
      try {
        const vapid = await apiGet<{ public_key: string }>("/api/saas/crm/push/vapid-public");
        setVapidPublic(vapid.public_key);
        setPushStatus(
          typeof window !== "undefined" && "PushManager" in window ? "ready" : "unsupported",
        );
      } catch {
        setVapidPublic(null);
        setPushStatus(
          typeof window !== "undefined" && "PushManager" in window ? "unavailable" : "unsupported",
        );
      }
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

  async function enablePush() {
    if (!vapidPublic || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error(COPY.crm.push_unsupported);
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(COPY.crm.push_disabled);
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw-push.js").catch(() => null));
      if (!reg) {
        toast.error(COPY.crm.push_unavailable);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
      const json = sub.toJSON();
      const created = await apiSend<CrmPushSubscriptionDto>("/api/saas/crm/push/subscriptions", "POST", {
        endpoint: json.endpoint,
        keys: json.keys,
      });
      setPushSubId(created.id);
      toast.success(COPY.crm.push_enabled);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!pushSubId) {
      toast.success(COPY.crm.push_disabled);
      return;
    }
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/push/subscriptions/${pushSubId}`, "DELETE");
      setPushSubId(null);
      toast.success(COPY.crm.push_disabled);
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.notificacoes_prefs}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  [
                    ["assigned", "Atribuídas a mim"],
                    ["unassigned_conversation", "Não atribuídas"],
                    ["conversation_activity", "Participando"],
                    ["email_enabled", "E-mail (stub)"],
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

            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.push_title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pushStatus === "unavailable" ? (
                  <Alert>
                    <AlertDescription>{COPY.crm.push_unavailable}</AlertDescription>
                  </Alert>
                ) : null}
                {pushStatus === "unsupported" ? (
                  <Alert>
                    <AlertDescription>{COPY.crm.push_unsupported}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy || pushStatus !== "ready"}
                    onClick={() => void enablePush()}
                  >
                    {COPY.crm.push_enable}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !pushSubId}
                    onClick={() => void disablePush()}
                  >
                    Desativar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </SaasPage>
  );
}
