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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, isApiError } from "../../api";
import { COPY } from "../../copy";
import type { AgentAvailability, CrmPerfilDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, FormSkeleton } from "../../states";

export function PerfilScreen() {
  const [perfil, setPerfil] = useState<CrmPerfilDto>({
    availability: "online",
    signature: "",
  });
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const p = await apiGet<CrmPerfilDto>("/api/saas/crm/perfil");
      setPerfil({
        availability: (p.availability as AgentAvailability) || "online",
        signature: p.signature ?? "",
      });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiSend("/api/saas/crm/perfil", "PATCH", perfil);
      await apiSend("/api/saas/crm/presence", "POST", { state: perfil.availability });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage title={COPY.crm.nav_perfil_crm}>
      {status === "loading" ? (
        <FormSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{COPY.crm.nav_perfil_crm}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSave}>
              <div>
                <Label>{COPY.crm.perfil_availability}</Label>
                <Select
                  value={String(perfil.availability)}
                  onValueChange={(v) =>
                    setPerfil((p) => ({ ...p, availability: v as AgentAvailability }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">{COPY.crm.availability_online}</SelectItem>
                    <SelectItem value="busy">{COPY.crm.availability_busy}</SelectItem>
                    <SelectItem value="offline">{COPY.crm.availability_offline}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="signature">{COPY.crm.perfil_signature}</Label>
                <Textarea
                  id="signature"
                  className="mt-1"
                  rows={4}
                  value={perfil.signature ?? ""}
                  onChange={(e) => setPerfil((p) => ({ ...p, signature: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {COPY.actions.salvar}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </SaasPage>
  );
}
