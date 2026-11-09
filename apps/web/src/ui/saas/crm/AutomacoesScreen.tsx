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
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_EVENTS,
  CONDITION_ATTRIBUTES,
  CONDITION_OPERATORS,
  actionLabel,
  eventLabel,
  normalizeConditions,
  operatorLabel,
} from "../../crm/phase-b";
import type { AutomationAction, AutomationCondition, CrmAutomationDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

type Draft = {
  name: string;
  description: string;
  event_name: string;
  active: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

const emptyDraft = (): Draft => ({
  name: "",
  description: "",
  event_name: "message_created",
  active: false,
  conditions: [{ attribute_key: "status", filter_operator: "equal", values: ["open"] }],
  actions: [{ action_name: "add_label", action_params: { label_id: "" } }],
});

export function AutomacoesScreen() {
  const [items, setItems] = useState<CrmAutomationDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAutomationDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmAutomationDto>(await apiGet("/api/saas/crm/automacoes")).items);
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
    setDraft(emptyDraft());
    setOpen(true);
  }

  function openEdit(item: CrmAutomationDto) {
    setEditing(item);
    setDraft({
      name: item.name,
      description: item.description ?? "",
      event_name: String(item.event_name),
      active: Boolean(item.active),
      conditions: normalizeConditions(item.conditions),
      actions: (item.actions ?? []).map((a) => ({
        action_name: a.action_name,
        action_params: a.action_params ?? {},
      })),
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      event_name: draft.event_name,
      active: draft.active,
      conditions: { operator: "and" as const, values: draft.conditions },
      actions: draft.actions,
    };
    try {
      if (editing) {
        await apiSend(`/api/saas/crm/automacoes/${editing.id}`, "PATCH", body);
      } else {
        await apiSend("/api/saas/crm/automacoes", "POST", body);
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
      await apiSend(`/api/saas/crm/automacoes/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function onClone(id: string) {
    try {
      await apiSend(`/api/saas/crm/automacoes/${id}/clonar`, "POST");
      toast.success(COPY.crm.automacao_clone);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function onTest(id: string) {
    try {
      const result = await apiSend<{ matched?: boolean }>(
        `/api/saas/crm/automacoes/${id}/testar`,
        "POST",
        {},
      );
      toast.success(
        result?.matched === false
          ? "Condições não bateram (sem efeitos)."
          : "Teste concluído (sem efeitos colaterais).",
      );
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.automacoes_title}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.automacao_create}
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
            <CardTitle>{COPY.crm.automacoes_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.automacoes_empty}</h3>
                <Button type="button" onClick={openCreate}>
                  {COPY.crm.automacao_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {eventLabel(String(item.event_name))} · {(item.actions ?? []).length} ação(ões)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onTest(item.id)}>
                        {COPY.crm.automacao_test}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onClone(item.id)}>
                        {COPY.crm.automacao_clone}
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar automação" : COPY.crm.automacao_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="auto-name">{COPY.nome}</Label>
              <Input
                id="auto-name"
                className="mt-1"
                required
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="auto-desc">Descrição</Label>
              <Textarea
                id="auto-desc"
                className="mt-1"
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Evento</Label>
              <Select
                value={draft.event_name}
                onValueChange={(v) => setDraft((d) => ({ ...d, event_name: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_EVENTS.map((ev) => (
                    <SelectItem key={ev} value={ev}>
                      {eventLabel(ev)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: Boolean(v) }))}
              />
              Ativa
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Condições (E)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      conditions: [
                        ...d.conditions,
                        { attribute_key: "status", filter_operator: "equal", values: [""] },
                      ],
                    }))
                  }
                >
                  + condição
                </Button>
              </div>
              {draft.conditions.map((c, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-2 md:grid-cols-3">
                  <Select
                    value={c.attribute_key}
                    onValueChange={(v) =>
                      setDraft((d) => {
                        const conditions = [...d.conditions];
                        conditions[idx] = { ...conditions[idx]!, attribute_key: v };
                        return { ...d, conditions };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Atributo" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_ATTRIBUTES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={c.filter_operator}
                    onValueChange={(v) =>
                      setDraft((d) => {
                        const conditions = [...d.conditions];
                        conditions[idx] = { ...conditions[idx]!, filter_operator: v };
                        return { ...d, conditions };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>
                          {operatorLabel(op)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Valor"
                    value={c.values[0] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => {
                        const conditions = [...d.conditions];
                        conditions[idx] = {
                          ...conditions[idx]!,
                          values: [e.target.value],
                        };
                        return { ...d, conditions };
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ações</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      actions: [...d.actions, { action_name: "resolve", action_params: {} }],
                    }))
                  }
                >
                  + ação
                </Button>
              </div>
              {draft.actions.map((a, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-2 md:grid-cols-2">
                  <Select
                    value={a.action_name}
                    onValueChange={(v) =>
                      setDraft((d) => {
                        const actions = [...d.actions];
                        actions[idx] = { ...actions[idx]!, action_name: v };
                        return { ...d, actions };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_ACTIONS.map((name) => (
                        <SelectItem key={name} value={name}>
                          {actionLabel(name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Parâmetro (JSON ou texto)"
                    value={
                      typeof a.action_params?.value === "string"
                        ? String(a.action_params.value)
                        : a.action_params?.label_id
                          ? String(a.action_params.label_id)
                          : a.action_params?.content
                            ? String(a.action_params.content)
                            : a.action_params?.assignee_user_id
                              ? String(a.action_params.assignee_user_id)
                              : a.action_params?.status
                                ? String(a.action_params.status)
                                : a.action_params
                                  ? JSON.stringify(a.action_params)
                                  : ""
                    }
                    onChange={(e) =>
                      setDraft((d) => {
                        const actions = [...d.actions];
                        const name = actions[idx]!.action_name;
                        const raw = e.target.value;
                        let action_params: Record<string, unknown> = { value: raw };
                        if (name === "add_label" || name === "remove_label") {
                          action_params = { label_id: raw };
                        } else if (name === "send_message" || name === "add_private_note") {
                          action_params = { content: raw };
                        } else if (name === "send_webhook") {
                          action_params = { url: raw };
                        } else if (name === "assign_agent") {
                          action_params = { assignee_user_id: raw };
                        } else if (name === "assign_team") {
                          action_params = { team_id: raw };
                        } else if (name === "change_status") {
                          action_params = { status: raw };
                        } else if (name === "change_priority") {
                          action_params = { priority: raw };
                        } else if (name === "set_custom_attribute") {
                          const [attribute_key, ...rest] = raw.split("=");
                          action_params = {
                            attribute_key: attribute_key?.trim() || "",
                            value: rest.join("=").trim(),
                          };
                        } else if (raw.startsWith("{")) {
                          try {
                            action_params = JSON.parse(raw) as Record<string, unknown>;
                          } catch {
                            action_params = { value: raw };
                          }
                        }
                        actions[idx] = { action_name: name, action_params };
                        return { ...d, actions };
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy || !draft.name.trim()}>
                {COPY.actions.salvar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
