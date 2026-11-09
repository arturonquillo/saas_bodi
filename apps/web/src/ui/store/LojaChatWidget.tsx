"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, asPage, isApiError, type LojaConfigDto } from "../api";
import { COPY } from "../copy";
import type {
  PreChatField,
  WidgetBootstrapDto,
  WidgetMessageDto,
  WidgetSessionDto,
} from "../crm/types";

const SESSION_KEY = "casa_widget_session_token";

function sessionHeaders(token: string | null): HeadersInit {
  if (!token) return { accept: "application/json", "content-type": "application/json" };
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-widget-session": token,
  };
}

async function widgetFetch<T>(
  path: string,
  init?: RequestInit & { session?: string | null },
): Promise<T> {
  const { session, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    credentials: "include",
    headers: {
      ...sessionHeaders(session ?? null),
      ...rest.headers,
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw Object.assign(new Error(err?.message ?? "Falha no widget"), {
      status: res.status,
      code: err?.code,
    });
  }
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export function LojaChatWidget() {
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<WidgetBootstrapDto | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [preChatDone, setPreChatDone] = useState(false);
  const [preChatValues, setPreChatValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<WidgetMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("website_token")
        : null;
    void apiGet<LojaConfigDto>("/api/loja/config?tenant=casa-dos-frios")
      .then((cfg) => {
        const t = fromQuery || cfg.widget_website_token || null;
        if (t) setToken(t);
        else setUnavailable(true);
      })
      .catch(() => {
        if (fromQuery) setToken(fromQuery);
        else setUnavailable(true);
      });
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSessionToken(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const applyBootstrap = useCallback((data: WidgetBootstrapDto) => {
    setBootstrap(data);
    setUnavailable(false);
    setError(null);
    const fields = data.pre_chat_fields ?? [];
    setPreChatValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (next[f.name] === undefined) next[f.name] = "";
      }
      return next;
    });
  }, []);

  const loadBootstrap = useCallback(
    async (websiteToken: string) => {
      try {
        const data = await widgetFetch<WidgetBootstrapDto>(
          `/api/loja/widget/bootstrap?website_token=${encodeURIComponent(websiteToken)}`,
        );
        applyBootstrap(data);
      } catch {
        // UI preview until Phase D backend seed exposes widget_website_token.
        if (websiteToken.startsWith("preview-") || websiteToken === "demo") {
          applyBootstrap({
            inbox_id: "preview",
            greeting: "Olá! Como podemos ajudar?",
            welcome_title: "Casa dos Frios",
            widget_color: "#7A1F1F",
            nome_fantasia: "Casa dos Frios",
            pre_chat_fields: [
              { name: "nome", type: "text", label_pt: "Nome", required: true },
              { name: "email", type: "email", label_pt: "E-mail", required: false },
              { name: "empresa", type: "text", label_pt: "Empresa", required: false },
            ],
            campaigns: [
              {
                id: "preview-campaign",
                title: "Novidades da semana",
                message: "Peça picanha com entrega programada.",
              },
            ],
          });
          return;
        }
        setUnavailable(true);
        setError(COPY.crm.loja_widget_offline);
      }
    },
    [applyBootstrap],
  );

  useEffect(() => {
    if (token) void loadBootstrap(token);
  }, [token, loadBootstrap]);

  const ensureSession = useCallback(async () => {
    if (sessionToken) return sessionToken;
    if (!token) throw new Error("missing token");
    const created = await widgetFetch<WidgetSessionDto>("/api/loja/widget/sessao", {
      method: "POST",
      body: JSON.stringify({ website_token: token }),
    });
    setSessionToken(created.session_token);
    try {
      localStorage.setItem(SESSION_KEY, created.session_token);
    } catch {
      /* ignore */
    }
    return created.session_token;
  }, [sessionToken, token]);

  const loadMessages = useCallback(async (sess: string) => {
    try {
      const page = asPage<WidgetMessageDto>(
        await widgetFetch<unknown>(`/api/loja/widget/mensagens`, { session: sess }),
      );
      setMessages(page.items);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    if (!open || !sessionToken || !preChatDone) return;
    void loadMessages(sessionToken);
    pollRef.current = setInterval(() => void loadMessages(sessionToken), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, sessionToken, preChatDone, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || !sessionToken) return;
    void widgetFetch<{ conversation?: { id?: string } | null }>("/api/loja/widget/conversa", {
      session: sessionToken,
    })
      .then((c) => {
        if (c?.conversation?.id) setPreChatDone(true);
      })
      .catch(() => {
        /* need pre-chat */
      });
  }, [open, sessionToken]);

  const fields: PreChatField[] = bootstrap?.pre_chat_fields ?? [];
  const needsPreChat = fields.some((f) => f.required) && !preChatDone;

  async function submitPreChat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sess = await ensureSession();
      await widgetFetch("/api/loja/widget/pre-chat", {
        method: "POST",
        session: sess,
        body: JSON.stringify({ fields: preChatValues }),
      });
      setPreChatDone(true);
      await loadMessages(sess);
    } catch (err) {
      setError(isApiError(err) ? err.message : err instanceof Error ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const sess = await ensureSession();
      if (needsPreChat) {
        setError("Complete o pré-chat antes de enviar.");
        return;
      }
      await widgetFetch("/api/loja/widget/mensagens", {
        method: "POST",
        session: sess,
        body: JSON.stringify({ content: draft.trim(), content_type: "text" }),
      });
      setDraft("");
      setPreChatDone(true);
      await loadMessages(sess);
    } catch (err) {
      setError(isApiError(err) ? err.message : err instanceof Error ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (unavailable || !token) return null;

  const color = bootstrap?.widget_color || "var(--brand-accent, #C4A35A)";
  const title = bootstrap?.welcome_title || bootstrap?.nome_fantasia || "Chat";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="pointer-events-auto flex h-[min(520px,70vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
          role="dialog"
          aria-label={title}
        >
          <header
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: color }}
          >
            <div>
              <p className="text-sm font-semibold">{title}</p>
              {bootstrap?.greeting ? (
                <p className="text-xs opacity-90">{bootstrap.greeting}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label={COPY.crm.loja_widget_close}
            >
              <X className="size-4" />
            </Button>
          </header>

          {(bootstrap?.campaigns ?? []).length > 0 ? (
            <div className="border-b border-border bg-muted/40 px-3 py-2">
              {(bootstrap?.campaigns ?? []).slice(0, 1).map((c) => (
                <p key={c.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{COPY.crm.loja_widget_campaign}: </span>
                  {c.message || c.title}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {needsPreChat ? (
              <form className="space-y-3" onSubmit={submitPreChat}>
                <p className="text-sm font-medium">{COPY.crm.loja_widget_prechat}</p>
                {fields.map((f) => (
                  <div key={f.name}>
                    <Label htmlFor={`w_${f.name}`}>
                      {f.label_pt}
                      {f.required ? " *" : ""}
                    </Label>
                    <Input
                      id={`w_${f.name}`}
                      type={f.type === "email" ? "email" : "text"}
                      className="mt-1"
                      required={f.required}
                      value={preChatValues[f.name] ?? ""}
                      onChange={(e) =>
                        setPreChatValues((prev) => ({ ...prev, [f.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                <Button type="submit" disabled={busy} className="w-full">
                  {COPY.crm.loja_widget_start}
                </Button>
              </form>
            ) : (
              <>
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    {bootstrap?.greeting || "Envie uma mensagem para começar."}
                  </p>
                ) : (
                  messages.map((m) => {
                    const incoming = m.message_type === "incoming";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${incoming ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            incoming
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {!needsPreChat ? (
            <form className="border-t border-border p-3" onSubmit={sendMessage}>
              {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Textarea
                  rows={1}
                  className="min-h-9 resize-none"
                  placeholder={COPY.crm.loja_widget_placeholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button type="submit" disabled={busy || !draft.trim()}>
                  {COPY.crm.loja_widget_send}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="pointer-events-auto h-12 rounded-full px-4 shadow-md animate-in fade-in zoom-in-95 duration-500"
        style={{ background: color, color: "#fff" }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? COPY.crm.loja_widget_close : COPY.crm.loja_widget_open}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        <span className="ml-2 text-sm font-medium">
          {open ? COPY.crm.loja_widget_close : COPY.crm.loja_widget_open}
        </span>
      </Button>
    </div>
  );
}
