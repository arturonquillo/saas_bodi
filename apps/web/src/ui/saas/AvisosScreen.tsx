"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxDto } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, asPage } from "../api";
import { COPY } from "../copy";
import { formatDate, maskRecipient } from "../format";
import { ListHeader, SaasMain } from "../layout";
import { OutboxBadge } from "../order-ui";
import { EmptyState, ErrorState, TableSkeleton } from "../states";

export function AvisosScreen() {
  const [items, setItems] = useState<OutboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<OutboxDto>(await apiGet("/api/saas/avisos")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SaasMain>
      <ListHeader title={COPY.avisos_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.avisos_empty} art="outbox" />
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((row) => (
                <li key={row.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatDate(row.created_at)}</span>
                    <OutboxBadge status={row.status} />
                  </div>
                  <p>
                    {row.channel === "email" ? COPY.outbox.email : COPY.outbox.whatsapp}
                    {" · "}
                    {maskRecipient(row.recipient)}
                  </p>
                  <p className="text-muted-foreground">{row.template_key}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.pedido_id ?? row.orcamento_id ?? row.venda_id ?? row.cadastro_request_id ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </SaasMain>
  );
}
