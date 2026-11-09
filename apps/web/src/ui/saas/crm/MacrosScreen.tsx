"use client";

import { useCallback, useEffect, useState } from "react";
import { isAdmin } from "@saas-frota/shared";
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
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { MACRO_ACTIONS, actionLabel } from "../../crm/phase-b";
import type { AutomationAction, CrmMacroDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { useSession } from "../../session";
import { ErrorState, TableSkeleton } from "../../states";

type Draft = {
  name: string;
  visibility: "public" | "private";
  actions: AutomationAction[];
};

const emptyDraft = (admin: boolean): Draft => ({
  name: "",
  visibility: admin ? "public" : "private",
  actions: [{ action_name: "resolve", action_params: {} }],
});

export function MacrosScreen() {
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [items, setItems] = useState<CrmMacroDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMacroDto | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(admin));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmMacroDto>(await apiGet("/api/saas/crm/macros")).items);
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
    setDraft(emptyDraft(admin));
    setOpen(true);
  }

  function openEdit(item: CrmMacroDto) {
    setEditing(item);
    setDraft({
      name: item.name,
      visibility: item.visibility === "public" ? "public" : "private",
      actions: (item.actions ?? []).map((a) => ({
        action_name: a.action_name,
        action_params: a.action_params ?? {},
      })),
    });
    setOpen(true);
  }

  function canMutate(item: CrmMacroDto) {
    if (admin) return true;
    return item.visibility === "private" && item.owner_user_id === session?.user_id;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (draft.visibility === "public" && !admin) {
      toast.error(COPY.forbidden);
      return;
    }
    setBusy(true);
    const body = {
      name: draft.name.trim(),
      visibility: draft.visibility,
      actions: draft.actions,
    };
    try {
      if (editing) {
        await apiSend(`/api/saas/crm/macros/${editing.id}`, "PATCH", body);
      } else {
        await apiSend("/api/saas/crm/macros", "POST", body);
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
      await apiSend(`/api/saas/crm/macros/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.macros_title}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.macro_create}
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
            <CardTitle>{COPY.crm.macros_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.macros_empty}</h3>
                <Button type="button" onClick={openCreate}>
                  {COPY.crm.macro_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(item.actions ?? []).map((a) => actionLabel(a.action_name)).join(" → ") ||
                          "Sem ações"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {item.visibility === "public"
                          ? COPY.crm.macro_public
                          : COPY.crm.macro_private}
                      </Badge>
                      {canMutate(item) ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(item)}>
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void onDelete(item.id)}
                          >
                            Excluir
                          </Button>
                        </>
                      ) : null}
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
            <DialogTitle>{editing ? "Editar macro" : COPY.crm.macro_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="macro-name">{COPY.nome}</Label>
              <Input
                id="macro-name"
                className="mt-1"
                required
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Visibilidade</Label>
              <Select
                value={draft.visibility}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, visibility: v as "public" | "private" }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {admin ? (
                    <SelectItem value="public">{COPY.crm.macro_public}</SelectItem>
                  ) : null}
                  <SelectItem value="private">{COPY.crm.macro_private}</SelectItem>
                </SelectContent>
              </Select>
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
                      actions: [...d.actions, { action_name: "add_label", action_params: { label: "" } }],
                    }))
                  }
                >
                  + ação
                </Button>
              </div>
              {draft.actions.map((a, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-2">
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
                      {MACRO_ACTIONS.map((name) => (
                        <SelectItem key={name} value={name}>
                          {actionLabel(name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Parâmetro"
                    value={String(
                      a.action_params?.label ??
                        a.action_params?.content ??
                        a.action_params?.value ??
                        "",
                    )}
                    onChange={(e) =>
                      setDraft((d) => {
                        const actions = [...d.actions];
                        const name = actions[idx]!.action_name;
                        const raw = e.target.value;
                        const action_params =
                          name === "add_label" || name === "remove_label"
                            ? { label: raw }
                            : name === "send_message" || name === "add_private_note"
                              ? { content: raw }
                              : { value: raw };
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
