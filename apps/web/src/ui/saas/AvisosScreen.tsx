"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxDto } from "../api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, asPage } from "../api";
import { COPY } from "../copy";
import { formatDate, maskRecipient } from "../format";
import { DeskWrap, ListHeader, SaasMain } from "../layout";
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
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Doc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                  <TableCell>
                    {row.channel === "email" ? COPY.outbox.email : COPY.outbox.whatsapp}
                  </TableCell>
                  <TableCell>{maskRecipient(row.recipient)}</TableCell>
                  <TableCell>{row.template_key}</TableCell>
                  <TableCell>
                    <OutboxBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.pedido_id ?? row.orcamento_id ?? row.venda_id ?? row.cadastro_request_id ?? "—"}
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
