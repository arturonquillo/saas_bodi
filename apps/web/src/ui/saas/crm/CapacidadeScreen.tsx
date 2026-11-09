"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { apiGet, apiSend, asPage, isApiError, type UserDto } from "../../api";
import { COPY } from "../../copy";
import { listCapacidade, putCapacidade } from "../../crm/phase-e";
import type { CrmAgentCapacityDto, CrmAssignmentPolicyDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

export function CapacidadeScreen() {
  const [rows, setRows] = useState<CrmAgentCapacityDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [inboxId, setInboxId] = useState("");
  const [kind, setKind] = useState<"round_robin" | "balanced">("balanced");
  const [enabled, setEnabled] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [cap, userPage, boxes] = await Promise.all([
        listCapacidade(),
        apiGet("/api/saas/usuarios").then((d) => asPage<UserDto>(d).items),
        apiGet("/api/saas/crm/inboxes").then((d) => asPage<CrmInboxDto>(d).items),
      ]);
      setRows(cap.items);
      setUsers(userPage.filter((u) => u.ativo && u.saas_role));
      setInboxes(boxes);
      const map: Record<string, number> = {};
      for (const u of userPage) {
        const found = cap.items.find((c) => c.user_id === u.id);
        map[u.id] = found?.max_open_conversations ?? 10;
      }
      setLimits(map);
      if (!inboxId && boxes[0]) setInboxId(boxes[0].id);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [inboxId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPolicy = useCallback(async () => {
    if (!inboxId) return;
    try {
      const policy = await apiGet<CrmAssignmentPolicyDto>(
        `/api/saas/crm/inboxes/${inboxId}/politica-atribuicao`,
      );
      setEnabled(Boolean(policy.enabled));
      setKind(policy.kind === "balanced" ? "balanced" : "round_robin");
    } catch {
      /* keep previous */
    }
  }, [inboxId]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  async function saveCapacidade() {
    setBusy(true);
    try {
      const payload = users.map((u) => ({
        user_id: u.id,
        max_open_conversations: Math.max(1, Number(limits[u.id] ?? 10)),
      }));
      await putCapacidade(payload);
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!inboxId) return;
    setBusy(true);
    try {
      await apiSend(`/api/saas/crm/inboxes/${inboxId}/politica-atribuicao`, "PUT", {
        kind,
        enabled,
      });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.nav_capacidade}>
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>{COPY.crm.capacidade_assignment}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePolicy}>
            <div>
              <Label>Caixa</Label>
              <Select value={inboxId} onValueChange={setInboxId}>
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
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as "round_robin" | "balanced")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">{COPY.crm.atribuicao_round_robin}</SelectItem>
                  <SelectItem value="balanced">{COPY.crm.atribuicao_balanced}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{COPY.crm.capacidade_balanced_hint}</p>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
              Habilitar atribuição automática
            </label>
            <Button type="submit" disabled={busy || !inboxId}>
              {COPY.actions.salvar}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{COPY.crm.capacidade_title}</CardTitle>
            <Button type="button" disabled={busy} onClick={() => void saveCapacidade()}>
              {COPY.actions.salvar}
            </Button>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.capacidade_empty}
              </p>
            ) : (
              <ul className="space-y-4">
                {users.map((u) => {
                  const open = rows.find((r) => r.user_id === u.id)?.open_count;
                  return (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{u.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.email}
                          {typeof open === "number" ? ` · abertas: ${open}` : ""}
                        </p>
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Máx. abertas</Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1"
                          value={limits[u.id] ?? 10}
                          onChange={(e) =>
                            setLimits((prev) => ({
                              ...prev,
                              [u.id]: Number(e.target.value || 1),
                            }))
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </SaasPage>
  );
}
