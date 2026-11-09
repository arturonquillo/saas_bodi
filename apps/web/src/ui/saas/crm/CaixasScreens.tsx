"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiGet, apiSend, asPage, isApiError, type UserDto } from "../../api";
import { COPY } from "../../copy";
import { connectionBadgeClass, connectionLabel } from "../../crm/labels";
import {
  CHANNEL_TYPES_D,
  channelStubAlert,
  channelTypeLabel,
  createCaixa,
  defaultPreChatFields,
  getCaixa,
  getCanal,
  getWidgetConfig,
  getWidgetSnippet,
  isWidgetChannel,
  listCaixas,
  patchCaixa,
  putCanal,
  putWidgetConfig,
  rotateCanalToken,
  simulateCanal,
} from "../../crm/phase-d";
import type {
  ChannelTypeD,
  CrmCanalDto,
  CrmInboxDto,
  CrmTemplateDto,
  CrmWidgetConfigDto,
  PreChatField,
} from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function SecretsBlock({
  present,
  changeSecrets,
  onChangeSecrets,
  fields,
}: {
  present?: boolean;
  changeSecrets: boolean;
  onChangeSecrets: (v: boolean) => void;
  fields: Array<{ id: string; name: string; label: string }>;
}) {
  if (present && !changeSecrets) {
    return (
      <div className="flex items-center gap-3">
        <Input type="password" value="••••••••••••" readOnly autoComplete="off" />
        <Button type="button" variant="outline" onClick={() => onChangeSecrets(true)}>
          {COPY.crm.canal_secrets_change}
        </Button>
      </div>
    );
  }
  return (
    <>
      {fields.map((f) => (
        <div key={f.id}>
          <Label htmlFor={f.id}>{f.label}</Label>
          <Input id={f.id} name={f.name} type="password" className="mt-1" autoComplete="off" />
        </div>
      ))}
    </>
  );
}

export function CaixasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<ChannelTypeD>("whatsapp");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems((await listCaixas()).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await createCaixa({ name: name.trim(), channel_type: channelType });
      toast.success(COPY.crm.caixa_created);
      setOpen(false);
      setName("");
      setChannelType("whatsapp");
      router.push(`/saas/crm/caixas/${created.id}/canal`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.caixas_title}
      actions={
        <Button type="button" onClick={() => setOpen(true)}>
          {COPY.crm.caixa_create}
        </Button>
      }
    >
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.crm.caixas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma caixa.</p>
            ) : (
              <ul className="space-y-4">
                {items.map((inbox) => (
                  <li key={inbox.id} className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => router.push(`/saas/crm/caixas/${inbox.id}`)}
                    >
                      <p className="font-medium text-gray-900">{inbox.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {inbox.member_count ?? 0} membros
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{channelTypeLabel(inbox.channel_type)}</Badge>
                      {inbox.connection_status ? (
                        <Badge
                          variant="outline"
                          className={connectionBadgeClass(inbox.connection_status)}
                        >
                          {connectionLabel(inbox.connection_status)}
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.crm.caixa_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onCreate}>
            <div>
              <Label htmlFor="caixa_name">Nome</Label>
              <Input
                id="caixa_name"
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{COPY.crm.caixa_channel_type}</Label>
              <Select value={channelType} onValueChange={(v) => setChannelType(v as ChannelTypeD)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES_D.map((t) => (
                    <SelectItem key={t} value={t}>
                      {channelTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertDescription>{channelStubAlert(channelType)}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

export function CaixaDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const onCanalRoute = Boolean(pathname?.endsWith("/canal"));
  const [activeTab, setActiveTab] = useState(onCanalRoute ? "canal" : "geral");
  const [inbox, setInbox] = useState<CrmInboxDto | null>(null);
  const [channel, setChannel] = useState<CrmCanalDto | null>(null);
  const [widget, setWidget] = useState<CrmWidgetConfigDto | null>(null);
  const [snippet, setSnippet] = useState<string>("");
  const [templates, setTemplates] = useState<CrmTemplateDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [changeSecrets, setChangeSecrets] = useState(false);
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);
  const [simBody, setSimBody] = useState("");
  const [simPhone, setSimPhone] = useState("+5511999990000");
  const [flags, setFlags] = useState({
    csat_enabled: false,
    allow_auto_assign: false,
    lock_to_single_conversation: false,
  });
  const [preChat, setPreChat] = useState<PreChatField[]>(defaultPreChatFields());
  const [originsText, setOriginsText] = useState("http://localhost:3000");
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [widgetColor, setWidgetColor] = useState("#7A1F1F");
  const [continuity, setContinuity] = useState<"session" | "contact">("session");
  const [emailProvider, setEmailProvider] = useState("smtp_imap");
  const [smsProvider, setSmsProvider] = useState("twilio");

  useEffect(() => {
    if (onCanalRoute) setActiveTab("canal");
    else setActiveTab((t) => (t === "canal" ? "geral" : t));
  }, [onCanalRoute]);

  const channelType = inbox?.channel_type ?? channel?.channel_type ?? "whatsapp";
  const showWidgetTab = isWidgetChannel(channelType);

  useEffect(() => {
    if (channel?.provider) {
      if (channelType === "email") setEmailProvider(String(channel.provider));
      if (channelType === "sms") setSmsProvider(String(channel.provider));
    }
  }, [channel?.provider, channelType]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const box = await getCaixa(id);
      setInbox(box);
      setFlags({
        csat_enabled: Boolean(box.csat_enabled),
        allow_auto_assign: Boolean(box.allow_auto_assign),
        lock_to_single_conversation: Boolean(box.lock_to_single_conversation),
      });
      const canal = await getCanal(id);
      setChannel(canal);
      if (box.channel_type === "whatsapp" || canal?.channel_type === "whatsapp") {
        const tpl = await apiGet<CrmTemplateDto[] | { items: CrmTemplateDto[] }>(
          `/api/saas/crm/inboxes/${id}/templates`,
        ).catch(() => [] as CrmTemplateDto[]);
        setTemplates(Array.isArray(tpl) ? tpl : (tpl.items ?? []));
      } else {
        setTemplates([]);
      }
      if (isWidgetChannel(box.channel_type)) {
        const w = await getWidgetConfig(id).catch(() => null);
        if (w) {
          setWidget(w);
          const fields = (w.pre_chat_fields ?? []) as PreChatField[];
          setPreChat(fields.length ? fields : defaultPreChatFields());
          setOriginsText((w.allowed_origins ?? []).join("\n") || "http://localhost:3000");
          setWelcomeTitle(w.welcome_title ?? "");
          setWidgetColor(w.widget_color ?? "#7A1F1F");
          setContinuity(w.continuity === "contact" ? "contact" : "session");
        }
        const sn = await getWidgetSnippet(id).catch(() => null);
        setSnippet(sn?.snippet ?? sn?.snippet_html ?? sn?.snippet_js ?? "");
      } else {
        setWidget(null);
        setSnippet("");
      }
      const members = await apiGet<{ user_ids?: string[] } | string[]>(
        `/api/saas/crm/inboxes/${id}/members`,
      ).catch(() => ({ user_ids: [] as string[] }));
      setMemberIds(Array.isArray(members) ? members : (members.user_ids ?? []));
      setUsers(asPage<UserDto>(await apiGet("/api/saas/usuarios")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabList = useMemo(() => {
    const tabs = [
      { value: "geral", label: "Geral" },
      { value: "membros", label: COPY.crm.caixa_members },
      { value: "canal", label: COPY.crm.canal_title },
    ];
    if (showWidgetTab) tabs.push({ value: "widget", label: COPY.crm.widget_tab });
    return tabs;
  }, [showWidgetTab]);

  async function saveGeral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await patchCaixa(id, {
        greeting: fd.get("greeting") || null,
        ooo_message: fd.get("ooo_message") || null,
        ...flags,
      });
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function saveMembers() {
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/inboxes/${id}/members`, "PUT", { user_ids: memberIds });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  function secretPayload(fd: FormData, keys: string[]) {
    const body: Record<string, unknown> = {};
    if (changeSecrets || !channel?.secrets_present) {
      for (const k of keys) {
        const v = fd.get(k);
        if (v) body[k] = v;
      }
    } else {
      for (const k of keys) body[k] = "__unchanged__";
    }
    return body;
  }

  async function saveChannel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const type = channelType;
    let body: Record<string, unknown> = {};

    if (type === "whatsapp") {
      body = {
        phone_e164_display: fd.get("phone_e164_display") || null,
        phone_number_id: fd.get("phone_number_id") || null,
        business_account_id: fd.get("business_account_id") || null,
        provider: fd.get("provider") || "whatsapp_cloud",
        ...secretPayload(fd, ["api_token", "api_secret", "webhook_verify_token"]),
      };
    } else if (type === "email") {
      body = {
        provider: emailProvider || "smtp_imap",
        forward_to_email: fd.get("forward_to_email") || null,
        from_email_display: fd.get("from_email_display") || null,
        email_template_id: fd.get("email_template_id") || null,
                        ...secretPayload(fd, ["imap_password", "smtp_password", "oauth_token"]),
      };
    } else if (type === "sms") {
      body = {
        provider: smsProvider || "twilio",
        from_number_display: fd.get("from_number_display") || null,
        ...secretPayload(fd, ["account_sid", "auth_token"]),
      };
    } else if (type === "api") {
      body = {
        callback_url: fd.get("callback_url") || null,
      };
    } else if (type === "web_widget") {
      body = {
        connection_status: channel?.connection_status ?? "not_configured",
      };
    } else {
      body = {
        provider: type,
        external_page_or_bot_id: fd.get("external_page_or_bot_id") || null,
        ...secretPayload(fd, ["access_token", "page_token", "bot_token"]),
      };
    }

    try {
      const saved = await putCanal(id, body);
      setChannel(saved);
      setChangeSecrets(false);
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    setBusy(true);
    try {
      const saved = await putCanal(id, { connection_status: "ready_stub" });
      setChannel(saved);
      toast.success(COPY.crm.canal_ready_stub);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplates() {
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/inboxes/${id}/templates`, "PUT", { templates });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onRotateToken() {
    setBusy(true);
    try {
      const res = await rotateCanalToken(id);
      const token =
        res.website_token ?? res.api_access_token ?? res.token ?? null;
      setRotatedToken(token);
      toast.success(COPY.crm.canal_token_once);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onSimulate() {
    setBusy(true);
    try {
      await simulateCanal(id, {
        phone_e164: simPhone || undefined,
        body: simBody || "Mensagem simulada",
        content: simBody || "Mensagem simulada",
      });
      toast.success("Inbound simulado.");
      setSimBody("");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function saveWidget(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await putWidgetConfig(id, {
        pre_chat_fields: preChat.filter((f) => f.name.trim()),
        allowed_origins: originsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        welcome_title: welcomeTitle || null,
        widget_color: widgetColor || null,
        continuity,
      });
      setWidget(saved);
      const sn = await getWidgetSnippet(id).catch(() => null);
      setSnippet(sn?.snippet ?? sn?.snippet_html ?? sn?.snippet_js ?? "");
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function copySnippet() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success(COPY.crm.widget_snippet_copied);
    } catch {
      toast.error(COPY.save_fail);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.caixas_title}>
        <TableSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !inbox) {
    return (
      <SaasPage title={COPY.crm.caixas_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  const conn = channel?.connection_status ?? inbox.connection_status;

  return (
    <SaasPage
      title={inbox.name}
      actions={
        <Button type="button" variant="outline" asChild>
          <Link href={`/saas/crm/caixas/${id}/canal`}>{COPY.crm.canal_title}</Link>
        </Button>
      }
    >
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/saas/crm/caixas">{COPY.crm.caixas_title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{inbox.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "canal") {
            router.replace(`/saas/crm/caixas/${id}/canal`);
          } else if (onCanalRoute) {
            router.replace(`/saas/crm/caixas/${id}`);
          }
        }}
      >
        <TabsList>
          {tabList.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={saveGeral}>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{channelTypeLabel(channelType)}</Badge>
                  {conn ? (
                    <Badge variant="outline" className={connectionBadgeClass(conn)}>
                      {connectionLabel(conn)}
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="greeting">Saudação</Label>
                  <Textarea
                    id="greeting"
                    name="greeting"
                    defaultValue={inbox.greeting ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="ooo_message">Fora do horário</Label>
                  <Textarea
                    id="ooo_message"
                    name="ooo_message"
                    defaultValue={inbox.ooo_message ?? ""}
                    className="mt-1"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={flags.csat_enabled}
                    onCheckedChange={(v) => setFlags((f) => ({ ...f, csat_enabled: Boolean(v) }))}
                  />
                  CSAT
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={flags.allow_auto_assign}
                    onCheckedChange={(v) =>
                      setFlags((f) => ({ ...f, allow_auto_assign: Boolean(v) }))
                    }
                  />
                  Autoatribuir
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={flags.lock_to_single_conversation}
                    onCheckedChange={(v) =>
                      setFlags((f) => ({ ...f, lock_to_single_conversation: Boolean(v) }))
                    }
                  />
                  Uma conversa por contato
                </label>
                <Button type="submit" disabled={busy}>
                  {COPY.actions.salvar}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membros" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{COPY.crm.caixa_members}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {users
                .filter((u) => u.saas_role)
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={memberIds.includes(u.id)}
                      onCheckedChange={(v) => {
                        setMemberIds((prev) =>
                          v ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                        );
                      }}
                    />
                    {u.nome || u.email}
                  </label>
                ))}
              <Button type="button" disabled={busy} onClick={() => void saveMembers()}>
                {COPY.actions.salvar}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canal" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{channelTypeLabel(channelType)}</Badge>
            <Badge variant="outline" className={connectionBadgeClass(conn)}>
              {connectionLabel(conn)}
            </Badge>
            {conn === "credentials_saved" || conn === "ready_stub" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy || conn === "ready_stub"}
                onClick={() => void markReady()}
              >
                {COPY.crm.canal_mark_ready}
              </Button>
            ) : null}
            {(channelType === "api" || channelType === "web_widget") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void onRotateToken()}
              >
                {COPY.crm.canal_rotate_token}
              </Button>
            )}
          </div>
          <Alert>
            <AlertDescription>{channelStubAlert(channelType)}</AlertDescription>
          </Alert>

          {rotatedToken ? (
            <Alert>
              <AlertTitle>{COPY.crm.canal_token_once}</AlertTitle>
              <AlertDescription>
                <code className="break-all text-xs">{rotatedToken}</code>
              </AlertDescription>
            </Alert>
          ) : null}

          {channelType === "api" && channel?.token_last4 ? (
            <p className="text-sm text-muted-foreground">
              Token atual: {channel.token_prefix ?? "…"}…{channel.token_last4}
            </p>
          ) : null}

          {channelType === "web_widget" && (widget?.website_token || channel?.website_token) ? (
            <p className="text-sm text-muted-foreground">
              website_token:{" "}
              <code className="text-xs">{widget?.website_token ?? channel?.website_token}</code>
            </p>
          ) : null}

          {channelType !== "web_widget" ? (
            <Card>
              <CardHeader>
                <CardTitle>Credenciais</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={saveChannel}>
                  {channelType === "whatsapp" ? (
                    <>
                      <div>
                        <Label htmlFor="phone_e164_display">{COPY.phone}</Label>
                        <Input
                          id="phone_e164_display"
                          name="phone_e164_display"
                          defaultValue={channel?.phone_e164_display ?? ""}
                          className="mt-1"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone_number_id">Phone number ID</Label>
                        <Input
                          id="phone_number_id"
                          name="phone_number_id"
                          defaultValue={channel?.phone_number_id ?? ""}
                          className="mt-1"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <Label htmlFor="business_account_id">Business account ID</Label>
                        <Input
                          id="business_account_id"
                          name="business_account_id"
                          defaultValue={channel?.business_account_id ?? ""}
                          className="mt-1"
                          autoComplete="off"
                        />
                      </div>
                      <SecretsBlock
                        present={channel?.secrets_present}
                        changeSecrets={changeSecrets}
                        onChangeSecrets={setChangeSecrets}
                        fields={[
                          { id: "api_token", name: "api_token", label: "API token" },
                          { id: "api_secret", name: "api_secret", label: "API secret" },
                          {
                            id: "webhook_verify_token",
                            name: "webhook_verify_token",
                            label: "Webhook verify token",
                          },
                        ]}
                      />
                      <input type="hidden" name="provider" value="whatsapp_cloud" />
                    </>
                  ) : null}

                  {channelType === "email" ? (
                    <>
                      <div>
                        <Label>Provedor</Label>
                        <Select value={emailProvider} onValueChange={setEmailProvider}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="smtp_imap">SMTP / IMAP</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="microsoft">Microsoft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="from_email_display">Remetente (exibição)</Label>
                        <Input
                          id="from_email_display"
                          name="from_email_display"
                          defaultValue={channel?.from_email_display ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="forward_to_email">Encaminhar para</Label>
                        <Input
                          id="forward_to_email"
                          name="forward_to_email"
                          defaultValue={channel?.forward_to_email ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email_template_id">Modelo de e-mail (id)</Label>
                        <Input
                          id="email_template_id"
                          name="email_template_id"
                          defaultValue={channel?.email_template_id ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <SecretsBlock
                        present={channel?.secrets_present}
                        changeSecrets={changeSecrets}
                        onChangeSecrets={setChangeSecrets}
                        fields={[
                          { id: "imap_password", name: "imap_password", label: "Senha IMAP" },
                          { id: "smtp_password", name: "smtp_password", label: "Senha SMTP" },
                          {
                            id: "oauth_token",
                            name: "oauth_token",
                            label: "OAuth token",
                          },
                        ]}
                      />
                    </>
                  ) : null}

                  {channelType === "sms" ? (
                    <>
                      <div>
                        <Label>Provedor</Label>
                        <Select value={smsProvider} onValueChange={setSmsProvider}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="bandwidth">Bandwidth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="from_number_display">Número de origem</Label>
                        <Input
                          id="from_number_display"
                          name="from_number_display"
                          defaultValue={channel?.from_number_display ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <SecretsBlock
                        present={channel?.secrets_present}
                        changeSecrets={changeSecrets}
                        onChangeSecrets={setChangeSecrets}
                        fields={[
                          { id: "account_sid", name: "account_sid", label: "Account SID" },
                          { id: "auth_token", name: "auth_token", label: "Auth token" },
                        ]}
                      />
                    </>
                  ) : null}

                  {channelType === "api" ? (
                    <div>
                      <Label htmlFor="callback_url">Callback URL (opcional)</Label>
                      <Input
                        id="callback_url"
                        name="callback_url"
                        defaultValue={channel?.callback_url ?? ""}
                        className="mt-1"
                        placeholder="https://…"
                      />
                    </div>
                  ) : null}

                  {![
                    "whatsapp",
                    "email",
                    "sms",
                    "api",
                    "web_widget",
                  ].includes(String(channelType)) ? (
                    <>
                      <div>
                        <Label htmlFor="external_page_or_bot_id">Page / bot ID</Label>
                        <Input
                          id="external_page_or_bot_id"
                          name="external_page_or_bot_id"
                          defaultValue={channel?.external_page_or_bot_id ?? ""}
                          className="mt-1"
                        />
                      </div>
                      <SecretsBlock
                        present={channel?.secrets_present}
                        changeSecrets={changeSecrets}
                        onChangeSecrets={setChangeSecrets}
                        fields={[
                          { id: "access_token", name: "access_token", label: "Access token" },
                          { id: "page_token", name: "page_token", label: "Page token" },
                          { id: "bot_token", name: "bot_token", label: "Bot token" },
                        ]}
                      />
                    </>
                  ) : null}

                  <Button type="submit" disabled={busy}>
                    {COPY.actions.salvar}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertDescription>
                Configure o widget na aba {COPY.crm.widget_tab}. Use rotacionar token para gerar um
                novo website_token.
              </AlertDescription>
            </Alert>
          )}

          {channelType === "whatsapp" ? (
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.canal_templates}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.map((t, idx) => (
                  <div key={`${t.key}-${idx}`} className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={t.key}
                      onChange={(e) => {
                        const next = [...templates];
                        next[idx] = { ...t, key: e.target.value };
                        setTemplates(next);
                      }}
                      placeholder="key"
                    />
                    <Textarea
                      value={t.body}
                      onChange={(e) => {
                        const next = [...templates];
                        next[idx] = { ...t, body: e.target.value };
                        setTemplates(next);
                      }}
                      rows={2}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTemplates((prev) => [...prev, { key: "", body: "" }])}
                  >
                    Adicionar modelo
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => void saveTemplates()}>
                    {COPY.actions.salvar}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {channelType !== "web_widget" ? (
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.canal_simulate}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelType === "whatsapp" || channelType === "sms" ? (
                  <div>
                    <Label htmlFor="sim_phone">Telefone E.164</Label>
                    <Input
                      id="sim_phone"
                      className="mt-1"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="sim_body">Mensagem</Label>
                  <Textarea
                    id="sim_body"
                    className="mt-1"
                    rows={3}
                    value={simBody}
                    onChange={(e) => setSimBody(e.target.value)}
                  />
                </div>
                <Button type="button" disabled={busy} onClick={() => void onSimulate()}>
                  {COPY.crm.canal_simulate}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {showWidgetTab ? (
          <TabsContent value="widget" className="mt-4 space-y-4">
            <Alert>
              <AlertDescription>{channelStubAlert("web_widget")}</AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.widget_title}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveWidget}>
                  <div>
                    <Label htmlFor="welcome_title">{COPY.crm.widget_welcome}</Label>
                    <Input
                      id="welcome_title"
                      className="mt-1"
                      value={welcomeTitle}
                      onChange={(e) => setWelcomeTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="widget_color">{COPY.crm.widget_color}</Label>
                    <Input
                      id="widget_color"
                      className="mt-1"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{COPY.crm.widget_continuity}</Label>
                    <Select
                      value={continuity}
                      onValueChange={(v) => setContinuity(v as "session" | "contact")}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="session">Sessão</SelectItem>
                        <SelectItem value="contact">Contato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="origins">{COPY.crm.widget_allowed_origins}</Label>
                    <Textarea
                      id="origins"
                      className="mt-1 font-mono text-xs"
                      rows={3}
                      value={originsText}
                      onChange={(e) => setOriginsText(e.target.value)}
                      placeholder="https://loja.exemplo.com"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>{COPY.crm.widget_pre_chat}</Label>
                    {preChat.map((field, idx) => (
                      <div key={idx} className="grid gap-2 md:grid-cols-4">
                        <Input
                          value={field.name}
                          placeholder="name"
                          onChange={(e) => {
                            const next = [...preChat];
                            next[idx] = { ...field, name: e.target.value };
                            setPreChat(next);
                          }}
                        />
                        <Input
                          value={field.label_pt}
                          placeholder="rótulo"
                          onChange={(e) => {
                            const next = [...preChat];
                            next[idx] = { ...field, label_pt: e.target.value };
                            setPreChat(next);
                          }}
                        />
                        <Select
                          value={field.type}
                          onValueChange={(v) => {
                            const next = [...preChat];
                            next[idx] = { ...field, type: v };
                            setPreChat(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">text</SelectItem>
                            <SelectItem value="email">email</SelectItem>
                            <SelectItem value="phone">phone</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(v) => {
                              const next = [...preChat];
                              next[idx] = { ...field, required: Boolean(v) };
                              setPreChat(next);
                            }}
                          />
                          Obrigatório
                        </label>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPreChat((prev) => [
                          ...prev,
                          { name: "", type: "text", label_pt: "", required: false },
                        ])
                      }
                    >
                      Adicionar campo
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {COPY.actions.salvar}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void onRotateToken()}
                    >
                      {COPY.crm.canal_rotate_token}
                    </Button>
                    {conn !== "ready_stub" ? (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => void markReady()}>
                        {COPY.crm.canal_mark_ready}
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.widget_snippet}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {snippet ? (
                  <>
                    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                      {snippet}
                    </pre>
                    <Button type="button" variant="outline" onClick={() => void copySnippet()}>
                      {COPY.crm.widget_snippet_copy}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Salve o widget ou rotacione o token para gerar o snippet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </SaasPage>
  );
}
