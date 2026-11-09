"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError, maskFromLast4 } from "../../api";
import { COPY } from "../../copy";
import type { CrmContactDto, CrmEmpresaDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function EmpresasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CrmEmpresaDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      setItems(asPage<CrmEmpresaDto>(await apiGet(`/api/saas/crm/empresas${qs}`)).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiSend<CrmEmpresaDto>("/api/saas/crm/empresas", "POST", {
        razao_social: fd.get("razao_social"),
        nome_fantasia: fd.get("nome_fantasia") || null,
        cnpj_digits: String(fd.get("cnpj") || "").replace(/\D/g, ""),
      });
      setCreateOpen(false);
      router.push(`/saas/empresas/${created.id}`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.empresas_title}
      actions={
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {COPY.crm.empresa_nova}
        </Button>
      }
    >
      <div className="mb-4">
        <Input
          placeholder={COPY.crm.search_placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.crm.empresas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.empresas_empty}</h3>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  {COPY.crm.empresa_nova}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => router.push(`/saas/empresas/${e.id}`)}
                    >
                      <p className="font-medium text-gray-900">{e.razao_social}</p>
                      <p className="text-sm text-muted-foreground">
                        {maskFromLast4(e.cnpj_last4)}
                        {e.nome_fantasia ? ` · ${e.nome_fantasia}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.crm.empresa_nova}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="razao_social">{COPY.razao_social}</Label>
              <Input id="razao_social" name="razao_social" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nome_fantasia">{COPY.nome_fantasia}</Label>
              <Input id="nome_fantasia" name="nome_fantasia" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cnpj">{COPY.cnpj}</Label>
              <Input id="cnpj" name="cnpj" required className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy}>
                {COPY.actions.criar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}

export function EmpresaDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<CrmEmpresaDto | null>(null);
  const [contacts, setContacts] = useState<CrmContactDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItem(await apiGet<CrmEmpresaDto>(`/api/saas/crm/empresas/${id}`));
      setContacts(
        await apiGet(`/api/saas/crm/contatos?company_id=${encodeURIComponent(id)}`)
          .then((d) => asPage<CrmContactDto>(d).items)
          .catch(() => []),
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.empresas_title}>
        <TableSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.crm.empresas_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage title={item.razao_social}>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/saas/empresas">{COPY.crm.empresas_title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.razao_social}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>CNPJ: {maskFromLast4(item.cnpj_last4)}</p>
          <p>Nome fantasia: {item.nome_fantasia || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{COPY.crm.contatos_title}</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{COPY.crm.contatos_empty}</p>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link href={`/saas/contatos/${c.id}`} className="text-primary hover:underline">
                    {c.nome}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
