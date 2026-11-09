"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PedidoDto } from "../api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, docTotal } from "../api";
import { COPY } from "../copy";
import { formatDate, formatMoney } from "../format";
import { DeskWrap, StoreMain } from "../layout";
import { MoneyCell, PedidoStatusBadge, PedidoStatusTrail } from "../order-ui";
import { useSession } from "../session";
import { ErrorState, FormSkeleton } from "../states";

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { status: sessStatus } = useSession();
  const router = useRouter();
  const [item, setItem] = useState<PedidoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<PedidoDto>(`/api/loja/pedidos/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    if (sessStatus === "guest") {
      router.replace(`/loja/entrar?return=${encodeURIComponent(`/loja/pedidos/${id}`)}`);
      return;
    }
    if (sessStatus === "auth") void load();
  }, [sessStatus, load, router, id]);

  if (sessStatus === "loading" || status === "loading") {
    return (
      <StoreMain>
        <FormSkeleton />
      </StoreMain>
    );
  }
  if (status === "error" || !item) {
    return (
      <StoreMain>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </StoreMain>
    );
  }

  return (
    <StoreMain>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/loja/meus-docs">{COPY.nav_meus_docs}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{item.id}</h1>
        <PedidoStatusBadge status={item.status} large />
      </div>
      <div className="mb-6">
        <PedidoStatusTrail status={item.status} />
      </div>

      <DeskWrap className="mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {item.linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.nome}</TableCell>
                <TableCell>{l.qty}</TableCell>
                <TableCell>{formatMoney(l.unit_price_centavos)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DeskWrap>
      <p className="mb-4 font-semibold">
        Total: <MoneyCell centavos={docTotal(item.linhas ?? [])} />
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {item.historico.map((h, i) => (
          <li key={`${h.to}-${i}`}>
            {h.from ?? "—"} → {h.to} · {formatDate(h.created_at)}
          </li>
        ))}
      </ul>
    </StoreMain>
  );
}
