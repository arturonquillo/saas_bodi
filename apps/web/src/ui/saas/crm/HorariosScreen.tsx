"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { DAY_LABELS_PT, defaultWeekHours } from "../../crm/phase-b";
import type { CrmInboxDto, CrmWorkingHourDto, CrmWorkingHoursDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, FormSkeleton } from "../../states";

function padTime(h: number | null | undefined, m: number | null | undefined) {
  if (h == null || m == null) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTime(value: string): { hour: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minutes: Number(m[2]) };
}

export function HorariosScreen() {
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [inboxId, setInboxId] = useState<string>("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [hours, setHours] = useState<CrmWorkingHourDto[]>(defaultWeekHours());
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet("/api/saas/crm/inboxes")
      .then((d) => {
        const items = asPage<CrmInboxDto>(d).items;
        setInboxes(items);
        if (items[0]) setInboxId(items[0].id);
      })
      .catch(() => setInboxes([]));
  }, []);

  const load = useCallback(async () => {
    if (!inboxId) return;
    setStatus("loading");
    try {
      const data = await apiGet<CrmWorkingHoursDto>(
        `/api/saas/crm/inboxes/${inboxId}/horarios`,
      );
      setTimezone(data.timezone || "America/Sao_Paulo");
      const byDay = new Map((data.hours ?? []).map((h) => [h.day_of_week, h]));
      setHours(
        defaultWeekHours().map((d) => {
          const existing = byDay.get(d.day_of_week);
          return existing ? { ...d, ...existing } : d;
        }),
      );
      const estado = await apiGet<{ open_now?: boolean }>(
        `/api/saas/crm/inboxes/${inboxId}/horarios/estado`,
      ).catch(() => ({ open_now: undefined }));
      setOpenNow(typeof estado.open_now === "boolean" ? estado.open_now : null);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [inboxId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!inboxId) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/inboxes/${inboxId}/horarios`, "PUT", {
        timezone,
        hours,
      });
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  function updateDay(day: number, patch: Partial<CrmWorkingHourDto>) {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)));
  }

  return (
    <SaasPage title={COPY.crm.horarios_title}>
      <Card className="mb-6 max-w-3xl">
        <CardHeader>
          <CardTitle>{COPY.crm.horarios_title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Caixa de entrada</Label>
            <Select value={inboxId} onValueChange={setInboxId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={COPY.crm.horarios_empty} />
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

          {!inboxId ? (
            <p className="text-sm text-muted-foreground">{COPY.crm.horarios_empty}</p>
          ) : status === "loading" ? (
            <FormSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : (
            <form className="space-y-4" onSubmit={onSave}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="tz">Fuso (IANA)</Label>
                  <Input
                    id="tz"
                    className="mt-1"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </div>
                {openNow != null ? (
                  <Badge variant={openNow ? "default" : "secondary"} className="self-end">
                    {openNow ? "Aberto agora" : "Fechado agora"}
                  </Badge>
                ) : null}
              </div>

              <ul className="space-y-3">
                {hours.map((h) => (
                  <li
                    key={h.day_of_week}
                    className="grid gap-2 rounded-md border p-3 sm:grid-cols-[120px_1fr]"
                  >
                    <p className="text-sm font-medium">{DAY_LABELS_PT[h.day_of_week]}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={Boolean(h.closed_all_day)}
                          onCheckedChange={(v) =>
                            updateDay(h.day_of_week, {
                              closed_all_day: Boolean(v),
                              open_all_day: false,
                            })
                          }
                        />
                        Fechado
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={Boolean(h.open_all_day)}
                          onCheckedChange={(v) =>
                            updateDay(h.day_of_week, {
                              open_all_day: Boolean(v),
                              closed_all_day: false,
                            })
                          }
                        />
                        24h
                      </label>
                      {!h.closed_all_day && !h.open_all_day ? (
                        <>
                          <Input
                            type="time"
                            className="w-[120px]"
                            value={padTime(h.open_hour, h.open_minutes)}
                            onChange={(e) => {
                              const t = parseTime(e.target.value);
                              if (!t) return;
                              updateDay(h.day_of_week, {
                                open_hour: t.hour,
                                open_minutes: t.minutes,
                              });
                            }}
                          />
                          <span className="text-sm text-muted-foreground">até</span>
                          <Input
                            type="time"
                            className="w-[120px]"
                            value={padTime(h.close_hour, h.close_minutes)}
                            onChange={(e) => {
                              const t = parseTime(e.target.value);
                              if (!t) return;
                              updateDay(h.day_of_week, {
                                close_hour: t.hour,
                                close_minutes: t.minutes,
                              });
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              <Button type="submit" disabled={busy}>
                {COPY.actions.salvar}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
