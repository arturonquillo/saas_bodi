"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxDto } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, asPage } from "../api";
import { COPY } from "../copy";
import { formatDate, maskRecipient } from "../format";
import { SaasPage } from "../layout";
import { OutboxBadge } from "../order-ui";
import { ErrorState, TableSkeleton } from "../states";

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
    <SaasPage title={COPY.avisos_title}>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Histórico de avisos</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.avisos_empty}</h3>
                <p className="max-w-sm text-sm text-gray-500">
                  Quando e-mails ou WhatsApp forem enfileirados, eles aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-gray-900">{formatDate(row.created_at)}</p>
                      <p className="text-sm text-gray-500">
                        {row.channel === "email" ? COPY.outbox.email : COPY.outbox.whatsapp}
                        {" · "}
                        {maskRecipient(row.recipient)}
                      </p>
                      <p className="text-sm text-gray-500">{row.template_key}</p>
                      <p className="text-xs text-gray-500">
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
