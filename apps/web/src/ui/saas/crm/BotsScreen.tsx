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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type { CrmBotDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function BotsScreen() {
  const [items, setItems] = useState<CrmBotDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmBotDto | null>(null);
  const [inboxIds, setInboxIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const bots = asPage<CrmBotDto>(await apiGet("/api/saas/crm/bots")).items;
      const withInboxes = await Promise.all(
        bots.map(async (b) => {
          try {
            const linked = await apiGet<{ inbox_ids?: string[] } | string[]>(
              `/api/saas/crm/bots/${b.id}/inboxes`,
            );
            const ids = Array.isArray(linked) ? linked : (linked.inbox_ids ?? []);
            return { ...b, inbox_ids: ids };
          } catch {
            return b;
          }
        }),
      );
      setItems(withInboxes);
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
    setInboxIds([]);
    setActive(true);
    setCreatedToken(null);
    setOpen(true);
  }

  function openEdit(bot: CrmBotDto) {
    setEditing(bot);
    setInboxIds(bot.inbox_ids ?? []);
    setActive(Boolean(bot.active));
    setCreatedToken(null);
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      description: fd.get("description") || null,
      outgoing_url: fd.get("outgoing_url"),
      active,
    };
    try {
      if (editing && !createdToken) {
        await apiSend(`/api/saas/crm/bots/${editing.id}`, "PATCH", body);
        await apiSend(`/api/saas/crm/bots/${editing.id}/inboxes`, "PUT", {
          inbox_ids: inboxIds,
        });
        setOpen(false);
      } else {
        const created = await apiSend<CrmBotDto>("/api/saas/crm/bots", "POST", body);
        await apiSend(`/api/saas/crm/bots/${created.id}/inboxes`, "PUT", {
          inbox_ids: inboxIds,
        });
        if (created.token_revealed && created.token) {
          setCreatedToken(created.token);
        } else {
          setOpen(false);
        }
      }
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiSend(`/api/saas/crm/bots/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.bots_title}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.bot_create}
        </Button>
      }
    >
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.crm.bots_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.bots_empty}</h3>
                <Button type="button" onClick={openCreate}>
                  {COPY.crm.bot_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((bot) => (
                  <li key={bot.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{bot.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{bot.outgoing_url}</p>
                      <p className="text-xs text-muted-foreground">
                        {(bot.inbox_ids ?? []).length} caixa(s) · token {bot.token || "••••"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={bot.active ? "default" : "secondary"}>
                        {bot.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(bot)}>
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(bot.id)}>
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setCreatedToken(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar bot" : COPY.crm.bot_create}</DialogTitle>
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>{COPY.crm.bot_token_once}</AlertDescription>
              </Alert>
              <Input readOnly value={createdToken} className="font-mono text-xs" />
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setCreatedToken(null);
                    setEditing(null);
                  }}
                >
                  {COPY.actions.fechar}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={onSave}>
              <div>
                <Label htmlFor="bot-name">{COPY.nome}</Label>
                <Input
                  id="bot-name"
                  name="name"
                  required
                  className="mt-1"
                  defaultValue={editing?.name ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="bot-url">URL de saída (https)</Label>
                <Input
                  id="bot-url"
                  name="outgoing_url"
                  type="url"
                  required
                  className="mt-1"
                  placeholder="https://"
                  defaultValue={editing?.outgoing_url ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="bot-desc">Descrição</Label>
                <Textarea
                  id="bot-desc"
                  name="description"
                  className="mt-1"
                  rows={2}
                  defaultValue={editing?.description ?? ""}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
                Ativo
              </label>
              <div>
                <Label className="mb-2 block">Caixas (máx. 1 bot por caixa)</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {inboxes.map((inbox) => (
                    <label key={inbox.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={inboxIds.includes(inbox.id)}
                        onCheckedChange={(v) => {
                          setInboxIds((prev) =>
                            v
                              ? [...prev.filter((x) => x !== inbox.id), inbox.id]
                              : prev.filter((x) => x !== inbox.id),
                          );
                        }}
                      />
                      {inbox.name}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button type="submit" disabled={busy}>
                  {COPY.actions.salvar}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
