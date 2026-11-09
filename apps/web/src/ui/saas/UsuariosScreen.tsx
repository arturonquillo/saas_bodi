"use client";

import { useCallback, useEffect, useState } from "react";
import type { SaasRole } from "@saas-frota/shared";
import type { UserDto } from "../api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { SaasPage } from "../layout";
import { roleLabel } from "./nav";
import { ErrorState, TableSkeleton } from "../states";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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
    <SaasPage
      title={COPY.users_title}
      actions={
        <Button
          type="button"
          className="bg-primary text-white hover:bg-primary/90"
          onClick={() => setOpen((o) => !o)}
        >
          {COPY.user_create}
        </Button>
      }
    >
      {open ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.user_create}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createUser}>
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
                  <div className="mt-2 flex items-center gap-2">
                    <RadioGroupItem value="admin" id="role-admin" />
                    <Label htmlFor="role-admin">{COPY.role_admin}</Label>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
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
                <Button type="submit" className="bg-primary text-white hover:bg-primary/90" disabled={busy}>
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
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.users_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.users_empty}</h3>
                <p className="max-w-sm text-sm text-gray-500">
                  Crie o primeiro usuário para começar a operar o workspace.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((u) => (
                  <li key={u.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarFallback>{initials(u.nome || u.email)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{u.nome}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                          <p className="text-sm capitalize text-gray-500">
                            {roleLabel(u.saas_role as SaasRole)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {u.ativo ? (
                          <span className="text-sm font-medium text-green-600">Ativo</span>
                        ) : (
                          <span className="text-sm font-medium text-red-500">Inativo</span>
                        )}
                        {u.ativo ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmId(confirmId === u.id ? null : u.id)}
                          >
                            {COPY.user_deactivate}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {confirmId === u.id ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="flex-1 text-sm text-gray-500">{COPY.user_deactivate_confirm}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmId(null)}>
                          {COPY.actions.cancelar}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void deactivate(u.id)}
                        >
                          {COPY.user_deactivate}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </SaasPage>
  );
}
