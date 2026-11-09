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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  createAppPainel,
  deleteAppPainel,
  listAppsPainel,
  patchAppPainel,
} from "../../crm/phase-e";
import type { CrmDashboardAppDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function AppsPainelScreen() {
  const [items, setItems] = useState<CrmDashboardAppDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmDashboardAppDto | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [apps, boxes] = await Promise.all([
        listAppsPainel(),
        apiGet("/api/saas/crm/inboxes").then((d) => asPage<CrmInboxDto>(d).items),
      ]);
      setItems(apps.items);
      setInboxes(boxes);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setEnabled(true);
    setOpen(true);
  }

  function openEdit(item: CrmDashboardAppDto) {
    setEditing(item);
    setEnabled(Boolean(item.enabled));
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const inboxRaw = String(fd.get("inbox_ids") || "").trim();
    const inbox_ids = inboxRaw
      ? inboxRaw
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    const body = {
      title: String(fd.get("title") || "").trim(),
      url: String(fd.get("url") || "").trim(),
      enabled,
      position: Number(fd.get("position") || 0),
      inbox_ids,
      inbox_ids_json: inbox_ids,
    };
    try {
      if (editing) {
        await patchAppPainel(editing.id, body);
      } else {
        await createAppPainel(body);
      }
      setOpen(false);
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteAppPainel(id);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.nav_apps_painel}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.apps_painel_create}
        </Button>
      }
    >
      <Alert className="mb-6">
        <AlertDescription>{COPY.crm.apps_painel_egress_note}</AlertDescription>
      </Alert>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.apps_painel_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.apps_painel_empty}
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => {
                  const ids = item.inbox_ids ?? item.inbox_ids_json;
                  return (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <Badge variant="outline">{item.enabled ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{item.url}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          posição {item.position}
                          {ids?.length
                            ? ` · caixas: ${ids
                                .map((id) => inboxes.find((i) => i.id === id)?.name ?? id.slice(0, 6))
                                .join(", ")}`
                            : " · todas as caixas"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onDelete(item.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar app" : COPY.crm.apps_painel_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="app_title">Título</Label>
              <Input
                id="app_title"
                name="title"
                className="mt-1"
                defaultValue={editing?.title ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="app_url">URL (https)</Label>
              <Input
                id="app_url"
                name="url"
                type="url"
                className="mt-1"
                defaultValue={editing?.url ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="app_pos">Posição</Label>
              <Input
                id="app_pos"
                name="position"
                type="number"
                className="mt-1"
                defaultValue={editing?.position ?? items.length}
              />
            </div>
            <div>
              <Label htmlFor="app_inboxes">IDs de caixas (opcional, vírgula)</Label>
              <Textarea
                id="app_inboxes"
                name="inbox_ids"
                className="mt-1"
                defaultValue={(editing?.inbox_ids ?? editing?.inbox_ids_json ?? []).join(", ")}
                placeholder="vazio = todas"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
              Ativo
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
