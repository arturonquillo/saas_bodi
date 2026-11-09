"use client";

import { useCallback, useEffect, useState } from "react";
import type { SaasRole } from "@saas-frota/shared";
import type { UserDto } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { ListHeader, SaasMain } from "../layout";
import { roleLabel } from "./nav";
import { EmptyState, ErrorState, TableSkeleton } from "../states";

export function UsuariosScreen() {
  const [items, setItems] = useState<UserDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<SaasRole>("vendedor");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<UserDto>(await apiGet("/api/saas/usuarios")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiSend<UserDto>("/api/saas/usuarios", "POST", {
        email: fd.get("email"),
        nome: fd.get("nome"),
        saas_role: role,
        senha: fd.get("password"),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    await apiSend<UserDto>(`/api/saas/usuarios/${id}`, "PATCH", { ativo: false });
    setConfirmId(null);
    await load();
  }

  return (
    <SaasMain>
      <ListHeader
        title={COPY.users_title}
        actions={
          <Button type="button" onClick={() => setOpen((o) => !o)}>
            {COPY.user_create}
          </Button>
        }
      />

      {open ? (
        <Card className="mb-4 gap-0 py-0">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={createUser}>
              <p className="font-medium">{COPY.user_create}</p>
              <div>
                <Label htmlFor="nome" className="mb-2">
                  {COPY.nome}
                </Label>
                <Input id="nome" name="nome" required />
              </div>
              <div>
                <Label htmlFor="email" className="mb-2">
                  {COPY.email}
                </Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="password" className="mb-2">
                  {COPY.password}
                </Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div>
                <Label className="mb-2">Papel</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as SaasRole)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="admin" id="role-admin" />
                    <Label htmlFor="role-admin">{COPY.role_admin}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="vendedor" id="role-vendedor" />
                    <Label htmlFor="role-vendedor">{COPY.role_vendedor}</Label>
                  </div>
                </RadioGroup>
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button type="submit" disabled={busy}>
                  {COPY.actions.criar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.users_empty} />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((u) => (
                <li key={u.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{u.nome}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                      <p className="text-sm">{roleLabel(u.saas_role as SaasRole)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {u.ativo ? (
                        <span className="rounded-md bg-[var(--color-success)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                          Inativo
                        </span>
                      )}
                      {u.ativo ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(confirmId === u.id ? null : u.id)}
                        >
                          {COPY.user_deactivate}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {confirmId === u.id ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                      <p className="flex-1 text-sm text-muted-foreground">{COPY.user_deactivate_confirm}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmId(null)}>
                        {COPY.actions.cancelar}
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => void deactivate(u.id)}>
                        {COPY.user_deactivate}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </SaasMain>
  );
}
