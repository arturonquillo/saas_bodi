"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { CrmChannelDto, CrmInboxDto, CrmTemplateDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function CaixasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(asPage<CrmInboxDto>(await apiGet("/api/saas/crm/inboxes")).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SaasPage title={COPY.crm.caixas_title}>
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
                      <Badge variant="outline">WhatsApp</Badge>
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
  const [channel, setChannel] = useState<CrmChannelDto | null>(null);
  const [templates, setTemplates] = useState<CrmTemplateDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [changeSecrets, setChangeSecrets] = useState(false);
  const [flags, setFlags] = useState({
    csat_enabled: false,
    allow_auto_assign: false,
    lock_to_single_conversation: false,
  });

  useEffect(() => {
    if (onCanalRoute) setActiveTab("canal");
    else setActiveTab((t) => (t === "canal" ? "geral" : t));
  }, [onCanalRoute]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const box = await apiGet<CrmInboxDto>(`/api/saas/crm/inboxes/${id}`);
      setInbox(box);
      setFlags({
        csat_enabled: Boolean(box.csat_enabled),
        allow_auto_assign: Boolean(box.allow_auto_assign),
        lock_to_single_conversation: Boolean(box.lock_to_single_conversation),
      });
      setChannel(
        await apiGet<CrmChannelDto>(`/api/saas/crm/inboxes/${id}/channel`).catch(() => null),
      );
      const tpl = await apiGet<CrmTemplateDto[] | { items: CrmTemplateDto[] }>(
        `/api/saas/crm/inboxes/${id}/templates`,
      ).catch(() => [] as CrmTemplateDto[]);
      setTemplates(Array.isArray(tpl) ? tpl : (tpl.items ?? []));
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

  async function saveGeral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiSend(`/api/saas/crm/inboxes/${id}`, "PATCH", {
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

  async function saveChannel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      phone_e164_display: fd.get("phone_e164_display") || null,
      phone_number_id: fd.get("phone_number_id") || null,
      business_account_id: fd.get("business_account_id") || null,
      provider: fd.get("provider") || "whatsapp_cloud",
    };
    if (changeSecrets || !channel?.secrets_present) {
      body.api_token = fd.get("api_token") || undefined;
      body.api_secret = fd.get("api_secret") || undefined;
      body.webhook_verify_token = fd.get("webhook_verify_token") || undefined;
    } else {
      body.api_token = "__unchanged__";
      body.api_secret = "__unchanged__";
      body.webhook_verify_token = "__unchanged__";
    }
    try {
      const saved = await apiSend<CrmChannelDto>(`/api/saas/crm/inboxes/${id}/channel`, "PUT", body);
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
      const saved = await apiSend<CrmChannelDto>(`/api/saas/crm/inboxes/${id}/channel`, "PUT", {
        connection_status: "ready_stub",
      });
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
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="membros">{COPY.crm.caixa_members}</TabsTrigger>
          <TabsTrigger value="canal">{COPY.crm.canal_title}</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={saveGeral}>
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
          </div>
          <Alert>
            <AlertDescription>{COPY.crm.canal_stub_alert}</AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Credenciais</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={saveChannel}>
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
                {channel?.secrets_present && !changeSecrets ? (
                  <div className="flex items-center gap-3">
                    <Input type="password" value="••••••••••••" readOnly autoComplete="off" />
                    <Button type="button" variant="outline" onClick={() => setChangeSecrets(true)}>
                      {COPY.crm.canal_secrets_change}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="api_token">API token</Label>
                      <Input
                        id="api_token"
                        name="api_token"
                        type="password"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label htmlFor="api_secret">API secret</Label>
                      <Input
                        id="api_secret"
                        name="api_secret"
                        type="password"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label htmlFor="webhook_verify_token">Webhook verify token</Label>
                      <Input
                        id="webhook_verify_token"
                        name="webhook_verify_token"
                        type="password"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                <input type="hidden" name="provider" value="whatsapp_cloud" />
                <Button type="submit" disabled={busy}>
                  {COPY.actions.salvar}
                </Button>
              </form>
            </CardContent>
          </Card>

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
        </TabsContent>
      </Tabs>
    </SaasPage>
  );
}
