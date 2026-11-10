"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxDto } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, asPage } from "../api";
import { COPY } from "../copy";
import { formatDate, maskRecipient } from "../format";
import { SaasPage } from "../layout";
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
    <SaasPage title={COPY.avisos_title} description={COPY.avisos_page_desc}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle>Histórico de avisos</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState
                title={COPY.avisos_empty}
                body={COPY.avisos_empty_body}
                art="outbox"
              />
            ) : (
              <ul className="space-y-4">
                {items.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">{formatDate(row.created_at)}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.channel === "email" ? COPY.outbox.email : COPY.outbox.whatsapp}
                        {" · "}
                        {maskRecipient(row.recipient)}
                      </p>
                      <p className="text-sm text-muted-foreground">{row.template_key}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.pedido_id ?? row.orcamento_id ?? row.venda_id ?? row.cadastro_request_id ?? "—"}
                      </p>
                    </div>
                    <OutboxBadge status={row.status} />
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
