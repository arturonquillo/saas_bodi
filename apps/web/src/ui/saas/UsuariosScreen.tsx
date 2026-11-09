"use client";

import { useCallback, useEffect, useState } from "react";
import type { SaasRole } from "@saas-frota/shared";
import type { UserDto } from "../api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { DeskWrap, ListHeader, SaasMain } from "../layout";
import { roleLabel } from "./nav";
import { EmptyState, ErrorState, TableSkeleton } from "../states";

export function UsuariosScreen() {
  const [items, setItems] = useState<UserDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        saas_role: fd.get("saas_role"),
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
    await load();
  }

  return (
    <SaasMain>
      <ListHeader
        title={COPY.users_title}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">{COPY.user_create}</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={createUser}>
                <DialogHeader>
                  <DialogTitle>{COPY.user_create}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-3">
                  <Field>
                    <FieldLabel htmlFor="nome">{COPY.nome}</FieldLabel>
                    <Input id="nome" name="nome" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="email">{COPY.email}</FieldLabel>
                    <Input id="email" name="email" type="email" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">{COPY.password}</FieldLabel>
                    <Input id="password" name="password" type="password" required />
                  </Field>
                  <Field>
                    <FieldLabel>Papel</FieldLabel>
                    <Select name="saas_role" defaultValue="vendedor">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{COPY.role_admin}</SelectItem>
                        <SelectItem value="vendedor">{COPY.role_vendedor}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {COPY.actions.cancelar}
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {COPY.actions.criar}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.users_empty} />
      ) : (
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{COPY.nome}</TableHead>
                <TableHead>{COPY.email}</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{roleLabel(u.saas_role as SaasRole)}</TableCell>
                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="secondary" className="border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.ativo ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="sm">
                            {COPY.user_deactivate}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{COPY.user_deactivate}</AlertDialogTitle>
                            <AlertDialogDescription>{COPY.user_deactivate_confirm}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{COPY.actions.cancelar}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void deactivate(u.id)}>
                              {COPY.user_deactivate}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DeskWrap>
      )}
    </SaasMain>
  );
}
