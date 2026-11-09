"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, asPage, isApiError, type UserDto } from "../../api";
import { COPY } from "../../copy";
import {
  CUSTOM_ROLE_PERMISSIONS,
  createPapel,
  deletePapel,
  listPapeis,
  patchPapel,
  permissionLabel,
} from "../../crm/phase-e";
import type { CrmCustomRoleDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function rolePermissions(role: CrmCustomRoleDto) {
  return role.permissions ?? role.permissions_json ?? [];
}

export function PapeisScreen() {
  const [items, setItems] = useState<CrmCustomRoleDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCustomRoleDto | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState<string>("none");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [roles, userPage] = await Promise.all([
        listPapeis(),
        apiGet("/api/saas/usuarios").then((d) => asPage<UserDto>(d).items),
      ]);
      setItems(roles.items);
      setUsers(userPage.filter((u) => u.ativo));
      if (!assignUserId && userPage[0]) setAssignUserId(userPage[0].id);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [assignUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setPerms(["report_manage"]);
    setOpen(true);
  }

  function openEdit(item: CrmCustomRoleDto) {
    setEditing(item);
    setPerms(rolePermissions(item));
    setOpen(true);
  }

  function togglePerm(bit: string, checked: boolean) {
    setPerms((prev) => (checked ? [...prev, bit] : prev.filter((p) => p !== bit)));
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || "").trim(),
      description: String(fd.get("description") || "").trim() || null,
      permissions: perms,
      permissions_json: perms,
    };
    try {
      if (editing) {
        await patchPapel(editing.id, body);
      } else {
        await createPapel(body);
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
      await deletePapel(id);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function assignRole() {
    if (!assignUserId) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/usuarios/${assignUserId}`, "PATCH", {
        custom_role_id: assignRoleId === "none" ? null : assignRoleId,
      });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.nav_papeis}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.papeis_create}
        </Button>
      }
    >
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>{COPY.crm.papeis_assign}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Usuário</Label>
            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} ({u.saas_role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Papel customizado</Label>
            <Select value={assignRoleId} onValueChange={setAssignRoleId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {items.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{COPY.crm.papeis_hint}</p>
          <Button type="button" disabled={busy || !assignUserId} onClick={() => void assignRole()}>
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
            <CardTitle>{COPY.crm.papeis_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.papeis_empty}
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rolePermissions(item).map((bit) => (
                          <Badge key={bit} variant="outline">
                            {permissionLabel(bit)}
                          </Badge>
                        ))}
                      </div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar papel" : COPY.crm.papeis_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="role_name">Nome</Label>
              <Input
                id="role_name"
                name="name"
                className="mt-1"
                defaultValue={editing?.name ?? ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="role_desc">Descrição</Label>
              <Textarea
                id="role_desc"
                name="description"
                className="mt-1"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              {CUSTOM_ROLE_PERMISSIONS.map((bit) => (
                <label key={bit} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={perms.includes(bit)}
                    onCheckedChange={(c) => togglePerm(bit, Boolean(c))}
                  />
                  {permissionLabel(bit)}
                </label>
              ))}
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
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
