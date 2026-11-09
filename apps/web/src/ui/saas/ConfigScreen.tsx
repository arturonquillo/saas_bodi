"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanalAviso, LojaModo } from "@saas-frota/shared";
import type { SaasConfigDto, UserDto } from "../api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiSend, asPage, isApiError, maskFromLast4 } from "../api";
import { COPY } from "../copy";
import { ListHeader, SaasMain } from "../layout";
import { ErrorState, FormSkeleton } from "../states";

export function ConfigScreen() {
  const [config, setConfig] = useState<SaasConfigDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [cfg, page] = await Promise.all([
        apiGet<SaasConfigDto>("/api/saas/config"),
        apiGet("/api/saas/usuarios").then((d) => asPage<UserDto>(d)),
      ]);
      setConfig(cfg);
      setUsers(page.items.filter((u) => u.ativo));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const next = await apiSend<SaasConfigDto>("/api/saas/config", "PUT", config);
      setConfig(next);
      setOk(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasMain>
        <FormSkeleton />
      </SaasMain>
    );
  }
  if (status === "error" || !config) {
    return (
      <SaasMain>
        <ErrorState onRetry={() => void load()} />
      </SaasMain>
    );
  }

  return (
    <SaasMain>
      <ListHeader title={COPY.config_title} />
      <form className="max-w-xl space-y-4" onSubmit={save}>
        <Field>
          <FieldLabel htmlFor="razao">{COPY.razao_social_tenant}</FieldLabel>
          <Input
            id="razao"
            value={config.razao_social}
            onChange={(e) => setConfig({ ...config, razao_social: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fantasia">{COPY.nome_fantasia}</FieldLabel>
          <Input
            id="fantasia"
            value={config.nome_fantasia}
            onChange={(e) => setConfig({ ...config, nome_fantasia: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>{COPY.cnpj}</FieldLabel>
          <Input value={maskFromLast4(config.cnpj_last4)} disabled readOnly />
        </Field>
        <Field>
          <FieldLabel htmlFor="wa">{COPY.whatsapp_comercial}</FieldLabel>
          <Input
            id="wa"
            value={config.whatsapp_comercial ?? ""}
            onChange={(e) => setConfig({ ...config, whatsapp_comercial: e.target.value || null })}
          />
        </Field>
        <Field>
          <FieldLabel>{COPY.canais}</FieldLabel>
          <Select
            value={config.canais_aviso}
            onValueChange={(v) => setConfig({ ...config, canais_aviso: v as CanalAviso })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">{COPY.canal_email}</SelectItem>
              <SelectItem value="whatsapp">{COPY.canal_whatsapp}</SelectItem>
              <SelectItem value="ambos">{COPY.canal_ambos}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{COPY.loja_modo}</FieldLabel>
          <Select
            value={config.loja_modo}
            onValueChange={(v) => setConfig({ ...config, loja_modo: v as LojaModo })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pedido_direto">{COPY.loja_modo_pedido}</SelectItem>
              <SelectItem value="orcamento">{COPY.loja_modo_orcamento}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{COPY.default_vendedor}</FieldLabel>
          <Select
            value={config.default_vendedor_user_id ?? "none"}
            onValueChange={(v) =>
              setConfig({ ...config, default_vendedor_user_id: v === "none" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {error ? (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {ok ? (
          <Alert className="border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
            <AlertDescription>Configuração salva.</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={busy}>
          {COPY.actions.salvar}
        </Button>
      </form>
    </SaasMain>
  );
}
