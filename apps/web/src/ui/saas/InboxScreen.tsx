"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, type WhatsappIntent } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { SaasPage } from "../layout";
import { IntentBadge } from "../order-ui";
import { useSession } from "../session";
import { ErrorState, InboxSkeleton } from "../states";

const selectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const textareaClass =
  "border-input placeholder:text-muted-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

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
  const [intentHint, setIntentHint] = useState<WhatsappIntent>("outro");
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
        intent_hint: intentHint || null,
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
    <SaasPage
      title={COPY.inbox_title}
      actions={
        admin ? (
          <Button
            type="button"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => setSimOpen((o) => !o)}
          >
            {COPY.simulate_message}
          </Button>
        ) : null
      }
    >
      {note ? (
        <p className="mb-6 text-sm text-primary" role="status">
          {note}
        </p>
      ) : null}

      {simOpen ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.simulate_message}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSimulate}>
              <div>
                <Label htmlFor="phone_e164" className="mb-2">
                  {COPY.phone}
                </Label>
                <Input id="phone_e164" name="phone_e164" required placeholder="+5511999999999" />
              </div>
              <div>
                <Label htmlFor="body" className="mb-2">
                  {COPY.body}
                </Label>
                <textarea id="body" name="body" required rows={3} className={textareaClass} />
              </div>
              <div>
                <Label className="mb-2">{COPY.intent}</Label>
                <RadioGroup
                  value={intentHint}
                  onValueChange={(v) => setIntentHint(v as WhatsappIntent)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cadastro" id="hint-cad" />
                    <Label htmlFor="hint-cad">{COPY.intent_cadastro}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="orcamento" id="hint-orc" />
                    <Label htmlFor="hint-orc">{COPY.intent_orcamento}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="info_empresa" id="hint-info" />
                    <Label htmlFor="hint-info">{COPY.intent_info_empresa}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="outro" id="hint-outro" />
                    <Label htmlFor="hint-outro">{COPY.intent_outro}</Label>
                  </div>
                </RadioGroup>
              </div>
              {simError ? <p className="text-sm text-red-500">{simError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setSimOpen(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-white hover:bg-primary/90"
                  disabled={simBusy}
                >
                  {COPY.actions.confirmar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {status === "loading" ? (
        <InboxSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : threads.length === 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.inbox_title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{COPY.inbox_empty}</h3>
              <p className="mb-4 max-w-sm text-sm text-gray-500">
                Conversas do WhatsApp aparecerão aqui quando chegarem mensagens.
              </p>
              {admin ? (
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-primary/90"
                  onClick={() => setSimOpen(true)}
                >
                  {COPY.simulate_message}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className={cn("mb-8", params.id && "hidden lg:block")}>
            <CardHeader>
              <CardTitle>Conversas</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {threads.map((t) => {
                  const active = params.id === t.id;
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/saas/inbox/${t.id}`}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-md p-2 -mx-2 transition-colors hover:bg-gray-50",
                          active && "bg-gray-50",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{t.phone_e164}</p>
                          <p className="truncate text-sm text-gray-500">{threadPreview(t) || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-gray-500">{formatDate(t.updated_at)}</p>
                          <div className="mt-1">
                            <IntentBadge intent={t.intent as WhatsappIntent | null} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className={cn("mb-8", !params.id && "hidden lg:block")}>
            <CardHeader>
              <CardTitle>
                {detail?.phone_e164 ?? "Detalhe"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!params.id ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Selecione uma conversa</h3>
                  <p className="max-w-sm text-sm text-gray-500">
                    Escolha um thread à esquerda para ver as mensagens.
                  </p>
                </div>
              ) : !detail ? (
                <ErrorState message={COPY.not_found} />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" className="lg:hidden" asChild>
                      <Link href="/saas/inbox">← Voltar</Link>
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      {detail.cadastro_request_id ? (
                        <Link
                          href={`/saas/cadastros/${detail.cadastro_request_id}`}
                          className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-900"
                        >
                          Cadastro
                        </Link>
                      ) : null}
                      {detail.orcamento_id ? (
                        <Link
                          href={`/saas/orcamentos/${detail.orcamento_id}`}
                          className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-900"
                        >
                          Orçamento
                        </Link>
                      ) : null}
                    </div>
                    <select
                      className={cn(selectClass, "ml-auto w-[180px]")}
                      value={(detail.intent as string) ?? "none"}
                      onChange={(e) => void patchIntent(e.target.value as WhatsappIntent | "none")}
                      aria-label={COPY.intent}
                    >
                      <option value="none">—</option>
                      <option value="cadastro">{COPY.intent_cadastro}</option>
                      <option value="orcamento">{COPY.intent_orcamento}</option>
                      <option value="info_empresa">{COPY.intent_info_empresa}</option>
                      <option value="outro">{COPY.intent_outro}</option>
                    </select>
                  </div>
                  <ul className="space-y-4">
                    {detail.messages.map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          "rounded-md border border-gray-200 px-3 py-2 text-sm",
                          m.direction === "inbound" ? "bg-gray-50" : "bg-primary/5",
                        )}
                      >
                        <p className="text-gray-900">{m.body}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(m.created_at)}
                          {m.simulated ? " · simulado" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SaasPage>
  );
}
