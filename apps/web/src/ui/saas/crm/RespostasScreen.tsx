"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type { CrmCannedDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function RespostasScreen() {
  const [items, setItems] = useState<CrmCannedDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCannedDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmCannedDto>(await apiGet("/api/saas/crm/respostas-rapidas")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      short_code: String(fd.get("short_code") || "").replace(/^\//, ""),
      content: fd.get("content"),
    };
    try {
      if (editing) {
        await apiSend(`/api/saas/crm/respostas-rapidas/${editing.id}`, "PATCH", body);
      } else {
        await apiSend("/api/saas/crm/respostas-rapidas", "POST", body);
      }
      setOpen(false);
      setEditing(null);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiSend(`/api/saas/crm/respostas-rapidas/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.respostas_title}
      actions={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          {COPY.crm.resposta_create}
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
            <CardTitle>{COPY.crm.respostas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.respostas_empty}</h3>
                <Button type="button" onClick={() => setOpen(true)}>
                  {COPY.crm.resposta_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">/{r.short_code}</p>
                      <p className="truncate text-sm text-muted-foreground">{r.content}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(r.id)}>
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar resposta" : COPY.crm.resposta_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onSave}>
            <div>
              <Label htmlFor="short_code">{COPY.crm.resposta_shortcode}</Label>
              <Input
                id="short_code"
                name="short_code"
                required
                defaultValue={editing?.short_code}
                className="mt-1"
                placeholder="saudacao"
              />
            </div>
            <div>
              <Label htmlFor="content">{COPY.body}</Label>
              <Textarea
                id="content"
                name="content"
                required
                rows={4}
                defaultValue={editing?.content}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variáveis: {"{{contact.nome}}"}, {"{{contact.phone}}"}
              </p>
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
