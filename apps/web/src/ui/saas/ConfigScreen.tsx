"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanalAviso, LojaModo } from "@saas-frota/shared";
import type { SaasConfigDto, UserDto } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiGet, apiSend, asPage, isApiError, maskFromLast4 } from "../api";
import { COPY } from "../copy";
import { ListHeader, SaasMain } from "../layout";
import { ErrorState, FormSkeleton } from "../states";

const selectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

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
        <div>
          <Label htmlFor="razao" className="mb-2">
            {COPY.razao_social_tenant}
          </Label>
          <Input
            id="razao"
            value={config.razao_social}
            onChange={(e) => setConfig({ ...config, razao_social: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="fantasia" className="mb-2">
            {COPY.nome_fantasia}
          </Label>
          <Input
            id="fantasia"
            value={config.nome_fantasia}
            onChange={(e) => setConfig({ ...config, nome_fantasia: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-2">{COPY.cnpj}</Label>
          <Input value={maskFromLast4(config.cnpj_last4)} disabled readOnly />
        </div>
        <div>
          <Label htmlFor="wa" className="mb-2">
            {COPY.whatsapp_comercial}
          </Label>
          <Input
            id="wa"
            value={config.whatsapp_comercial ?? ""}
            onChange={(e) => setConfig({ ...config, whatsapp_comercial: e.target.value || null })}
          />
        </div>
        <div>
          <Label className="mb-2">{COPY.canais}</Label>
          <RadioGroup
            value={config.canais_aviso}
            onValueChange={(v) => setConfig({ ...config, canais_aviso: v as CanalAviso })}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="email" id="canal-email" />
              <Label htmlFor="canal-email">{COPY.canal_email}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="whatsapp" id="canal-wa" />
              <Label htmlFor="canal-wa">{COPY.canal_whatsapp}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ambos" id="canal-ambos" />
              <Label htmlFor="canal-ambos">{COPY.canal_ambos}</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label className="mb-2">{COPY.loja_modo}</Label>
          <RadioGroup
            value={config.loja_modo}
            onValueChange={(v) => setConfig({ ...config, loja_modo: v as LojaModo })}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pedido_direto" id="modo-pedido" />
              <Label htmlFor="modo-pedido">{COPY.loja_modo_pedido}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="orcamento" id="modo-orc" />
              <Label htmlFor="modo-orc">{COPY.loja_modo_orcamento}</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="vendedor" className="mb-2">
            {COPY.default_vendedor}
          </Label>
          <select
            id="vendedor"
            className={selectClass}
            value={config.default_vendedor_user_id ?? "none"}
            onChange={(e) =>
              setConfig({
                ...config,
                default_vendedor_user_id: e.target.value === "none" ? null : e.target.value,
              })
            }
          >
            <option value="none">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {ok ? (
          <p className="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-3 py-2 text-sm">
            Configuração salva.
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {COPY.actions.salvar}
        </Button>
      </form>
    </SaasMain>
  );
}
