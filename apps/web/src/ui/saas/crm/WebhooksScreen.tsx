"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { AUTOMATION_EVENTS, eventLabel } from "../../crm/phase-b";
import type { CrmInboxDto, CrmWebhookDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function WebhooksScreen() {
  const [items, setItems] = useState<CrmWebhookDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmWebhookDto | null>(null);
  const [subs, setSubs] = useState<string[]>(["message_created"]);
  const [active, setActive] = useState(true);
  const [inboxId, setInboxId] = useState<string>("account");
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmWebhookDto>(await apiGet("/api/saas/crm/webhooks")).items);
      setInboxes(asPage<CrmInboxDto>(await apiGet("/api/saas/crm/inboxes")).items);
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
    setSubs(["message_created"]);
    setActive(true);
    setInboxId("account");
    setOpen(true);
  }

  function openEdit(item: CrmWebhookDto) {
    setEditing(item);
    setSubs(item.subscriptions?.length ? item.subscriptions : ["message_created"]);
    setActive(Boolean(item.active));
    setInboxId(item.inbox_id || "account");
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") || null,
      url: fd.get("url"),
      subscriptions: subs,
      inbox_id: inboxId === "account" ? null : inboxId,
      active,
    };
    try {
      if (editing) {
        await apiSend(`/api/saas/crm/webhooks/${editing.id}`, "PATCH", body);
      } else {
        await apiSend("/api/saas/crm/webhooks", "POST", body);
      }
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiSend(`/api/saas/crm/webhooks/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function onTest(id: string) {
    try {
      await apiSend(`/api/saas/crm/webhooks/${id}/testar`, "POST");
      toast.success("Entrega de teste enfileirada.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function onRotate() {
    try {
      const res = await apiSend<{ secret?: string; webhook_signing_secret?: string }>(
        "/api/saas/crm/webhooks/segredo/rotacionar",
        "POST",
      );
      setRotatedSecret(res.secret ?? res.webhook_signing_secret ?? null);
      toast.success(COPY.crm.webhook_rotate_secret);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.webhooks_title}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void onRotate()}>
            {COPY.crm.webhook_rotate_secret}
          </Button>
          <Button type="button" onClick={openCreate}>
            {COPY.crm.webhook_create}
          </Button>
        </div>
      }
    >
      {rotatedSecret ? (
        <Alert className="mb-4">
          <AlertDescription>
            Novo segredo (exibido uma vez):{" "}
            <code className="break-all font-mono text-xs">{rotatedSecret}</code>
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.crm.webhooks_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.webhooks_empty}</h3>
                <Button type="button" onClick={openCreate}>
                  {COPY.crm.webhook_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name || item.url}</p>
                      <p className="truncate text-sm text-muted-foreground">{item.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.inbox_id ? `Caixa ${item.inbox_id}` : "Conta"} ·{" "}
                        {(item.subscriptions ?? []).length} evento(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onTest(item.id)}>
                        {COPY.crm.webhook_test}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(item.id)}>
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar webhook" : COPY.crm.webhook_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onSave}>
            <div>
              <Label htmlFor="wh-name">{COPY.nome}</Label>
              <Input id="wh-name" name="name" className="mt-1" defaultValue={editing?.name ?? ""} />
            </div>
            <div>
              <Label htmlFor="wh-url">URL (https)</Label>
              <Input
                id="wh-url"
                name="url"
                type="url"
                required
                className="mt-1"
                placeholder="https://"
                defaultValue={editing?.url ?? ""}
              />
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={inboxId} onValueChange={setInboxId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Conta inteira</SelectItem>
                  {inboxes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Eventos</Label>
              <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {AUTOMATION_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={subs.includes(ev)}
                      onCheckedChange={(v) =>
                        setSubs((prev) =>
                          v ? [...prev.filter((x) => x !== ev), ev] : prev.filter((x) => x !== ev),
                        )
                      }
                    />
                    {eventLabel(ev)}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
              Ativo
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy || subs.length === 0}>
                {COPY.actions.salvar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
