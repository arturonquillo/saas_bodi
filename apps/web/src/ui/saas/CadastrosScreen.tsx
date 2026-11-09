"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CadastroDto, CadastroStatus } from "@saas-frota/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { DeskWrap, ListHeader, SaasMain } from "../layout";
import { CadastroStatusBadge, NotifyAlert } from "../order-ui";
import { EmptyState, ErrorState, FormSkeleton, GateBanner, TableSkeleton } from "../states";

export function CadastrosListScreen() {
  const [items, setItems] = useState<CadastroDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CadastroDto>(await apiGet("/api/saas/cadastros")).items);
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
      <ListHeader title={COPY.cadastros_title} />
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY.cadastros_empty} />
      ) : (
        <DeskWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/saas/cadastros/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.razao_social}</TableCell>
                  <TableCell>{c.cnpj_masked}</TableCell>
                  <TableCell>
                    <CadastroStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{c.source}</TableCell>
                  <TableCell>{formatDate(c.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DeskWrap>
      )}
    </SaasMain>
  );
}

export function CadastroDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<CadastroDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<CadastroDto>(`/api/saas/cadastros/${id}`));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(para: CadastroStatus) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CadastroDto>(`/api/saas/cadastros/${id}/transicao`, "POST", {
        para,
        motivo_recusa: para === "recusado" ? motivo : undefined,
      });
      setItem(next);
      setNotified(true);
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
              <Link href="/saas/cadastros">{COPY.cadastros_title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.razao_social}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{item.razao_social}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.cnpj_masked}</p>
        </div>
        <CadastroStatusBadge status={item.status} />
      </div>

      {item.cnpj_registro_pendente ? (
        <div className="mb-3">
          <Badge variant="outline" className="border-[var(--color-warning)]/40 text-[var(--color-warning)]">
            {COPY.registry_pending_badge}
          </Badge>
        </div>
      ) : null}

      <DeskWrap className="mb-4 space-y-2 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{COPY.contato}: </span>
          {item.contato_nome}
        </p>
        <p>
          <span className="text-muted-foreground">{COPY.email}: </span>
          {item.email}
        </p>
        <p>
          <span className="text-muted-foreground">{COPY.whatsapp}: </span>
          {item.whatsapp}
        </p>
        <p>
          <span className="text-muted-foreground">Origem: </span>
          {item.source}
        </p>
        {item.motivo_recusa ? (
          <p>
            <span className="text-muted-foreground">{COPY.refuse_reason}: </span>
            {item.motivo_recusa}
          </p>
        ) : null}
      </DeskWrap>

      {item.status === "pendente" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void transition("aprovado")}>
            {COPY.approve}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={busy}>
                {COPY.refuse}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{COPY.refuse}</AlertDialogTitle>
                <AlertDialogDescription>{COPY.refuse_reason_required}</AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor="motivo">{COPY.refuse_reason}</FieldLabel>
                <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel>{COPY.actions.cancelar}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!motivo.trim()}
                  onClick={() => void transition("recusado")}
                >
                  {COPY.refuse}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {error ? (
        <Alert className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notified ? <NotifyAlert canais="whatsapp" /> : null}
    </SaasMain>
  );
}
