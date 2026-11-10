"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { DetailNavLink } from "../../DetailNavRow";
import { formatDate } from "../../format";
import {
  campaignCancellable,
  campaignChannelLabel,
  campaignDeletable,
  campaignEditable,
  campaignKindLabel,
  campaignSendable,
  campaignStatusLabel,
  recipientStatusLabel,
} from "../../crm/phase-c";
import type {
  CampaignChannel,
  CampaignKind,
  CrmCampaignDto,
  CrmCampaignRecipientDto,
  CrmInboxDto,
  CrmLabelDto,
  CrmTemplateDto,
} from "../../crm/types";
import { displayLabelTitle } from "../../crm/labels";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

type Draft = {
  title: string;
  description: string;
  kind: CampaignKind;
  channel: CampaignChannel;
  inbox_id: string;
  audience_label_ids: string[];
  template_key: string;
  message: string;
  scheduled_at: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  kind: "one_off",
  channel: "whatsapp",
  inbox_id: "",
  audience_label_ids: [],
  template_key: "",
  message: "",
  scheduled_at: "",
});

function statusBadgeVariant(status: string) {
  if (status === "completed" || status === "active") return "default" as const;
  if (status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

export function CampanhasScreen() {
  const [items, setItems] = useState<CrmCampaignDto[]>([]);
  const [labels, setLabels] = useState<CrmLabelDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [templates, setTemplates] = useState<CrmTemplateDto[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const q = new URLSearchParams();
      if (kindFilter !== "all") q.set("kind", kindFilter);
      if (statusFilter !== "all") q.set("status", statusFilter);
      const qs = q.toString();
      setItems(
        asPage<CrmCampaignDto>(
          await apiGet(`/api/saas/crm/campanhas${qs ? `?${qs}` : ""}`),
        ).items,
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [kindFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([
      apiGet("/api/saas/crm/labels").then((d) => setLabels(asPage<CrmLabelDto>(d).items)),
      apiGet("/api/saas/crm/inboxes").then((d) => setInboxes(asPage<CrmInboxDto>(d).items)),
    ]).catch(() => {
      setLabels([]);
      setInboxes([]);
    });
  }, []);

  useEffect(() => {
    if (!draft.inbox_id) {
      setTemplates([]);
      return;
    }
    void apiGet(`/api/saas/crm/inboxes/${draft.inbox_id}/templates`)
      .then((d) => {
        const raw = d as { items?: CrmTemplateDto[] } | CrmTemplateDto[];
        setTemplates(Array.isArray(raw) ? raw : (raw.items ?? []));
      })
      .catch(() => setTemplates([]));
  }, [draft.inbox_id]);

  function openCreate() {
    const firstInbox = inboxes[0]?.id ?? "";
    setDraft({ ...emptyDraft(), inbox_id: firstInbox });
    setOpen(true);
  }

  function toggleLabel(id: string) {
    setDraft((prev) => ({
      ...prev,
      audience_label_ids: prev.audience_label_ids.includes(id)
        ? prev.audience_label_ids.filter((x) => x !== id)
        : [...prev.audience_label_ids, id],
    }));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.audience_label_ids.length) {
      toast.error(COPY.crm.campanha_audience_required);
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        kind: draft.kind,
        channel: draft.channel,
        audience_label_ids: draft.audience_label_ids,
        message: draft.message.trim() || null,
        scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null,
      };
      if (draft.kind === "one_off") {
        body.inbox_id = draft.inbox_id || null;
        body.template_key = draft.template_key || null;
      }
      await apiSend("/api/saas/crm/campanhas", "POST", body);
      setOpen(false);
      toast.success(COPY.crm.campanha_created);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiSend(`/api/saas/crm/campanhas/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.campanhas_title}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.campanha_create}
        </Button>
      }
    >
      <Alert className="mb-6">
        <AlertTitle>{COPY.crm.campanha_stub_title}</AlertTitle>
        <AlertDescription>{COPY.crm.campanha_stub_note}</AlertDescription>
      </Alert>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{COPY.filter_todos}</SelectItem>
            <SelectItem value="one_off">{campaignKindLabel("one_off")}</SelectItem>
            <SelectItem value="ongoing">{campaignKindLabel("ongoing")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{COPY.filter_todos}</SelectItem>
            {["draft", "scheduled", "active", "completed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s}>
                {campaignStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.crm.campanhas_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="mb-2 text-lg font-semibold">{COPY.crm.campanhas_empty}</h3>
                <Button type="button" onClick={openCreate}>
                  {COPY.crm.campanha_create}
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3">
                    <DetailNavLink
                      href={`/saas/crm/campanhas/${c.id}`}
                      className="min-w-0 flex-1 rounded-md px-2 py-2"
                      meta={
                        <Badge variant={statusBadgeVariant(String(c.status))}>
                          {campaignStatusLabel(String(c.status))}
                        </Badge>
                      }
                    >
                      <p className="font-medium text-foreground">{c.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaignKindLabel(String(c.kind))} · {campaignChannelLabel(String(c.channel))}
                        {c.scheduled_at ? ` · ${formatDate(c.scheduled_at)}` : ""}
                      </p>
                    </DetailNavLink>
                    <div className="flex items-center gap-2">
                      {campaignDeletable(String(c.status)) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void onDelete(c.id)}
                        >
                          Excluir
                        </Button>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{COPY.crm.campanha_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="camp-title">{COPY.nome}</Label>
              <Input
                id="camp-title"
                required
                className="mt-1"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="camp-desc">Descrição</Label>
              <Textarea
                id="camp-desc"
                rows={2}
                className="mt-1"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as CampaignKind }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">{campaignKindLabel("one_off")}</SelectItem>
                    <SelectItem value="ongoing">{campaignKindLabel("ongoing")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) => setDraft((d) => ({ ...d, channel: v as CampaignChannel }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.kind === "one_off" ? (
              <>
                <div>
                  <Label>Caixa de entrada</Label>
                  <Select
                    value={draft.inbox_id}
                    onValueChange={(v) => setDraft((d) => ({ ...d, inbox_id: v, template_key: "" }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {inboxes.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modelo (stub)</Label>
                  <Select
                    value={draft.template_key || undefined}
                    onValueChange={(v) => setDraft((d) => ({ ...d, template_key: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="template_key" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="camp-msg">Mensagem do widget</Label>
                <Textarea
                  id="camp-msg"
                  rows={3}
                  className="mt-1"
                  value={draft.message}
                  onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                  placeholder={COPY.crm.campanha_ongoing_hint}
                />
              </div>
            )}
            <div>
              <Label>Agendar (opcional)</Label>
              <Input
                type="datetime-local"
                className="mt-1"
                value={draft.scheduled_at}
                onChange={(e) => setDraft((d) => ({ ...d, scheduled_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>{COPY.crm.campanha_audience}</Label>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {labels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{COPY.crm.labels_empty}</p>
                ) : (
                  labels.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.audience_label_ids.includes(l.id)}
                        onCheckedChange={() => toggleLabel(l.id)}
                      />
                      <span
                        className="size-2 rounded-full"
                        style={{ background: l.color || "#64748b" }}
                      />
                      {displayLabelTitle(l.title)}
                    </label>
                  ))
                )}
              </div>
            </div>
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

export function CampanhaDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<CrmCampaignDto | null>(null);
  const [recipients, setRecipients] = useState<CrmCampaignRecipientDto[]>([]);
  const [labels, setLabels] = useState<CrmLabelDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "gone">("loading");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Draft | null>(null);

  const labelMap = useMemo(
    () => Object.fromEntries(labels.map((l) => [l.id, l])),
    [labels],
  );

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const camp = await apiGet<CrmCampaignDto>(`/api/saas/crm/campanhas/${id}`);
      setItem(camp);
      setEdit({
        title: camp.title,
        description: camp.description ?? "",
        kind: (camp.kind as CampaignKind) || "one_off",
        channel: (camp.channel as CampaignChannel) || "whatsapp",
        inbox_id: camp.inbox_id ?? "",
        audience_label_ids: camp.audience_label_ids ?? [],
        template_key: camp.template_key ?? "",
        message: camp.message ?? "",
        scheduled_at: camp.scheduled_at
          ? new Date(camp.scheduled_at).toISOString().slice(0, 16)
          : "",
      });
      try {
        setRecipients(
          asPage<CrmCampaignRecipientDto>(
            await apiGet(`/api/saas/crm/campanhas/${id}/destinatarios`),
          ).items,
        );
      } catch {
        setRecipients([]);
      }
      setStatus("ok");
    } catch (err) {
      if (isApiError(err) && err.status === 404) setStatus("gone");
      else setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiGet("/api/saas/crm/labels")
      .then((d) => setLabels(asPage<CrmLabelDto>(d).items))
      .catch(() => setLabels([]));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || !item || !campaignEditable(String(item.status))) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/campanhas/${id}`, "PATCH", {
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        channel: edit.channel,
        inbox_id: edit.inbox_id || null,
        audience_label_ids: edit.audience_label_ids,
        template_key: edit.template_key || null,
        message: edit.message.trim() || null,
        scheduled_at: edit.scheduled_at ? new Date(edit.scheduled_at).toISOString() : null,
      });
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onEnviar() {
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/campanhas/${id}/enviar`, "POST");
      toast.success(
        item?.kind === "ongoing" ? COPY.crm.campanha_activated : COPY.crm.campanha_sent,
      );
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onCancelar() {
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/campanhas/${id}/cancelar`, "POST");
      toast.success(COPY.crm.campanha_cancelled);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.campanhas_title}>
        <TableSkeleton />
      </SaasPage>
    );
  }
  if (status === "gone") {
    return (
      <SaasPage title={COPY.crm.campanhas_title}>
        <p className="text-sm text-muted-foreground">{COPY.not_found}</p>
      </SaasPage>
    );
  }
  if (status === "error" || !item || !edit) {
    return (
      <SaasPage title={COPY.crm.campanhas_title}>
        <ErrorState onRetry={() => void load()} />
      </SaasPage>
    );
  }

  const editable = campaignEditable(String(item.status));

  return (
    <SaasPage
      title={item.title}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/saas/crm/campanhas">Voltar</Link>
          </Button>
          {campaignSendable(String(item.status)) ? (
            <Button type="button" disabled={busy} onClick={() => void onEnviar()}>
              {item.kind === "ongoing" ? COPY.crm.campanha_activate : COPY.crm.campanha_send}
            </Button>
          ) : null}
          {campaignCancellable(String(item.status)) ? (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void onCancelar()}>
              {COPY.crm.campanha_cancel}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={statusBadgeVariant(String(item.status))}>
          {campaignStatusLabel(String(item.status))}
        </Badge>
        <Badge variant="outline">{campaignKindLabel(String(item.kind))}</Badge>
        <Badge variant="secondary">{campaignChannelLabel(String(item.channel))}</Badge>
      </div>

      {item.kind === "ongoing" && item.display_status === "awaiting_widget" ? (
        <Alert className="mb-6">
          <AlertTitle>{COPY.crm.campanha_awaiting_widget_title}</AlertTitle>
          <AlertDescription>{COPY.crm.campanha_awaiting_widget}</AlertDescription>
        </Alert>
      ) : null}

      <Alert className="mb-6">
        <AlertDescription>{COPY.crm.campanha_stub_note}</AlertDescription>
      </Alert>

      <form className="mb-8 max-w-xl space-y-3" onSubmit={onSave}>
        <div>
          <Label htmlFor="edit-title">{COPY.nome}</Label>
          <Input
            id="edit-title"
            className="mt-1"
            disabled={!editable}
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="edit-desc">Descrição</Label>
          <Textarea
            id="edit-desc"
            className="mt-1"
            rows={2}
            disabled={!editable}
            value={edit.description}
            onChange={(e) => setEdit({ ...edit, description: e.target.value })}
          />
        </div>
        {item.kind === "one_off" ? (
          <div>
            <Label>Modelo</Label>
            <Input
              className="mt-1 font-mono text-sm"
              disabled={!editable}
              value={edit.template_key}
              onChange={(e) => setEdit({ ...edit, template_key: e.target.value })}
            />
          </div>
        ) : (
          <div>
            <Label>Mensagem</Label>
            <Textarea
              className="mt-1"
              rows={3}
              disabled={!editable}
              value={edit.message}
              onChange={(e) => setEdit({ ...edit, message: e.target.value })}
            />
          </div>
        )}
        <div>
          <Label>{COPY.crm.campanha_audience}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(item.audience_label_ids ?? []).map((lid) => (
              <Badge key={lid} variant="outline">
                {displayLabelTitle(labelMap[lid]?.title ?? lid)}
              </Badge>
            ))}
            {!item.audience_label_ids?.length ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : null}
          </div>
          {!editable ? (
            <p className="mt-1 text-xs text-muted-foreground">{COPY.crm.campanha_audience_locked}</p>
          ) : null}
        </div>
        {item.stats ? (
          <p className="text-sm text-muted-foreground">
            Alvo {item.stats.targeted ?? 0} · Enviado {item.stats.enviado ?? 0} · Falha{" "}
            {item.stats.falha ?? 0} · Omitido {item.stats.omitido ?? 0}
          </p>
        ) : null}
        {editable ? (
          <Button type="submit" disabled={busy}>
            {COPY.actions.salvar}
          </Button>
        ) : null}
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{COPY.crm.campanha_recipients}</CardTitle>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{COPY.crm.campanha_recipients_empty}</p>
          ) : (
            <ul className="space-y-3">
              {recipients.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{r.contact_nome || r.contact_id}</span>
                  <Badge variant="secondary">{recipientStatusLabel(String(r.status))}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
