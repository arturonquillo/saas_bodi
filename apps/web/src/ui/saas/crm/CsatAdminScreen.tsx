"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { formatDate } from "../../format";
import type { CrmCsatDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function CsatAdminScreen() {
  const [items, setItems] = useState<CrmCsatDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [inboxId, setInboxId] = useState<string>("all");
  const [rating, setRating] = useState<string>("all");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [configInbox, setConfigInbox] = useState("");
  const [csatEnabled, setCsatEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet("/api/saas/crm/inboxes")
      .then((d) => {
        const list = asPage<CrmInboxDto>(d).items;
        setInboxes(list);
        if (list[0]) {
          setConfigInbox(list[0].id);
          setCsatEnabled(Boolean(list[0].csat_enabled));
        }
      })
      .catch(() => setInboxes([]));
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const q = new URLSearchParams();
      if (inboxId !== "all") q.set("inbox_id", inboxId);
      if (rating !== "all") q.set("rating", rating);
      const qs = q.toString();
      setItems(
        asPage<CrmCsatDto>(await apiGet(`/api/saas/crm/csat${qs ? `?${qs}` : ""}`)).items,
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [inboxId, rating]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const box = inboxes.find((i) => i.id === configInbox);
    if (box) setCsatEnabled(Boolean(box.csat_enabled));
  }, [configInbox, inboxes]);

  async function saveInboxCsat() {
    if (!configInbox) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/inboxes/${configInbox}`, "PATCH", {
        csat_enabled: csatEnabled,
      });
      setInboxes((prev) =>
        prev.map((i) => (i.id === configInbox ? { ...i, csat_enabled: csatEnabled } : i)),
      );
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.csat_title}>
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>{COPY.crm.csat_enable}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Caixa</Label>
            <Select value={configInbox} onValueChange={setConfigInbox}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inboxes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={csatEnabled} onCheckedChange={(v) => setCsatEnabled(Boolean(v))} />
            {COPY.crm.csat_enable}
          </label>
          <p className="text-sm text-muted-foreground">
            Ao resolver, a pesquisa é enviada pelo canal stub (sem Meta/SMTP).
          </p>
          <Button type="button" disabled={busy || !configInbox} onClick={() => void saveInboxCsat()}>
            {COPY.actions.salvar}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Respostas</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={inboxId} onValueChange={setInboxId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Caixa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as caixas</SelectItem>
                {inboxes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas notas</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} ★
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{COPY.crm.csat_empty}</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.rating} ★</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(item.submitted_at)}
                      </span>
                    </div>
                    {item.feedback_message ? (
                      <p className="mt-1 text-sm text-gray-900">{item.feedback_message}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Conversa {item.conversation_id}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
