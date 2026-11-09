"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { isAdmin } from "@saas-frota/shared";
import { Filter, MoreHorizontal, PanelRight, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiGet, apiSend, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { useCrmRealtime, usePresenceHeartbeat } from "../crm/hooks";
import {
  PRIORITIES,
  STATUSES,
  displayLabelTitle,
  priorityClass,
  priorityLabel,
  statusBadgeClass,
  statusLabel,
  substituteCanned,
} from "../crm/labels";
import type {
  CrmAttributeDto,
  CrmCannedDto,
  CrmConversationDetailDto,
  CrmConversationDto,
  CrmFilterDto,
  CrmInboxDto,
  CrmLabelDto,
  CrmMacroDto,
  CrmMessageDto,
  CrmTeamDto,
  ConversationStatus,
} from "../crm/types";
import { formatDate } from "../format";
import { useSession } from "../session";
import { ErrorState } from "../states";

type DeskFilter = {
  status?: ConversationStatus | "";
  assignee?: "me" | "unassigned" | "";
  inbox_id?: string;
  label?: string;
  team_id?: string;
};

function filterFromSearch(sp: URLSearchParams | null): DeskFilter {
  if (!sp) return { status: "open" };
  const status = (sp.get("status") as ConversationStatus | null) || "";
  const assignee = (sp.get("assignee") as DeskFilter["assignee"]) || "";
  return {
    status: status || (assignee ? "" : "open"),
    assignee: assignee === "me" || assignee === "unassigned" ? assignee : "",
    inbox_id: sp.get("inbox_id") || "",
    label: sp.get("label") || "",
    team_id: sp.get("team_id") || "",
  };
}

function buildListQuery(f: DeskFilter, updatedSince?: string) {
  const q = new URLSearchParams();
  if (f.status) q.set("status", f.status);
  if (f.assignee === "me") q.set("assignee", "me");
  if (f.assignee === "unassigned") q.set("assignee", "unassigned");
  if (f.inbox_id) q.set("inbox_id", f.inbox_id);
  if (f.label) q.set("label", f.label);
  if (f.team_id) q.set("team_id", f.team_id);
  if (updatedSince) q.set("updated_since", updatedSince);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function LabelDots({ labels }: { labels?: CrmLabelDto[] }) {
  if (!labels?.length) return null;
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1">
      {shown.map((l) => (
        <span
          key={l.id}
          className="inline-block size-2 rounded-full"
          style={{ background: l.color || "var(--color-primary)" }}
          title={displayLabelTitle(l.title)}
        />
      ))}
      {extra > 0 ? <span className="text-[10px] text-muted-foreground">+{extra}</span> : null}
    </span>
  );
}

function FilterStrip({
  filter,
  setFilter,
  inboxes,
  labels,
  teams,
  counts,
  savedFilters,
  onSaveFilter,
}: {
  filter: DeskFilter;
  setFilter: (f: DeskFilter) => void;
  inboxes: CrmInboxDto[];
  labels: CrmLabelDto[];
  teams: CrmTeamDto[];
  counts: Record<string, number | undefined>;
  savedFilters: CrmFilterDto[];
  onSaveFilter: () => void;
}) {
  const chip = (
    key: string,
    label: string,
    active: boolean,
    onClick: () => void,
    count?: number,
  ) => (
    <Button
      key={key}
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-full justify-between px-2 text-xs font-normal",
        active && "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] font-medium",
      )}
      onClick={onClick}
    >
      <span>{label}</span>
      {count != null ? <Badge variant="secondary">{count}</Badge> : null}
    </Button>
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        <p className="px-2 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Status
        </p>
        {chip("mine", COPY.crm.conversas_filter_mine, filter.assignee === "me", () =>
          setFilter({ ...filter, assignee: filter.assignee === "me" ? "" : "me", status: "" }),
          counts.mine,
        )}
        {chip(
          "unassigned",
          COPY.crm.conversas_filter_unassigned,
          filter.assignee === "unassigned",
          () =>
            setFilter({
              ...filter,
              assignee: filter.assignee === "unassigned" ? "" : "unassigned",
              status: "",
            }),
          counts.unassigned,
        )}
        {chip("open", COPY.crm.conversas_filter_open, filter.status === "open", () =>
          setFilter({ ...filter, status: filter.status === "open" ? "" : "open", assignee: "" }),
          counts.open,
        )}
        {chip("pending", COPY.crm.conversas_filter_pending, filter.status === "pending", () =>
          setFilter({
            ...filter,
            status: filter.status === "pending" ? "" : "pending",
            assignee: "",
          }),
          counts.pending,
        )}
        {chip("snoozed", COPY.crm.conversas_filter_snoozed, filter.status === "snoozed", () =>
          setFilter({
            ...filter,
            status: filter.status === "snoozed" ? "" : "snoozed",
            assignee: "",
          }),
          counts.snoozed,
        )}
        {chip("resolved", COPY.crm.conversas_filter_resolved, filter.status === "resolved", () =>
          setFilter({
            ...filter,
            status: filter.status === "resolved" ? "" : "resolved",
            assignee: "",
          }),
          counts.resolved,
        )}

        {inboxes.length ? (
          <>
            <Separator className="my-2" />
            <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Caixas
            </p>
            {inboxes.map((inbox) =>
              chip(
                `inbox-${inbox.id}`,
                inbox.name,
                filter.inbox_id === inbox.id,
                () =>
                  setFilter({
                    ...filter,
                    inbox_id: filter.inbox_id === inbox.id ? "" : inbox.id,
                  }),
              ),
            )}
          </>
        ) : null}

        {labels.filter((l) => l.show_on_sidebar !== false).length ? (
          <>
            <Separator className="my-2" />
            <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Labels
            </p>
            {labels
              .filter((l) => l.show_on_sidebar !== false)
              .map((l) =>
                chip(
                  `label-${l.id}`,
                  displayLabelTitle(l.title),
                  filter.label === l.title,
                  () =>
                    setFilter({
                      ...filter,
                      // API filters by label.title
                      label: filter.label === l.title ? "" : l.title,
                    }),
                ),
              )}
          </>
        ) : null}

        {teams.length ? (
          <>
            <Separator className="my-2" />
            <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {COPY.crm.team}
            </p>
            {teams.map((t) =>
              chip(`team-${t.id}`, t.name, filter.team_id === t.id, () =>
                setFilter({ ...filter, team_id: filter.team_id === t.id ? "" : t.id }),
              ),
            )}
          </>
        ) : null}

        {savedFilters.filter((f) => f.filter_type !== "contact").length ? (
          <>
            <Separator className="my-2" />
            <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {COPY.crm.filtros_title}
            </p>
            {savedFilters
              .filter((f) => f.filter_type !== "contact")
              .map((f) =>
                chip(`saved-${f.id}`, f.name, false, () => {
                  const q = f.query ?? {};
                  setFilter({
                    status: (typeof q.status === "string" ? q.status : "") as ConversationStatus | "",
                    assignee:
                      q.assignee === "me" || q.assignee === "unassigned"
                        ? q.assignee
                        : "",
                    inbox_id: typeof q.inbox_id === "string" ? q.inbox_id : "",
                    label: typeof q.label === "string" ? q.label : "",
                    team_id: typeof q.team_id === "string" ? q.team_id : "",
                  });
                }),
              )}
          </>
        ) : null}

        <Separator className="my-2" />
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onSaveFilter}>
          {COPY.crm.filtro_create}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setFilter({})}
        >
          {COPY.crm.conversas_clear_filters}
        </Button>
      </div>
    </ScrollArea>
  );
}

function ContextRail({
  detail,
  attrDefs,
  attrValues,
  setAttrValues,
  onSaveAttrs,
  attrBusy,
  onHandoff,
}: {
  detail: CrmConversationDetailDto | null;
  attrDefs: CrmAttributeDto[];
  attrValues: Record<string, string>;
  setAttrValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveAttrs: () => void;
  attrBusy: boolean;
  onHandoff: () => void;
}) {
  if (!detail) {
    return (
      <div className="p-4 text-sm text-muted-foreground">{COPY.crm.conversas_select}</div>
    );
  }
  const contact = detail.contact;
  const hasCliente = Boolean(contact?.cliente_id || detail.cliente_id);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Contato
          </p>
          <p className="mt-1 font-medium text-gray-900">{contact?.nome ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{contact?.phone_e164 ?? "—"}</p>
          {contact?.email ? (
            <p className="text-sm text-muted-foreground">{contact.email}</p>
          ) : null}
          {contact?.id ? (
            <Button variant="link" className="h-auto px-0" asChild>
              <Link href={`/saas/contatos/${contact.id}`}>Ver contato</Link>
            </Button>
          ) : null}
        </div>
        <Separator />
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Labels
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(detail.labels ?? []).length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              detail.labels!.map((l) => (
                <Badge key={l.id} variant="outline" className="gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: l.color || "var(--color-primary)" }}
                  />
                  {displayLabelTitle(l.title)}
                </Badge>
              ))
            )}
          </div>
        </div>
        <Separator />
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Atribuição
          </p>
          <p className="mt-1 text-sm">
            {detail.assignee_nome ?? detail.assignee_user_id ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {COPY.crm.team}: {detail.team_nome ?? detail.team_id ?? "—"}
          </p>
          {detail.bot_agent_bot_id ? (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onHandoff}>
              {COPY.crm.bot_handoff}
            </Button>
          ) : null}
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {COPY.crm.atributos_title}
          </p>
          {attrDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <>
              {attrDefs.map((def) => (
                <div key={def.id}>
                  <Label className="text-xs">{def.attribute_display_name}</Label>
                  <Input
                    className="mt-1 h-8"
                    value={attrValues[def.attribute_key] ?? ""}
                    onChange={(e) =>
                      setAttrValues((prev) => ({
                        ...prev,
                        [def.attribute_key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <Button type="button" size="sm" disabled={attrBusy} onClick={onSaveAttrs}>
                {COPY.actions.salvar}
              </Button>
            </>
          )}
        </div>
        <Separator />
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Comércio
          </p>
          {!hasCliente ? (
            <Alert>
              <AlertDescription>{COPY.crm.commerce_gate}</AlertDescription>
            </Alert>
          ) : null}
          {detail.cadastro_request_id ? (
            <Button variant="link" className="h-auto px-0" asChild>
              <Link href={`/saas/cadastros/${detail.cadastro_request_id}`}>Cadastro</Link>
            </Button>
          ) : null}
          {detail.orcamento_id ? (
            <Button variant="link" className="h-auto px-0" asChild>
              <Link href={`/saas/orcamentos/${detail.orcamento_id}`}>Orçamento</Link>
            </Button>
          ) : null}
          {hasCliente && detail.cliente_id ? (
            <p className="text-sm text-muted-foreground">Cliente: {detail.cliente_id}</p>
          ) : null}
        </div>
      </div>
    </ScrollArea>
  );
}

export function ConversasScreen() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const selectedId = params.id;

  const [filter, setFilter] = useState<DeskFilter>(() => filterFromSearch(searchParams));
  const [rows, setRows] = useState<CrmConversationDto[]>([]);
  const [detail, setDetail] = useState<CrmConversationDetailDto | null>(null);
  const [listStatus, setListStatus] = useState<"loading" | "ok" | "error">("loading");
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [labels, setLabels] = useState<CrmLabelDto[]>([]);
  const [teams, setTeams] = useState<CrmTeamDto[]>([]);
  const [canned, setCanned] = useState<CrmCannedDto[]>([]);
  const [macros, setMacros] = useState<CrmMacroDto[]>([]);
  const [savedFilters, setSavedFilters] = useState<CrmFilterDto[]>([]);
  const [attrDefs, setAttrDefs] = useState<CrmAttributeDto[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [attrBusy, setAttrBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState("");
  const [privateNote, setPrivateNote] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatedSince, setUpdatedSince] = useState<string | undefined>();

  usePresenceHeartbeat(selectedId);

  const loadMeta = useCallback(async () => {
    const [inboxPage, labelPage, teamPage, cannedPage, macroPage, filterPage, attrPage] =
      await Promise.all([
        apiGet("/api/saas/crm/inboxes")
          .then((d) => asPage<CrmInboxDto>(d))
          .catch(() => ({ items: [] as CrmInboxDto[] })),
        apiGet("/api/saas/crm/labels")
          .then((d) => asPage<CrmLabelDto>(d))
          .catch(() => ({ items: [] as CrmLabelDto[] })),
        apiGet("/api/saas/crm/teams")
          .then((d) => asPage<CrmTeamDto>(d))
          .catch(() => ({ items: [] as CrmTeamDto[] })),
        apiGet("/api/saas/crm/respostas-rapidas")
          .then((d) => asPage<CrmCannedDto>(d))
          .catch(() => ({ items: [] as CrmCannedDto[] })),
        apiGet("/api/saas/crm/macros")
          .then((d) => asPage<CrmMacroDto>(d))
          .catch(() => ({ items: [] as CrmMacroDto[] })),
        apiGet("/api/saas/crm/filtros")
          .then((d) => asPage<CrmFilterDto>(d))
          .catch(() => ({ items: [] as CrmFilterDto[] })),
        apiGet("/api/saas/crm/atributos?model=conversation")
          .then((d) => asPage<CrmAttributeDto>(d))
          .catch(() => ({ items: [] as CrmAttributeDto[] })),
      ]);
    setInboxes(inboxPage.items);
    setLabels(labelPage.items);
    setTeams(teamPage.items);
    setCanned(cannedPage.items);
    setMacros(macroPage.items);
    setSavedFilters(filterPage.items);
    setAttrDefs(attrPage.items);
  }, []);

  const loadList = useCallback(
    async (opts?: { soft?: boolean; since?: string }) => {
      if (!opts?.soft) setListStatus("loading");
      try {
        const page = asPage<CrmConversationDto>(
          await apiGet(`/api/saas/crm/conversas${buildListQuery(filter, opts?.since)}`),
        );
        setRows(page.items);
        setListStatus("ok");
        setUpdatedSince(new Date().toISOString());
      } catch {
        if (!opts?.soft) setListStatus("error");
      }
    },
    [filter],
  );

  const loadDetail = useCallback(async (id: string, soft?: boolean) => {
    if (!soft) setDetailStatus("loading");
    try {
      const data = await apiGet<CrmConversationDetailDto>(`/api/saas/crm/conversas/${id}`);
      let messages = data.messages ?? [];
      if (!messages.length) {
        try {
          messages = asPage<CrmMessageDto>(
            await apiGet(`/api/saas/crm/conversas/${id}/mensagens`),
          ).items;
        } catch {
          messages = [];
        }
      }
      setDetail({ ...data, messages });
      setComposer(data.draft ?? "");
      const attrs = data.custom_attributes ?? {};
      setAttrValues(
        Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v == null ? "" : String(v)])),
      );
      setDetailStatus("ok");
    } catch (err) {
      setDetail(null);
      setDetailStatus("error");
      if (isApiError(err) && (err.status === 404 || err.status === 403)) {
        /* show not found */
      }
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setDetailStatus("idle");
      setComposer("");
    }
  }, [selectedId, loadDetail]);

  const { pollCaption } = useCrmRealtime({
    enabled: true,
    onEvent: (ev) => {
      if (
        ev.type.startsWith("conversation.") ||
        ev.type === "message.created" ||
        ev.type === "agent.viewing"
      ) {
        void loadList({ soft: true });
        if (selectedId) void loadDetail(selectedId, true);
      }
    },
    onPoll: async () => {
      await loadList({ soft: true, since: updatedSince });
      if (selectedId) {
        try {
          const page = asPage<CrmMessageDto>(
            await apiGet(
              `/api/saas/crm/conversas/${selectedId}/mensagens?after=${encodeURIComponent(updatedSince ?? "")}`,
            ),
          );
          if (page.items.length) void loadDetail(selectedId, true);
        } catch {
          /* ignore */
        }
      }
    },
  });

  const counts = useMemo(
    () => ({
      mine: undefined as number | undefined,
      unassigned: undefined,
      open: undefined,
      pending: undefined,
      snoozed: undefined,
      resolved: undefined,
    }),
    [],
  );

  async function patchConversation(patch: Record<string, unknown>) {
    if (!detail) return;
    try {
      const updated = await apiSend<CrmConversationDetailDto>(
        `/api/saas/crm/conversas/${detail.id}`,
        "PATCH",
        patch,
      );
      setDetail((prev) => (prev ? { ...prev, ...updated, messages: prev.messages } : prev));
      void loadList({ soft: true });
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function sendMessage() {
    if (!detail || !composer.trim()) return;
    setSendBusy(true);
    setSendError(null);
    const content = composer.trim();
    const optimistic: CrmMessageDto = {
      id: `tmp_${Date.now()}`,
      message_type: "outgoing",
      private: privateNote,
      content,
      delivery_status: "queued",
      created_at: new Date().toISOString(),
    };
    setDetail((prev) =>
      prev ? { ...prev, messages: [...(prev.messages ?? []), optimistic] } : prev,
    );
    setComposer("");
    try {
      const created = await apiSend<CrmMessageDto>(
        `/api/saas/crm/conversas/${detail.id}/mensagens`,
        "POST",
        { content, private: privateNote },
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.id === optimistic.id ? created : m)),
            }
          : prev,
      );
      void apiSend(`/api/saas/crm/conversas/${detail.id}/draft`, "PUT", { body: "" }).catch(
        () => undefined,
      );
      void loadList({ soft: true });
    } catch (err) {
      setComposer(content);
      setDetail((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) }
          : prev,
      );
      setSendError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setSendBusy(false);
    }
  }

  useEffect(() => {
    if (!detail || !selectedId) return;
    const handle = window.setTimeout(() => {
      void apiSend(`/api/saas/crm/conversas/${selectedId}/draft`, "PUT", {
        body: composer,
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(handle);
  }, [composer, detail, selectedId]);

  async function onSimulate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSimBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiSend<CrmConversationDetailDto>("/api/saas/crm/simular", "POST", {
        inbox_id: fd.get("inbox_id") || undefined,
        phone_e164: fd.get("phone_e164"),
        body: fd.get("body"),
        intent_label: fd.get("intent_label") || undefined,
      });
      setSimOpen(false);
      toast.success(COPY.simulate_ok);
      await loadList();
      router.push(`/saas/conversas/${created.id}`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setSimBusy(false);
    }
  }

  async function bulk(action: string, params?: Record<string, unknown>) {
    if (!selected.size) return;
    try {
      await apiSend("/api/saas/crm/conversas/bulk", "POST", {
        ids: Array.from(selected),
        action,
        params,
      });
      setSelected(new Set());
      void loadList();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function runMacro(macroId: string, conversationIds: string[]) {
    if (!conversationIds.length) return;
    try {
      await apiSend(`/api/saas/crm/macros/${macroId}/executar`, "POST", {
        conversation_ids: conversationIds,
      });
      toast.success(COPY.crm.macro_execute);
      setSelected(new Set());
      void loadList({ soft: true });
      if (selectedId && conversationIds.includes(selectedId)) void loadDetail(selectedId, true);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function saveConversationAttrs() {
    if (!selectedId) return;
    setAttrBusy(true);
    try {
      await apiSend(`/api/saas/crm/conversas/${selectedId}/atributos`, "PATCH", {
        attributes: attrValues,
      });
      toast.success(COPY.actions.salvar);
      void loadDetail(selectedId, true);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setAttrBusy(false);
    }
  }

  async function handoffBot() {
    if (!selectedId) return;
    try {
      await apiSend(`/api/saas/crm/conversas/${selectedId}/bot/handoff`, "POST");
      toast.success(COPY.crm.bot_handoff);
      void loadDetail(selectedId, true);
      void loadList({ soft: true });
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function saveCurrentFilter() {
    const name = window.prompt("Nome do filtro");
    if (!name?.trim()) return;
    try {
      await apiSend("/api/saas/crm/filtros", "POST", {
        name: name.trim(),
        filter_type: "conversation",
        query: {
          status: filter.status || undefined,
          assignee: filter.assignee || undefined,
          inbox_id: filter.inbox_id || undefined,
          label: filter.label || undefined,
          team_id: filter.team_id || undefined,
        },
      });
      toast.success(COPY.crm.filtro_create);
      const page = asPage<CrmFilterDto>(await apiGet("/api/saas/crm/filtros").catch(() => ({ items: [] })));
      setSavedFilters(page.items);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  function insertCanned(item: CrmCannedDto) {
    const vars: Record<string, string> = {
      "contact.name": detail?.contact?.nome ?? "",
      "contact.nome": detail?.contact?.nome ?? "",
      "contact.phone": detail?.contact?.phone_e164 ?? "",
    };
    setComposer((prev) => `${prev}${prev ? "\n" : ""}${substituteCanned(item.content, vars)}`);
    setCannedOpen(false);
  }

  useEffect(() => {
    if (composer.startsWith("/") && !composer.includes(" ")) {
      setCannedOpen(true);
    }
  }, [composer]);

  const collision = detail?.viewers?.find((v) => v.user_id !== session?.user_id);

  const filterPane = (
    <FilterStrip
      filter={filter}
      setFilter={setFilter}
      inboxes={inboxes}
      labels={labels}
      teams={teams}
      counts={counts}
      savedFilters={savedFilters}
      onSaveFilter={() => void saveCurrentFilter()}
    />
  );

  const contextRail = (
    <ContextRail
      detail={detail}
      attrDefs={attrDefs}
      attrValues={attrValues}
      setAttrValues={setAttrValues}
      onSaveAttrs={() => void saveConversationAttrs()}
      attrBusy={attrBusy}
      onHandoff={() => void handoffBot()}
    />
  );

  const listPane = (
    <div className="flex h-full flex-col border-r border-[#E5E9EC] bg-card">
      <div className="flex items-center gap-2 border-b border-[#E5E9EC] px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="xl:hidden"
          onClick={() => setFiltersOpen(true)}
          aria-label={COPY.crm.conversas_filters}
        >
          <Filter className="size-4" />
        </Button>
        <p className="flex-1 text-sm font-medium">{COPY.crm.conversas_title}</p>
        {admin ? (
          <Button type="button" size="sm" onClick={() => setSimOpen(true)}>
            {COPY.simulate_message}
          </Button>
        ) : null}
      </div>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E9EC] bg-muted/40 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">{selected.size} selecionada(s)</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                {COPY.crm.bulk_actions}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => void bulk("assign", { assignee: "me" })}>
                {COPY.crm.assign}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void bulk("resolve")}>
                {COPY.crm.status_resolved}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void bulk("mute")}>{COPY.crm.mute}</DropdownMenuItem>
              {macros.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => void runMacro(m.id, Array.from(selected))}
                >
                  {COPY.crm.macro_execute}: {m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      {pollCaption ? (
        <p className="px-3 py-1 text-[11px] text-muted-foreground">{COPY.crm.sse_poll_fallback}</p>
      ) : null}
      <ScrollArea className="flex-1">
        {listStatus === "loading" ? (
          <div className="space-y-0 p-0" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none border-b" />
            ))}
          </div>
        ) : listStatus === "error" ? (
          <div className="p-3">
            <ErrorState onRetry={() => void loadList()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm font-medium">
              {filter.status || filter.assignee || filter.inbox_id || filter.label
                ? COPY.crm.conversas_empty_filter
                : COPY.crm.conversas_empty}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setFilter({})}>
                {COPY.crm.conversas_clear_filters}
              </Button>
              {admin ? (
                <Button type="button" size="sm" onClick={() => setSimOpen(true)}>
                  {COPY.simulate_message}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <ul role="listbox" aria-label={COPY.crm.conversas_title}>
            {rows.map((row) => {
              const active = selectedId === row.id;
              const title = row.contact?.nome || row.contact?.phone_e164 || row.id;
              return (
                <li key={row.id} className="border-b border-[#E5E9EC]">
                  <div
                    className={cn(
                      "flex items-stretch gap-2 px-2",
                      active &&
                        "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] border-l-[3px] border-l-primary",
                    )}
                  >
                    <div className="flex items-center">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                        aria-label={`Selecionar ${title}`}
                      />
                    </div>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className="min-w-0 flex-1 py-2 text-left"
                      onClick={() => router.push(`/saas/conversas/${row.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        {row.unread ? (
                          <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        ) : (
                          <span className="size-2 shrink-0" aria-hidden />
                        )}
                        <p
                          className={cn(
                            "truncate text-sm text-gray-900",
                            row.unread && "font-semibold",
                          )}
                        >
                          {title}
                        </p>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {formatDate(row.last_activity_at ?? row.updated_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 pl-4">
                        <p className="truncate text-xs text-muted-foreground">
                          {row.preview ||
                            row.contact?.phone_e164 ||
                            row.contact?.nome ||
                            "—"}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn("ml-auto shrink-0 text-[10px]", statusBadgeClass(row.status))}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                        {row.priority ? (
                          <span className={cn("text-[10px]", priorityClass(row.priority))}>
                            {priorityLabel(row.priority)}
                          </span>
                        ) : null}
                        <LabelDots labels={row.labels} />
                      </div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );

  const threadPane = (
    <div className="flex h-full min-w-0 flex-col bg-card" aria-label="Conversa">
      {!selectedId ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <p className="text-sm text-muted-foreground">{COPY.crm.conversas_select}</p>
        </div>
      ) : detailStatus === "loading" ? (
        <div className="space-y-3 p-4" aria-busy="true">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="ml-auto h-16 w-2/3" />
        </div>
      ) : detailStatus === "error" || !detail ? (
        <div className="p-4">
          <ErrorState message={COPY.not_found} onRetry={() => selectedId && void loadDetail(selectedId)} />
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 space-y-2 border-b border-[#E5E9EC] bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="md:hidden" asChild>
                <Link href="/saas/conversas">←</Link>
              </Button>
              <p className="min-w-0 flex-1 truncate font-medium">
                {detail.contact?.nome || detail.contact?.phone_e164 || detail.id}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="xl:hidden"
                onClick={() => setDetailsOpen(true)}
                aria-label={COPY.crm.conversas_details}
              >
                <PanelRight className="size-4" />
              </Button>
              <Select
                value={String(detail.status)}
                onValueChange={(v) => void patchConversation({ status: v })}
              >
                <SelectTrigger className="h-8 w-[130px]" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={detail.priority ? String(detail.priority) : "none"}
                onValueChange={(v) =>
                  void patchConversation({ priority: v === "none" ? null : v })
                }
              >
                <SelectTrigger className="h-8 w-[120px]" aria-label="Prioridade">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchConversation({
                    assignee_user_id: session?.user_id ?? null,
                  })
                }
              >
                {COPY.crm.assign}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      void patchConversation({
                        muted: !detail.muted,
                      })
                    }
                  >
                    {COPY.crm.mute}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void patchConversation({
                        status: "snoozed",
                        snoozed_until: new Date(Date.now() + 86400000).toISOString(),
                      })
                    }
                  >
                    {COPY.crm.snooze}
                  </DropdownMenuItem>
                  {macros.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => void runMacro(m.id, [detail.id])}
                    >
                      {COPY.crm.macro_execute}: {m.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {collision ? (
              <Alert>
                <AlertDescription>
                  {COPY.crm.viewing_collision(collision.nome || collision.user_id)}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <ScrollArea className="flex-1 px-3 py-3">
            <ul className="space-y-3" aria-live="polite">
              {(detail.messages ?? []).map((m) => {
                const incoming = m.message_type === "incoming";
                const note = m.private;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-md px-3 py-2 text-sm",
                      note
                        ? "ml-auto bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)]"
                        : incoming
                          ? "mr-auto bg-muted"
                          : "ml-auto bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]",
                    )}
                  >
                    {note ? (
                      <p className="mb-1 text-[11px] font-medium text-[var(--color-warning)]">
                        {COPY.crm.private_note}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-gray-900">{m.content}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(m.created_at)}
                      {m.simulated ? " · simulado" : ""}
                      {!note && m.message_type === "outgoing"
                        ? ` · ${COPY.outbox_stub_note}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>

          <div className="sticky bottom-0 border-t border-[#E5E9EC] bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={privateNote}
                  onCheckedChange={(v) => setPrivateNote(Boolean(v))}
                />
                {COPY.crm.private_note}
              </label>
              <Popover open={cannedOpen} onOpenChange={setCannedOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant="ghost">
                    / {COPY.crm.resposta_shortcode}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput placeholder={COPY.crm.resposta_shortcode} />
                    <CommandList>
                      <CommandEmpty>{COPY.crm.respostas_empty}</CommandEmpty>
                      <CommandGroup>
                        {canned.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.short_code} ${c.content}`}
                            onSelect={() => insertCanned(c)}
                          >
                            <span className="font-mono text-xs">/{c.short_code}</span>
                            <span className="truncate text-muted-foreground">
                              {c.content.slice(0, 40)}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                rows={2}
                className="min-h-[48px] flex-1"
                placeholder={privateNote ? COPY.crm.private_note : COPY.body}
                aria-keyshortcuts="Control+Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <Button
                type="button"
                className="h-12 min-w-12 self-end"
                disabled={sendBusy || !composer.trim()}
                onClick={() => void sendMessage()}
                aria-label={COPY.crm.send_reply}
              >
                <Send className="size-4" />
              </Button>
            </div>
            {sendError ? <p className="mt-2 text-sm text-red-500">{sendError}</p> : null}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-68px)] min-h-[480px] w-full bg-[#F4F6F7]">
      <aside className="hidden w-[220px] shrink-0 border-r border-[#E5E9EC] bg-card xl:block">
        {filterPane}
      </aside>

      <div
        className={cn(
          "w-full shrink-0 border-r border-[#E5E9EC] md:w-[40%] xl:w-[320px]",
          selectedId ? "hidden md:block" : "block",
        )}
      >
        {listPane}
      </div>

      <div className={cn("min-w-0 flex-1", !selectedId ? "hidden md:block" : "block")}>
        {threadPane}
      </div>

      <aside className="hidden w-[280px] shrink-0 border-l border-[#E5E9EC] bg-card xl:block">
        {contextRail}
      </aside>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>{COPY.crm.conversas_filters}</SheetTitle>
          </SheetHeader>
          {filterPane}
        </SheetContent>
      </Sheet>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-[320px] p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>{COPY.crm.conversas_details}</SheetTitle>
          </SheetHeader>
          {contextRail}
        </SheetContent>
      </Sheet>

      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.simulate_message}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSimulate}>
            {inboxes.length ? (
              <div>
                <Label htmlFor="inbox_id">Caixa</Label>
                <select id="inbox_id" name="inbox_id" className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                  {inboxes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="phone_e164">{COPY.phone}</Label>
              <Input
                id="phone_e164"
                name="phone_e164"
                required
                placeholder="+5511999999999"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="body">{COPY.body}</Label>
              <Textarea id="body" name="body" required rows={3} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="intent_label">Label</Label>
              <select
                id="intent_label"
                name="intent_label"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="">—</option>
                <option value="intent:cadastro">{COPY.intent_cadastro}</option>
                <option value="intent:orcamento">{COPY.intent_orcamento}</option>
                <option value="intent:info_empresa">{COPY.intent_info_empresa}</option>
                <option value="intent:outro">{COPY.intent_outro}</option>
              </select>
            </div>
            <DialogFooter>
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
    </div>
  );
}
