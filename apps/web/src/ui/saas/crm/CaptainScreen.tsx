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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  CAPTAIN_MODES,
  captainModeLabel,
  createCaptainAssistant,
  deleteCaptainAssistant,
  getCaptainStatus,
  listCaptainAssistants,
  patchCaptainAssistant,
} from "../../crm/phase-e";
import type { CrmCaptainAssistantDto, CrmCaptainStatusDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function CaptainScreen() {
  const [items, setItems] = useState<CrmCaptainAssistantDto[]>([]);
  const [providerStatus, setProviderStatus] = useState<CrmCaptainStatusDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCaptainAssistantDto | null>(null);
  const [mode, setMode] = useState<string>("copilot");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [list, st] = await Promise.all([
        listCaptainAssistants(),
        getCaptainStatus().catch(() => ({ provider: "stub", enabled: true })),
      ]);
      setItems(list.items);
      setProviderStatus(st);
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
    setMode("copilot");
    setActive(true);
    setOpen(true);
  }

  function openEdit(item: CrmCaptainAssistantDto) {
    setEditing(item);
    setMode(item.mode || "copilot");
    setActive(Boolean(item.active));
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || "").trim(),
      mode,
      system_prompt_stub: String(fd.get("system_prompt_stub") || "").trim() || null,
      active,
    };
    try {
      if (editing) {
        await patchCaptainAssistant(editing.id, body);
      } else {
        await createCaptainAssistant(body);
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
      await deleteCaptainAssistant(id);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.nav_captain}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.captain_create}
        </Button>
      }
    >
      <Alert className="mb-6">
        <AlertDescription>
          {COPY.crm.captain_stub_note} Provedor:{" "}
          <strong>{providerStatus?.provider ?? "stub"}</strong>
          {providerStatus?.enabled === false ? " (desabilitado)" : ""}.
        </AlertDescription>
      </Alert>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.captain_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.captain_empty}
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <Badge variant="outline">{captainModeLabel(item.mode)}</Badge>
                        <Badge variant="outline">{item.active ? "Ativo" : "Inativo"}</Badge>
                      </div>
                      {item.system_prompt_stub ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.system_prompt_stub}
                        </p>
                      ) : null}
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
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar assistente" : COPY.crm.captain_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="cap_name">Nome</Label>
              <Input
                id="cap_name"
                name="name"
                className="mt-1"
                defaultValue={editing?.name ?? ""}
                required
              />
            </div>
            <div>
              <Label>Modo</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTAIN_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {captainModeLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cap_prompt">Prompt (stub)</Label>
              <Textarea
                id="cap_prompt"
                name="system_prompt_stub"
                className="mt-1"
                defaultValue={editing?.system_prompt_stub ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
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
