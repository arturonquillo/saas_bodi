"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { displayLabelTitle } from "../../crm/labels";
import type { CrmContactDto, CrmConversationDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function initials(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ContatosListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CrmContactDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      setItems(asPage<CrmContactDto>(await apiGet(`/api/saas/crm/contatos${qs}`)).items);
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
      const created = await apiSend<CrmContactDto>("/api/saas/crm/contatos", "POST", {
        nome: fd.get("nome"),
        phone_e164: fd.get("phone_e164") || null,
        email: fd.get("email") || null,
      });
      setCreateOpen(false);
      router.push(`/saas/contatos/${created.id}`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.contatos_title}
      actions={
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {COPY.crm.contato_novo}
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
            <CardTitle>{COPY.crm.contatos_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.contatos_empty}</h3>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  {COPY.crm.contato_novo}
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left hover:bg-gray-50 rounded-md p-2 -mx-2"
                      onClick={() => router.push(`/saas/contatos/${c.id}`)}
                    >
                      <Avatar className="size-9">
                        <AvatarFallback>{initials(c.nome || "?")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">{c.nome}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {c.phone_e164 || c.email || "—"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(c.labels ?? []).slice(0, 2).map((l) => (
                          <Badge key={l.id} variant="outline" className="text-[10px]">
                            {displayLabelTitle(l.title)}
                          </Badge>
                        ))}
                      </div>
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
            <DialogTitle>{COPY.crm.contato_novo}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="nome">{COPY.nome}</Label>
              <Input id="nome" name="nome" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone_e164">{COPY.phone}</Label>
              <Input id="phone_e164" name="phone_e164" className="mt-1" placeholder="+55…" />
            </div>
            <div>
              <Label htmlFor="email">{COPY.email}</Label>
              <Input id="email" name="email" type="email" className="mt-1" />
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

export function ContatoDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CrmContactDto | null>(null);
  const [threads, setThreads] = useState<CrmConversationDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [note, setNote] = useState("");
  const [convOpen, setConvOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const contact = await apiGet<CrmContactDto>(`/api/saas/crm/contatos/${id}`);
      setItem(contact);
      const convs = await apiGet(`/api/saas/crm/conversas?contact_id=${encodeURIComponent(id)}`)
        .then((d) => asPage<CrmConversationDto>(d).items)
        .catch(() => [] as CrmConversationDto[]);
      setThreads(convs);
      setInboxes(
        await apiGet("/api/saas/crm/inboxes")
          .then((d) => asPage<CrmInboxDto>(d).items)
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

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/contatos/${id}/notas`, "POST", { nota: note.trim() });
      setNote("");
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function startConversation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiSend<CrmConversationDto>(
        `/api/saas/crm/contatos/${id}/conversas`,
        "POST",
        { inbox_id: fd.get("inbox_id"), content: fd.get("content") || undefined },
      );
      setConvOpen(false);
      router.push(`/saas/conversas/${created.id}`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.contatos_title}>
        <TableSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item) {
    return (
      <SaasPage title={COPY.crm.contatos_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={item.nome}
      actions={
        <Button type="button" onClick={() => setConvOpen(true)}>
          {COPY.crm.contato_nova_conversa}
        </Button>
      }
    >
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/saas/contatos">{COPY.crm.contatos_title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{item.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{COPY.phone}: </span>
              {item.phone_e164 || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{COPY.email}: </span>
              {item.email || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Empresa: </span>
              {item.company_id ? (
                <Link className="text-primary hover:underline" href={`/saas/empresas/${item.company_id}`}>
                  {item.company_nome || item.company_id}
                </Link>
              ) : (
                "—"
              )}
            </p>
            <Separator />
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Comércio
            </p>
            {item.cliente_id ? (
              <p>Cliente: {item.cliente_id}</p>
            ) : (
              <p className="text-muted-foreground">{COPY.crm.commerce_gate}</p>
            )}
            {item.cadastro_request_id ? (
              <Link className="text-primary hover:underline" href={`/saas/cadastros/${item.cadastro_request_id}`}>
                Cadastro
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.conversas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.crm.conversas_empty}</p>
            ) : (
              <ul className="space-y-3">
                {threads.map((t) => (
                  <li key={t.id}>
                    <Link href={`/saas/conversas/${t.id}`} className="text-sm text-primary hover:underline">
                      {t.preview || t.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            {item.notas ? <p className="mb-4 whitespace-pre-wrap text-sm">{item.notas}</p> : null}
            <form className="space-y-2" onSubmit={saveNote}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <Button type="submit" disabled={busy || !note.trim()}>
                {COPY.actions.salvar}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={convOpen} onOpenChange={setConvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.crm.contato_nova_conversa}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={startConversation}>
            <div>
              <Label htmlFor="inbox_id">Caixa</Label>
              <select
                id="inbox_id"
                name="inbox_id"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {inboxes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="content">{COPY.body}</Label>
              <Textarea id="content" name="content" rows={3} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConvOpen(false)}>
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
