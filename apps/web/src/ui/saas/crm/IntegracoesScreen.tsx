"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  INTEGRATION_PROVIDERS,
  connectionStatusLabel,
  disconnectIntegracao,
  integrationProviderLabel,
  listIntegracoes,
  putIntegracao,
  testIntegracao,
} from "../../crm/phase-e";
import type { CrmIntegrationInstallDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function statusClass(status: string) {
  if (status === "connected_stub" || status === "ready_stub") return "border-emerald-300 text-emerald-800";
  if (status === "credentials_saved") return "border-amber-300 text-amber-800";
  if (status === "live") return "border-red-300 text-red-800";
  return "";
}

export function IntegracoesScreen() {
  const [items, setItems] = useState<CrmIntegrationInstallDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await listIntegracoes();
      const byProvider = new Map(page.items.map((i) => [i.provider, i]));
      const merged = INTEGRATION_PROVIDERS.map(
        (provider) =>
          byProvider.get(provider) ??
          ({
            provider,
            connection_status: "not_configured",
            secrets_present: false,
          } satisfies CrmIntegrationInstallDto),
      );
      setItems(merged);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      connection_status: "connected_stub",
      metadata: {
        workspace_or_project: String(fd.get("workspace_or_project") || "").trim() || null,
      },
    };
    const secret = String(fd.get("secret") || "").trim();
    if (secret) body.secret = secret;
    try {
      await putIntegracao(editing, body);
      setEditing(null);
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(provider: string) {
    setBusy(true);
    try {
      await disconnectIntegracao(provider);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onTest(provider: string) {
    setBusy(true);
    try {
      const res = await testIntegracao(provider);
      toast.success(res.message || "Stub OK");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.nav_integracoes}>
      <Alert className="mb-6">
        <AlertDescription>{COPY.crm.integracoes_stub_note}</AlertDescription>
      </Alert>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.integracoes_title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.provider} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {integrationProviderLabel(item.provider)}
                    </p>
                    <Badge variant="outline" className={statusClass(item.connection_status)}>
                      {connectionStatusLabel(item.connection_status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(item.provider)}
                    >
                      Configurar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || item.connection_status === "not_configured"}
                      onClick={() => void onTest(item.provider)}
                    >
                      Testar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || item.connection_status === "not_configured"}
                      onClick={() => void onDisconnect(item.provider)}
                    >
                      Desconectar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? integrationProviderLabel(editing) : COPY.crm.integracoes_title}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="workspace">Workspace / projeto (metadata)</Label>
              <Input id="workspace" name="workspace_or_project" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="secret">Segredo / token</Label>
              <Input id="secret" name="secret" type="password" className="mt-1" />
            </div>
            <p className="text-sm text-muted-foreground">
              Status máximo: connected_stub. Live é rejeitado.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy}>
                {COPY.actions.salvar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
