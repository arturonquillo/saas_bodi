"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin } from "@saas-frota/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError, type EstoqueItemDto } from "../api";
import { COPY } from "../copy";
import { formatMoney } from "../format";
import { DeskWrap, ListHeader, SaasMain } from "../layout";
import { useSession } from "../session";
import { EmptyState, ErrorState, FormSkeleton, TableSkeleton } from "../states";

export function EstoqueListScreen() {
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [items, setItems] = useState<EstoqueItemDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<EstoqueItemDto>(await apiGet("/api/saas/estoque")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleVisibility(item: EstoqueItemDto, visivel_loja: boolean) {
    if (!admin) return;
    const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${item.id}/visibilidade`, "PATCH", {
      visivel_loja,
    });
    setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)));
  }

  return (
    <SaasMain>
      <ListHeader title={COPY.estoque_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.estoque_empty} art="warehouse" />
      ) : (
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>{COPY.on_hand}</TableHead>
                <TableHead>{COPY.reserved}</TableHead>
                <TableHead>{COPY.available}</TableHead>
                <TableHead>{COPY.price_atacado}</TableHead>
                <TableHead>{COPY.visivel_loja}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/saas/estoque/${item.id}`} className="font-medium text-primary hover:underline">
                      {item.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => router.push(`/saas/estoque/${item.id}`)}>
                    {item.nome}
                  </TableCell>
                  <TableCell>{item.on_hand}</TableCell>
                  <TableCell>{item.reserved}</TableCell>
                  <TableCell>{item.available}</TableCell>
                  <TableCell>{formatMoney(item.preco_atacado_centavos)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={item.visivel_loja}
                      disabled={!admin}
                      onCheckedChange={(v) => void toggleVisibility(item, v)}
                      aria-label={COPY.visivel_loja}
                    />
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

export function SkuDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [item, setItem] = useState<EstoqueItemDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [delta, setDelta] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<EstoqueItemDto>(`/api/saas/estoque/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${id}/ajuste`, "POST", {
        delta_on_hand: Number(delta),
        motivo,
      });
      setItem(next);
      setOpen(false);
      setDelta("0");
      setMotivo("");
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasMain>
        <FormSkeleton />
      </SaasMain>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasMain>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasMain>
    );
  }

  return (
    <SaasMain>
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/saas/estoque">{COPY.estoque_title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.sku}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{item.nome}</h1>
          <p className="text-sm text-muted-foreground">{item.sku}</p>
        </div>
        {admin ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">{COPY.adjust_qty}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{COPY.adjust_qty}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Field>
                  <FieldLabel htmlFor="delta">Delta</FieldLabel>
                  <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="motivo">{COPY.motivo}</FieldLabel>
                  <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </Field>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button type="button" disabled={busy} onClick={() => void adjust()}>
                  {COPY.actions.confirmar}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <DeskWrap className="grid gap-3 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">{COPY.on_hand}</p>
          <p className="text-lg font-semibold tabular-nums">{item.on_hand}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{COPY.reserved}</p>
          <p className="text-lg font-semibold tabular-nums">{item.reserved}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{COPY.available}</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{item.available}</p>
        </div>
      </DeskWrap>

      <DeskWrap className="mt-4 space-y-2 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{COPY.price_atacado}: </span>
          {formatMoney(item.preco_atacado_centavos)}
        </p>
        <p>
          <span className="text-muted-foreground">{COPY.moq(item.qtd_min_atacado)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{COPY.visivel_loja}: </span>
          {item.visivel_loja ? "Sim" : "Não"}
        </p>
      </DeskWrap>

      {!admin ? (
        <Alert className="mt-4">
          <AlertDescription>Somente leitura para vendedor.</AlertDescription>
        </Alert>
      ) : null}
    </SaasMain>
  );
}
