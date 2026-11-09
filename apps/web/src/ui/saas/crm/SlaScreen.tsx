"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  createSlaPolicy,
  deleteSlaPolicy,
  listSlaPolicies,
  patchSlaPolicy,
  putInboxSla,
  secondsToLabel,
} from "../../crm/phase-e";
import type { CrmInboxDto, CrmSlaPolicyDto } from "../../crm/types";
import { apiGet } from "../../api";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function SlaScreen() {
  const [items, setItems] = useState<CrmSlaPolicyDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmSlaPolicyDto | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inboxId, setInboxId] = useState("");
  const [inboxPolicyId, setInboxPolicyId] = useState<string>("none");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [policies, boxes] = await Promise.all([
        listSlaPolicies(),
        apiGet("/api/saas/crm/inboxes").then((d) => asPage<CrmInboxDto>(d).items),
      ]);
      setItems(policies.items);
      setInboxes(boxes);
      if (!inboxId && boxes[0]) {
        setInboxId(boxes[0].id);
        setInboxPolicyId(boxes[0].default_sla_policy_id ?? "none");
      }
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [inboxId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const box = inboxes.find((i) => i.id === inboxId);
    if (box) setInboxPolicyId(box.default_sla_policy_id ?? "none");
  }, [inboxId, inboxes]);

  function openCreate() {
    setEditing(null);
    setActive(true);
    setOpen(true);
  }

  function openEdit(item: CrmSlaPolicyDto) {
    setEditing(item);
    setActive(Boolean(item.active));
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || "").trim(),
      frt_seconds: Number(fd.get("frt_seconds") || 0),
      nrt_seconds: Number(fd.get("nrt_seconds") || 0),
      rt_seconds: Number(fd.get("rt_seconds") || 0),
      description: String(fd.get("description") || "").trim() || null,
      active,
    };
    try {
      if (editing) {
        await patchSlaPolicy(editing.id, body);
      } else {
        await createSlaPolicy(body);
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
      await deleteSlaPolicy(id);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function saveInboxDefault() {
    if (!inboxId) return;
    setBusy(true);
    try {
      await putInboxSla(inboxId, inboxPolicyId === "none" ? null : inboxPolicyId);
      setInboxes((prev) =>
        prev.map((i) =>
          i.id === inboxId
            ? { ...i, default_sla_policy_id: inboxPolicyId === "none" ? null : inboxPolicyId }
            : i,
        ),
      );
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.nav_sla}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.sla_create}
        </Button>
      }
    >
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>{COPY.crm.sla_inbox_default}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Caixa</Label>
            <Select value={inboxId} onValueChange={setInboxId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {inboxes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Política padrão</Label>
            <Select value={inboxPolicyId} onValueChange={setInboxPolicyId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {items.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={busy || !inboxId} onClick={() => void saveInboxDefault()}>
            {COPY.actions.salvar}
          </Button>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.sla_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{COPY.crm.sla_empty}</p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <Badge variant="outline">{item.active ? "Ativa" : "Inativa"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        FRT {secondsToLabel(item.frt_seconds)} · NRT{" "}
                        {secondsToLabel(item.nrt_seconds)} · RT {secondsToLabel(item.rt_seconds)}
                      </p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-gray-900">{item.description}</p>
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
            <DialogTitle>{editing ? "Editar política SLA" : COPY.crm.sla_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="sla_name">Nome</Label>
              <Input
                id="sla_name"
                name="name"
                className="mt-1"
                defaultValue={editing?.name ?? ""}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="frt">FRT (seg)</Label>
                <Input
                  id="frt"
                  name="frt_seconds"
                  type="number"
                  min={1}
                  className="mt-1"
                  defaultValue={editing?.frt_seconds ?? 900}
                  required
                />
              </div>
              <div>
                <Label htmlFor="nrt">NRT (seg)</Label>
                <Input
                  id="nrt"
                  name="nrt_seconds"
                  type="number"
                  min={1}
                  className="mt-1"
                  defaultValue={editing?.nrt_seconds ?? 1800}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rt">RT (seg)</Label>
                <Input
                  id="rt"
                  name="rt_seconds"
                  type="number"
                  min={1}
                  className="mt-1"
                  defaultValue={editing?.rt_seconds ?? 86400}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sla_desc">Descrição</Label>
              <Textarea
                id="sla_desc"
                name="description"
                className="mt-1"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
              Ativa
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
