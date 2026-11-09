"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { formatDate } from "../../format";
import {
  defaultReportRange,
  REPORT_SERIES,
  reportQuery,
  type ReportSeriesKey,
} from "../../crm/phase-c";
import type { CrmInboxDto, CrmReportDto, CrmTeamDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

function TotalsGrid({ totals }: { totals: Record<string, number | string | null> }) {
  const entries = Object.entries(totals ?? {});
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">{COPY.crm.relatorios_empty_totals}</p>;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
          <dd className="mt-1 text-lg font-medium text-gray-900">
            {value === null || value === undefined ? "—" : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SeriesTable({
  series,
  rows,
}: {
  series: CrmReportDto["series"];
  rows?: CrmReportDto["rows"];
}) {
  const tableRows = rows?.length
    ? rows
    : (series ?? []).map((point) => {
        const { date, ...rest } = point;
        return { date, ...rest } as Record<string, string | number | null>;
      });

  if (!tableRows.length) {
    return <p className="mt-4 text-sm text-muted-foreground">{COPY.crm.relatorios_empty_series}</p>;
  }

  const columns = Array.from(
    tableRows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="px-2 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => (
            <tr key={i} className="border-b border-border/60">
              {columns.map((c) => (
                <td key={c} className="px-2 py-2 text-gray-900">
                  {row[c] === null || row[c] === undefined ? "—" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportPanel({
  path,
  from,
  to,
  inboxId,
  teamId,
}: {
  path: string;
  from: string;
  to: string;
  inboxId: string;
  teamId: string;
}) {
  const [data, setData] = useState<CrmReportDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "forbidden">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const qs = reportQuery({
        from,
        to,
        inbox_id: inboxId !== "all" ? inboxId : undefined,
        team_id: teamId !== "all" ? teamId : undefined,
      });
      const report = await apiGet<CrmReportDto>(`/api/saas/crm/relatorios/${path}?${qs}`);
      setData(report);
      setStatus("ok");
    } catch (err) {
      if (isApiError(err) && err.status === 403) setStatus("forbidden");
      else setStatus("error");
    }
  }, [path, from, to, inboxId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") return <TableSkeleton />;
  if (status === "forbidden") {
    return <p className="text-sm text-red-500">{COPY.forbidden}</p>;
  }
  if (status === "error" || !data) {
    return <ErrorState onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {COPY.crm.relatorios_generated_at}: {formatDate(data.generated_at)}
      </p>
      <TotalsGrid totals={data.totals ?? {}} />
      <SeriesTable series={data.series ?? []} rows={data.rows} />
    </div>
  );
}

export function RelatoriosScreen() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [inboxId, setInboxId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [applied, setApplied] = useState(initial);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [teams, setTeams] = useState<CrmTeamDto[]>([]);
  const [tab, setTab] = useState<ReportSeriesKey>(REPORT_SERIES[0]!.key);

  useEffect(() => {
    void Promise.all([
      apiGet("/api/saas/crm/inboxes").then((d) => setInboxes(asPage<CrmInboxDto>(d).items)),
      apiGet("/api/saas/crm/teams").then((d) => setTeams(asPage<CrmTeamDto>(d).items)),
    ]).catch(() => {
      setInboxes([]);
      setTeams([]);
    });
  }, []);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ from, to });
  }

  const seriesLabel = (key: (typeof REPORT_SERIES)[number]["labelKey"]) => COPY.crm[key];

  return (
    <SaasPage title={COPY.crm.nav_relatorios}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{COPY.crm.relatorios_filters}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={applyFilters}>
            <div>
              <Label htmlFor="rep-from">{COPY.crm.relatorios_from}</Label>
              <Input
                id="rep-from"
                type="date"
                className="mt-1"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rep-to">{COPY.crm.relatorios_to}</Label>
              <Input
                id="rep-to"
                type="date"
                className="mt-1"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Caixa</Label>
              <Select value={inboxId} onValueChange={setInboxId}>
                <SelectTrigger className="mt-1 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{COPY.filter_todos}</SelectItem>
                  {inboxes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="mt-1 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{COPY.filter_todos}</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">{COPY.crm.relatorios_apply}</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{COPY.crm.relatorios_range_hint}</p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportSeriesKey)}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          {REPORT_SERIES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {seriesLabel(s.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        {REPORT_SERIES.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{seriesLabel(s.labelKey)}</CardTitle>
              </CardHeader>
              <CardContent>
                {tab === s.key ? (
                  <ReportPanel
                    path={s.path}
                    from={applied.from}
                    to={applied.to}
                    inboxId={inboxId}
                    teamId={teamId}
                  />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </SaasPage>
  );
}
