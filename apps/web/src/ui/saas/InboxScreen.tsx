"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, type WhatsappIntent } from "@saas-frota/shared";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  apiGet,
  apiSend,
  asPage,
  isApiError,
  threadPreview,
  type InboxThreadDetailDto,
  type InboxThreadDto,
} from "../api";
import { COPY } from "../copy";
import { formatDate } from "../format";
import { SaasMain, ListHeader } from "../layout";
import { IntentBadge } from "../order-ui";
import { useSession } from "../session";
import { EmptyState, ErrorState, InboxSkeleton } from "../states";

export function InboxScreen() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [threads, setThreads] = useState<InboxThreadDto[]>([]);
  const [detail, setDetail] = useState<InboxThreadDetailDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [simOpen, setSimOpen] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const page = asPage<InboxThreadDto>(await apiGet("/api/saas/inbox"));
      setThreads(page.items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await apiGet<InboxThreadDetailDto>(`/api/saas/inbox/${id}`));
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (params.id) void loadDetail(params.id);
    else setDetail(null);
  }, [params.id, loadDetail]);

  async function onSimulate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSimBusy(true);
    setSimError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const thread = await apiSend<InboxThreadDetailDto>("/api/saas/inbox/simular", "POST", {
        phone_e164: fd.get("phone_e164"),
        body: fd.get("body"),
        intent_hint: fd.get("intent_hint") || null,
      });
      setSimOpen(false);
      await load();
      router.push(`/saas/inbox/${thread.id}`);
      setNote(COPY.simulate_ok);
    } catch (err) {
      setSimError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setSimBusy(false);
    }
  }

  async function patchIntent(intent: WhatsappIntent | "none") {
    if (!detail) return;
    const next = intent === "none" ? null : intent;
    const updated = await apiSend<InboxThreadDetailDto>(`/api/saas/inbox/${detail.id}`, "PATCH", {
      intent: next,
    });
    setDetail(updated);
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? { ...t, intent: updated.intent } : t)));
    setNote(COPY.outbox_stub_note);
  }

  return (
    <SaasMain className="max-w-none px-0 md:px-0 md:py-0">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <ListHeader
          title={COPY.inbox_title}
          actions={
            admin ? (
              <Dialog open={simOpen} onOpenChange={setSimOpen}>
                <DialogTrigger asChild>
                  <Button type="button">{COPY.simulate_message}</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={onSimulate}>
                    <DialogHeader>
                      <DialogTitle>{COPY.simulate_message}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-3">
                      <Field>
                        <FieldLabel htmlFor="phone_e164">{COPY.phone}</FieldLabel>
                        <Input id="phone_e164" name="phone_e164" required placeholder="+5511999999999" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="body">{COPY.body}</FieldLabel>
                        <Textarea id="body" name="body" required rows={3} />
                      </Field>
                      <Field>
                        <FieldLabel>{COPY.intent}</FieldLabel>
                        <Select name="intent_hint" defaultValue="outro">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cadastro">{COPY.intent_cadastro}</SelectItem>
                            <SelectItem value="orcamento">{COPY.intent_orcamento}</SelectItem>
                            <SelectItem value="info_empresa">{COPY.intent_info_empresa}</SelectItem>
                            <SelectItem value="outro">{COPY.intent_outro}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      {simError ? <p className="text-sm text-destructive">{simError}</p> : null}
                    </div>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setSimOpen(false)}>
                        {COPY.actions.cancelar}
                      </Button>
                      <Button type="submit" disabled={simBusy}>
                        {COPY.actions.confirmar}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />
        {note ? (
          <p className="text-sm text-[var(--brand-accent)]" role="status">
            {note}
          </p>
        ) : null}
      </div>

      {status === "loading" ? (
        <InboxSkeleton />
      ) : status === "error" ? (
        <div className="p-6">
          <ErrorState onRetry={() => void load()} />
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          title={COPY.inbox_empty}
          art="inbox"
          action={
            admin ? (
              <Button type="button" onClick={() => setSimOpen(true)}>
                {COPY.simulate_message}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid min-h-[calc(100dvh-8rem)] md:grid-cols-[360px_1fr]">
          <ScrollArea className={cn("border-b border-border md:border-r md:border-b-0", params.id && "hidden md:block")}>
            <ul>
              {threads.map((t) => {
                const active = params.id === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/saas/inbox/${t.id}`}
                      className={cn(
                        "block border-b border-border px-4 py-3 transition-colors hover:bg-muted/60",
                        active && "bg-sidebar-accent",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.phone_e164}</p>
                          <p className="truncate text-xs text-muted-foreground">{threadPreview(t) || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-muted-foreground">{formatDate(t.updated_at)}</p>
                          <div className="mt-1">
                            <IntentBadge intent={t.intent as WhatsappIntent | null} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>

          <div className={cn("flex flex-col", !params.id && "hidden md:flex")}>
            {!params.id ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Selecione uma conversa
              </div>
            ) : !detail ? (
              <div className="p-6">
                <ErrorState message={COPY.not_found} />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                  <Button variant="ghost" size="sm" className="md:hidden" asChild>
                    <Link href="/saas/inbox">←</Link>
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{detail.phone_e164}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {detail.cadastro_request_id ? (
                        <Link href={`/saas/cadastros/${detail.cadastro_request_id}`}>
                          <Badge variant="outline">Cadastro</Badge>
                        </Link>
                      ) : null}
                      {detail.orcamento_id ? (
                        <Link href={`/saas/orcamentos/${detail.orcamento_id}`}>
                          <Badge variant="outline">Orçamento</Badge>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <Select
                    value={(detail.intent as string) ?? "none"}
                    onValueChange={(v) => void patchIntent(v as WhatsappIntent | "none")}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={COPY.intent} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="cadastro">{COPY.intent_cadastro}</SelectItem>
                      <SelectItem value="orcamento">{COPY.intent_orcamento}</SelectItem>
                      <SelectItem value="info_empresa">{COPY.intent_info_empresa}</SelectItem>
                      <SelectItem value="outro">{COPY.intent_outro}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="flex-1 px-4 py-4">
                  <div className="mx-auto flex max-w-2xl flex-col gap-3">
                    {detail.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-md px-3 py-2 text-sm",
                          m.direction === "inbound" ? "self-start bg-muted" : "self-end bg-primary/10",
                        )}
                      >
                        <p>{m.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDate(m.created_at)}
                          {m.simulated ? " · simulado" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      )}
    </SaasMain>
  );
}
