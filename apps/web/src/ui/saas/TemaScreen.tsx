"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThemeTokens } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiSend, isApiError } from "../api";
import { COPY } from "../copy";
import { SaasPage } from "../layout";
import { themePassesContrast, themeStyle } from "../theme/apply-tokens";
import { useTenantTheme } from "../theme/TenantTheme";
import { ErrorState, FormSkeleton } from "../states";

const empty: ThemeTokens = {
  marca: COPY.marca,
  primary: "#7A1F1F",
  accent: "#1F5C6B",
  background: "#EEF2F4",
  logo_url: null,
};

export function TemaScreen() {
  const { refresh: refreshShell } = useTenantTheme();
  const [saved, setSaved] = useState<ThemeTokens | null>(null);
  const [draft, setDraft] = useState<ThemeTokens>(empty);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await apiGet<ThemeTokens>("/api/saas/tema");
      setSaved(data);
      setDraft(data);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(draft) : false;
  const contrastOk = themePassesContrast(draft);

  async function save() {
    if (!contrastOk) {
      setError(COPY.theme_contrast_fail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<ThemeTokens>("/api/saas/tema", "PUT", draft);
      setSaved(next);
      setDraft(next);
      await refreshShell();
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    if (saved) setDraft(saved);
    setDiscardOpen(false);
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.theme_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error") {
    return (
      <SaasPage title={COPY.theme_title}>
        <ErrorState onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={COPY.theme_title}
      description={COPY.theme_page_desc}
      actions={
        <>
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDiscardOpen(true)}>
            {COPY.actions.cancelar}
          </Button>
          <Button
            type="button"
            className="bg-primary text-white hover:bg-primary/90"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {COPY.theme_save}
          </Button>
        </>
      }
    >
      {discardOpen ? (
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle>{COPY.actions.cancelar}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{COPY.discard_theme}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
                {COPY.actions.fechar}
              </Button>
              <Button
                type="button"
                className="bg-primary text-white hover:bg-primary/90"
                onClick={discard}
              >
                {COPY.actions.confirmar}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-8 shadow-sm">
        <CardHeader>
          <CardTitle>Tokens da marca</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div>
              <Label htmlFor="marca" className="mb-2">
                {COPY.theme_marca}
              </Label>
              <Input
                id="marca"
                value={draft.marca}
                onChange={(e) => setDraft({ ...draft, marca: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="primary" className="mb-2">
                {COPY.theme_primary}
              </Label>
              <Input
                id="primary"
                type="color"
                value={draft.primary}
                onChange={(e) => setDraft({ ...draft, primary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="accent" className="mb-2">
                {COPY.theme_accent}
              </Label>
              <Input
                id="accent"
                type="color"
                value={draft.accent}
                onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="background" className="mb-2">
                {COPY.theme_background}
              </Label>
              <Input
                id="background"
                type="color"
                value={draft.background}
                onChange={(e) => setDraft({ ...draft, background: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="logo" className="mb-2">
                {COPY.theme_logo}
              </Label>
              <Input
                id="logo"
                value={draft.logo_url ?? ""}
                onChange={(e) => setDraft({ ...draft, logo_url: e.target.value || null })}
                placeholder="https://…"
              />
            </div>
            {!contrastOk ? <p className="text-sm text-red-500">{COPY.theme_contrast_fail}</p> : null}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button
              type="submit"
              className="bg-primary text-white hover:bg-primary/90"
              disabled={busy || !dirty}
            >
              {COPY.theme_save}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-8 shadow-sm">
        <CardHeader className="border-b border-border bg-muted/40">
          <CardTitle>{COPY.theme_preview}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-hidden rounded-md border border-gray-200"
            style={themeStyle(draft)}
            data-theme="tenant"
          >
            <div className="space-y-4 p-4" style={{ background: "var(--color-background)" }}>
              <p className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
                {draft.marca || COPY.marca}
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                R$ 89,90
              </p>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={{ background: "var(--color-primary)", color: "var(--color-text-on-primary)" }}
              >
                Botão primário
              </button>
              <div
                className="rounded-md border bg-white p-3 text-xs"
                style={{ borderColor: "var(--color-border)" }}
              >
                <ul className="space-y-1">
                  <li className="flex justify-between gap-2">
                    <span>SKU</span>
                    <span>12</span>
                  </li>
                </ul>
              </div>
              <div className="flex gap-2 text-xs">
                <span
                  className="rounded px-2 py-1"
                  style={{
                    background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                    color: "var(--color-success)",
                  }}
                >
                  Aprovado
                </span>
                <span
                  className="rounded px-2 py-1"
                  style={{
                    background: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
                    color: "var(--color-warning)",
                  }}
                >
                  Pendente
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </SaasPage>
  );
}
