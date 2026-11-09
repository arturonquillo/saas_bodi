"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import type { CrmFilterDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function queryToHref(filter: CrmFilterDto) {
  if (filter.filter_type === "contact") {
    const q = typeof filter.query_json?.q === "string" ? filter.query_json.q : "";
    return q ? `/saas/contatos?q=${encodeURIComponent(q)}` : "/saas/contatos";
  }
  const params = new URLSearchParams();
  const q = filter.query_json ?? {};
  if (typeof q.status === "string" && q.status) params.set("status", q.status);
  if (typeof q.assignee === "string" && q.assignee) params.set("assignee", q.assignee);
  if (typeof q.inbox_id === "string" && q.inbox_id) params.set("inbox_id", q.inbox_id);
  if (typeof q.label === "string" && q.label) params.set("label", q.label);
  if (typeof q.team_id === "string" && q.team_id) params.set("team_id", q.team_id);
  const s = params.toString();
  return s ? `/saas/conversas?${s}` : "/saas/conversas";
}

export function FiltrosScreen() {
  const [items, setItems] = useState<CrmFilterDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<"conversation" | "contact">("conversation");
  const [assignee, setAssignee] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmFilterDto>(await apiGet("/api/saas/crm/filtros")).items);
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
    const query_json =
      filterType === "contact"
        ? { q: String(fd.get("q") || "") }
        : {
            status: String(fd.get("status") || "") || undefined,
            assignee: assignee === "none" ? undefined : assignee,
            inbox_id: String(fd.get("inbox_id") || "") || undefined,
            label: String(fd.get("label") || "") || undefined,
          };
    try {
      await apiSend("/api/saas/crm/filtros", "POST", {
        name: fd.get("name"),
        filter_type: filterType,
        query_json,
      });
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
      await apiSend(`/api/saas/crm/filtros/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.filtros_title}
      actions={
        <Button type="button" onClick={() => setOpen(true)}>
          {COPY.crm.filtro_create}
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
            <CardTitle>{COPY.crm.filtros_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.filtros_empty}</h3>
                <Button type="button" onClick={() => setOpen(true)}>
                  {COPY.crm.filtro_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {JSON.stringify(item.query_json)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {item.filter_type === "contact" ? "Contatos" : "Conversas"}
                      </Badge>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={queryToHref(item)}>{COPY.crm.filtro_apply}</Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
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
            <DialogTitle>{COPY.crm.filtro_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="filtro-name">{COPY.nome}</Label>
              <Input id="filtro-name" name="name" required className="mt-1" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={filterType}
                onValueChange={(v) => setFilterType(v as "conversation" | "contact")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversation">Conversas</SelectItem>
                  <SelectItem value="contact">Contatos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterType === "conversation" ? (
              <>
                <div>
                  <Label htmlFor="filtro-status">Status</Label>
                  <Input id="filtro-status" name="status" className="mt-1" placeholder="open" />
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="me">Minhas</SelectItem>
                      <SelectItem value="unassigned">Não atribuídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filtro-label">Label</Label>
                  <Input id="filtro-label" name="label" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="filtro-inbox">Inbox ID</Label>
                  <Input id="filtro-inbox" name="inbox_id" className="mt-1 font-mono text-xs" />
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="filtro-q">Busca</Label>
                <Input id="filtro-q" name="q" className="mt-1" />
              </div>
            )}
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
