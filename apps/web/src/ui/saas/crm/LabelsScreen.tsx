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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { displayLabelTitle } from "../../crm/labels";
import type { CrmLabelDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

const SWATCHES = ["#0F766E", "#1D4ED8", "#B45309", "#BE123C", "#6D28D9", "#334155"];

export function LabelsScreen() {
  const [items, setItems] = useState<CrmLabelDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(SWATCHES[0]!);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmLabelDto>(await apiGet("/api/saas/crm/labels")).items);
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
      await apiSend("/api/saas/crm/labels", "POST", {
        title: fd.get("title"),
        color,
        description: fd.get("description") || null,
      });
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, system?: boolean) {
    if (system) return;
    try {
      await apiSend(`/api/saas/crm/labels/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.labels_title}
      actions={
        <Button type="button" onClick={() => setOpen(true)}>
          {COPY.crm.label_create}
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
            <CardTitle>{COPY.crm.labels_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.labels_empty}</h3>
                <Button type="button" onClick={() => setOpen(true)}>
                  {COPY.crm.label_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: l.color || "#64748b" }}
                      />
                      <span className="truncate font-medium">{displayLabelTitle(l.title)}</span>
                      {l.system || l.title.startsWith("intent:") ? (
                        <Badge variant="secondary">{COPY.crm.label_system}</Badge>
                      ) : null}
                    </div>
                    {l.system || l.title.startsWith("intent:") ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button type="button" variant="ghost" size="sm" disabled>
                                Excluir
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Labels do sistema não podem ser excluídos</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(l.id)}>
                        Excluir
                      </Button>
                    )}
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
            <DialogTitle>{COPY.crm.label_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="title">{COPY.nome}</Label>
              <Input id="title" name="title" required className="mt-1" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full border"
                    style={{ background: c }}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" rows={2} className="mt-1" />
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
