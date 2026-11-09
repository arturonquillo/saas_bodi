"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxDto } from "@saas-frota/shared";
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
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{formatDate(o.created_at)}</TableCell>
                  <TableCell>{o.channel === "email" ? COPY.outbox.email : COPY.outbox.whatsapp}</TableCell>
                  <TableCell>{maskRecipient(o.recipient)}</TableCell>
                  <TableCell>{o.template_key}</TableCell>
                  <TableCell>
                    <OutboxBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.pedido_id ?? o.orcamento_id ?? o.venda_id ?? o.cadastro_request_id ?? "—"}
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
