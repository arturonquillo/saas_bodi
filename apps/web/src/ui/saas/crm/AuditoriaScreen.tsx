"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COPY } from "../../copy";
import { formatDate } from "../../format";
import { getAuditoria, listAuditoria } from "../../crm/phase-e";
import type { CrmAuditEventDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function AuditoriaScreen() {
  const [items, setItems] = useState<CrmAuditEventDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmAuditEventDto | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      setStatus("loading");
      try {
        const page = await listAuditoria({
          cursor: cursor || undefined,
          action: action.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.next_cursor ?? null);
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    },
    [action, from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    try {
      setDetail(await getAuditoria(id));
    } catch {
      setDetail(items.find((i) => i.id === id) ?? null);
    }
  }

  return (
    <SaasPage title={COPY.crm.nav_auditoria}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{COPY.crm.auditoria_filters}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="aud_action">Ação</Label>
            <Input
              id="aud_action"
              className="mt-1"
              placeholder="sla.policy_created"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="aud_from">De</Label>
            <Input
              id="aud_from"
              type="date"
              className="mt-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="aud_to">Até</Label>
            <Input
              id="aud_to"
              type="date"
              className="mt-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void load()}>
              {COPY.crm.relatorios_apply}
            </Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" && items.length === 0 ? (
        <TableSkeleton />
      ) : status === "error" && items.length === 0 ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.auditoria_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.auditoria_empty}
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.action}</Badge>
                        {item.aggregate_type ? (
                          <span className="text-xs text-muted-foreground">
                            {item.aggregate_type}
                            {item.aggregate_id ? `:${item.aggregate_id.slice(0, 8)}` : ""}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.actor_nome ?? item.actor_user_id ?? "sistema"} ·{" "}
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void openDetail(item.id)}>
                      Detalhe
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {nextCursor ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => void load(nextCursor)}
              >
                Carregar mais
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.action}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Quando:</span>{" "}
                {formatDate(detail.created_at)}
              </p>
              <p>
                <span className="text-muted-foreground">Ator:</span>{" "}
                {detail.actor_nome ?? detail.actor_user_id ?? "sistema"}
              </p>
              <p>
                <span className="text-muted-foreground">Agregado:</span>{" "}
                {detail.aggregate_type ?? "—"} / {detail.aggregate_id ?? "—"}
              </p>
              <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                {JSON.stringify(detail.payload_json ?? {}, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
