"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError, type UserDto } from "../../api";
import { COPY } from "../../copy";
import type { CrmTeamDto } from "../../crm/types";
import { DetailNavButton } from "../../DetailNavRow";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function EquipesListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CrmTeamDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmTeamDto>(await apiGet("/api/saas/crm/teams")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiSend<CrmTeamDto>("/api/saas/crm/teams", "POST", {
        name: fd.get("name"),
      });
      setOpen(false);
      router.push(`/saas/crm/equipes/${created.id}`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.equipes_title}
      actions={
        <Button type="button" onClick={() => setOpen(true)}>
          {COPY.crm.equipe_create}
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
            <CardTitle>{COPY.crm.equipes_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.equipes_empty}</h3>
                <Button type="button" onClick={() => setOpen(true)}>
                  {COPY.crm.equipe_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((t) => (
                  <li key={t.id}>
                    <DetailNavButton
                      className="rounded-md px-2 py-2"
                      onClick={() => router.push(`/saas/crm/equipes/${t.id}`)}
                      meta={
                        <span className="text-sm text-muted-foreground">
                          {t.member_count ?? t.member_ids?.length ?? 0} membros
                        </span>
                      }
                    >
                      <p className="font-medium text-foreground">{t.name}</p>
                    </DetailNavButton>
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
            <DialogTitle>{COPY.crm.equipe_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="name">{COPY.nome}</Label>
              <Input id="name" name="name" required className="mt-1" />
            </div>
            <DialogFooter>
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
    </SaasPage>
  );
}

export function EquipeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<CrmTeamDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      // No GET /teams/:id — resolve from list + members.
      const list = asPage<CrmTeamDto>(await apiGet("/api/saas/crm/teams")).items;
      const t = list.find((x) => x.id === id) ?? null;
      if (!t) throw new Error("missing");
      setTeam(t);
      const members = await apiGet<{ user_ids?: string[] } | string[]>(
        `/api/saas/crm/teams/${id}/members`,
      ).catch(() => ({ user_ids: t.member_ids ?? [] }));
      const ids = Array.isArray(members) ? members : (members.user_ids ?? []);
      setMemberIds(ids);
      setUsers(asPage<UserDto>(await apiGet("/api/saas/usuarios")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMembers() {
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/teams/${id}/members`, "PUT", { user_ids: memberIds });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.equipes_title}>
        <TableSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !team) {
    return (
      <SaasPage title={COPY.crm.equipes_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={team.name}
      actions={
        <Button type="button" disabled={busy} onClick={() => void saveMembers()}>
          {COPY.actions.salvar}
        </Button>
      }
    >
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/saas/crm/equipes">{COPY.crm.equipes_title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{team.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle>{COPY.crm.equipe_members}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {users
              .filter((u) => u.saas_role)
              .map((u) => {
                const checked = memberIds.includes(u.id);
                return (
                  <li key={u.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setMemberIds((prev) =>
                          v ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                        );
                      }}
                    />
                    <span className="text-sm">
                      {u.nome || u.email}{" "}
                      <span className="text-muted-foreground">({u.saas_role})</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
