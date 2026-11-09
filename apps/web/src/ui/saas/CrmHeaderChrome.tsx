"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiSend, asPage } from "../api";
import { COPY } from "../copy";
import { useAgentAvailability } from "../crm/hooks";
import type { CrmNotificationDto, CrmSearchHitDto, CrmSearchResultDto } from "../crm/types";
import { formatDate } from "../format";

function flattenSearch(data: CrmSearchResultDto, _q: string): CrmSearchHitDto[] {
  if (data.items?.length) return data.items;
  const hits: CrmSearchHitDto[] = [];

  for (const c of data.conversations ?? []) {
    hits.push({
      type: "conversation",
      id: c.id,
      title: c.contact?.nome || c.contact?.phone_e164 || c.id,
      subtitle: c.contact?.phone_e164 ?? null,
      href: `/saas/conversas/${c.id}`,
    });
  }
  for (const c of data.contacts ?? []) {
    hits.push({
      type: "contact",
      id: c.id,
      title: c.nome,
      subtitle: c.phone_e164 || c.email || null,
      href: `/saas/contatos/${c.id}`,
    });
  }
  for (const m of data.messages ?? []) {
    hits.push({
      type: "message",
      id: m.id,
      title: m.content.slice(0, 80),
      subtitle: m.created_at,
      href: `/saas/conversas/${m.conversation_id}`,
    });
  }
  for (const co of data.companies ?? []) {
    hits.push({
      type: "contact",
      id: co.id,
      title: co.razao_social,
      subtitle: "Empresa",
      href: `/saas/empresas/${co.id}`,
    });
  }

  for (const c of data.conversas ?? []) {
    hits.push({
      ...c,
      type: "conversation",
      href: c.href || `/saas/conversas/${c.id}`,
    });
  }
  for (const c of data.contatos ?? []) {
    hits.push({
      ...c,
      type: "contact",
      href: c.href || `/saas/contatos/${c.id}`,
    });
  }
  for (const m of data.mensagens ?? []) {
    hits.push({
      ...m,
      type: "message",
      href: m.href || `/saas/conversas/${m.id}`,
    });
  }
  return hits;
}

export function CrmHeaderChrome() {
  const router = useRouter();
  const { availability, setAvailability } = useAgentAvailability();
  const [notifs, setNotifs] = useState<CrmNotificationDto[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CrmSearchHitDto[]>([]);

  const loadNotifs = useCallback(async () => {
    try {
      setNotifs(asPage<CrmNotificationDto>(await apiGet("/api/saas/crm/notificacoes")).items);
    } catch {
      setNotifs([]);
    }
  }, []);

  useEffect(() => {
    void loadNotifs();
    const t = setInterval(() => void loadNotifs(), 30_000);
    return () => clearInterval(t);
  }, [loadNotifs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void apiGet<CrmSearchResultDto>(`/api/saas/crm/busca?q=${encodeURIComponent(q)}`)
        .then((data) => setHits(flattenSearch(data, q)))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, searchOpen]);

  const unread = notifs.filter((n) => !n.read_at).length;

  async function markRead(id: string, conversationId?: string | null) {
    try {
      await apiSend(`/api/saas/crm/notificacoes/${id}/ler`, "POST");
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch {
      /* ignore */
    }
    if (conversationId) router.push(`/saas/conversas/${conversationId}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => setSearchOpen(true)}
        aria-label={COPY.crm.search_placeholder}
      >
        <Search className="size-4" />
      </Button>

      <Select
        value={availability}
        onValueChange={(v) => void setAvailability(v as "online" | "busy" | "offline")}
      >
        <SelectTrigger className="h-9 w-[120px]" aria-label={COPY.crm.perfil_availability}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="online">{COPY.crm.availability_online}</SelectItem>
          <SelectItem value="busy">{COPY.crm.availability_busy}</SelectItem>
          <SelectItem value="offline">{COPY.crm.availability_offline}</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="relative size-9">
            <Bell className="size-4" />
            {unread > 0 ? (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]">
                {unread > 9 ? "9+" : unread}
              </Badge>
            ) : null}
            <span className="sr-only">{COPY.crm.nav_notificacoes}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{COPY.crm.nav_notificacoes}</span>
            <Link
              href="/saas/crm/notificacoes"
              className="text-xs font-normal text-primary hover:underline"
            >
              {COPY.crm.notificacoes_prefs}
            </Link>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifs.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {COPY.crm.notificacoes_empty}
            </p>
          ) : (
            notifs.slice(0, 8).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-0.5"
                onClick={() => void markRead(n.id, n.conversation_id)}
              >
                <span className={n.read_at ? "font-normal" : "font-medium"}>{n.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen} title={COPY.crm.search_placeholder}>
        <CommandInput
          placeholder={COPY.crm.search_placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length >= 2 ? COPY.crm.search_empty(query.trim()) : COPY.crm.search_placeholder}
          </CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="Resultados">
              {hits.map((h) => (
                <CommandItem
                  key={`${h.type}-${h.id}`}
                  value={`${h.title} ${h.subtitle ?? ""}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    router.push(h.href);
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.title}</p>
                    {h.subtitle ? (
                      <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
