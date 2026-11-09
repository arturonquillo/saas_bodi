"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type {
  CrmContactDto,
  CrmImportBatchDto,
  CrmImportPreviewDto,
} from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

async function readCsvFile(file: File) {
  return file.text();
}

export function ContatosImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [batch, setBatch] = useState<CrmImportBatchDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPreview() {
    if (!file) return;
    setBusy(true);
    try {
      const csv = await readCsvFile(file);
      const res = await apiSend<CrmImportPreviewDto>(
        "/api/saas/crm/contatos/importar/preview",
        "POST",
        { csv },
      );
      setPreview(res.preview ?? []);
      toast.success(`Pré-visualização: ${res.total_rows ?? 0} linha(s).`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<CrmImportBatchDto>("/api/saas/crm/contatos/importar", {
        method: "POST",
        body: fd,
      });
      setBatch(res);
      toast.success("Importação enfileirada.");
      if (res.batch_id) void pollBatch(res.batch_id);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function pollBatch(batchId: string) {
    try {
      const res = await apiGet<CrmImportBatchDto>(
        `/api/saas/crm/contatos/importar/${batchId}`,
      );
      setBatch(res);
      if (res.status === "pendente" || res.status === "processando") {
        window.setTimeout(() => void pollBatch(batchId), 1500);
      }
    } catch {
      /* keep last known */
    }
  }

  return (
    <SaasPage
      title={COPY.crm.nav_importar_contatos}
      actions={
        <Button type="button" variant="outline" asChild>
          <Link href="/saas/contatos">{COPY.crm.contatos_title}</Link>
        </Button>
      }
    >
      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>{COPY.crm.contatos_import}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            CSV com até 5.000 linhas. Colunas esperadas: nome, phone_e164, email (opcional).
          </p>
          <div>
            <Label htmlFor="csv">Arquivo CSV</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              className="mt-1"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!file || busy}
              onClick={() => void onPreview()}
            >
              {COPY.crm.contatos_import_preview}
            </Button>
            <Button type="button" disabled={!file || busy} onClick={() => void onImport()}>
              {COPY.crm.contatos_import_run}
            </Button>
          </div>
          {preview.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {Object.keys(preview[0]!).map((k) => (
                      <th key={k} className="px-3 py-2 font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.keys(preview[0]!).map((k) => (
                        <td key={k} className="px-3 py-2">
                          {row[k] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {batch ? (
            <Alert>
              <AlertDescription>
                Lote {batch.batch_id}: {batch.status}
                {batch.stats
                  ? ` · criados ${batch.stats.created ?? 0}, atualizados ${batch.stats.updated ?? 0}, erros ${batch.stats.errors ?? batch.stats.failed ?? 0}`
                  : ""}
                {batch.last_error ? ` · ${batch.last_error}` : ""}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </SaasPage>
  );
}

export function ContatoMergeDialog({
  open,
  onOpenChange,
  survivorId,
  survivorNome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  survivorId: string;
  survivorNome: string;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<CrmContactDto[]>([]);
  const [loserId, setLoserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setLoadStatus("loading");
    try {
      setContacts(asPage<CrmContactDto>(await apiGet("/api/saas/crm/contatos")).items);
      setLoadStatus("ok");
    } catch {
      setLoadStatus("error");
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function onMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!loserId || loserId === survivorId) return;
    setBusy(true);
    try {
      const survivor = await apiSend<CrmContactDto>("/api/saas/crm/contatos/mesclar", "POST", {
        survivor_id: survivorId,
        loser_id: loserId,
      });
      toast.success("Contatos mesclados.");
      onOpenChange(false);
      router.push(`/saas/contatos/${survivor.id || survivorId}`);
      router.refresh();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{COPY.crm.contatos_merge}</DialogTitle>
        </DialogHeader>
        {loadStatus === "loading" ? (
          <TableSkeleton />
        ) : loadStatus === "error" ? (
          <ErrorState onRetry={() => void load()} />
        ) : (
          <form className="space-y-3" onSubmit={onMerge}>
            <p className="text-sm text-muted-foreground">
              {COPY.crm.contatos_survivor}: <strong>{survivorNome}</strong>
            </p>
            <div>
              <Label>{COPY.crm.contatos_loser}</Label>
              <Select value={loserId} onValueChange={setLoserId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    .filter((c) => c.id !== survivorId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.phone_e164 ? `(${c.phone_e164})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertDescription>
                Conversas e vínculos do contato descartado passam para o sobrevivente. O link de
                Cliente é preservado no sobrevivente.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy || !loserId}>
                {COPY.actions.confirmar}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
