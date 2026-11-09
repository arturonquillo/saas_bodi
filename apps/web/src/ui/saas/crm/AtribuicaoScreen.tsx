"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import type { CrmAssignmentPolicyDto, CrmInboxDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, FormSkeleton } from "../../states";

export function AtribuicaoScreen() {
  const [inboxes, setInboxes] = useState<CrmInboxDto[]>([]);
  const [inboxId, setInboxId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [kind, setKind] = useState<"round_robin" | "balanced">("round_robin");
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
      const policy = await apiGet<CrmAssignmentPolicyDto>(
        `/api/saas/crm/inboxes/${inboxId}/politica-atribuicao`,
      );
      setEnabled(Boolean(policy.enabled));
      setKind(policy.kind === "balanced" ? "balanced" : "round_robin");
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
      await apiSend(`/api/saas/crm/inboxes/${inboxId}/politica-atribuicao`, "PUT", {
        kind,
        enabled,
      });
      if (enabled) {
        await apiSend(`/api/saas/crm/inboxes/${inboxId}`, "PATCH", {
          allow_auto_assign: true,
        }).catch(() => undefined);
      }
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.atribuicao_title}>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{COPY.crm.atribuicao_title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Caixa de entrada</Label>
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

          {!inboxId ? (
            <p className="text-sm text-muted-foreground">Selecione uma caixa.</p>
          ) : status === "loading" ? (
            <FormSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : (
            <form className="space-y-4" onSubmit={onSave}>
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
              <p className="text-sm text-muted-foreground">
                {kind === "balanced"
                  ? COPY.crm.capacidade_balanced_hint
                  : `${COPY.crm.atribuicao_round_robin}: atribui apenas entre membros online da caixa (ocupado/offline são ignorados).`}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
                Habilitar atribuição automática
              </label>
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
