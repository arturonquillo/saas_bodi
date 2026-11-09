"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThemeTokens } from "@saas-frota/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiGet, apiSend, isApiError } from "../api";
import { COPY } from "../copy";
import { ListHeader, SaasMain } from "../layout";
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
      <SaasMain>
        <FormSkeleton />
      </SaasMain>
    );
  }
  if (status === "error") {
    return (
      <SaasMain>
        <ErrorState onRetry={() => void load()} />
      </SaasMain>
    );
  }

  return (
    <SaasMain>
      <ListHeader
        title={COPY.theme_title}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDiscardOpen(true)}>
              {COPY.actions.cancelar}
            </Button>
            <Button type="button" disabled={busy || !dirty} onClick={() => void save()}>
              {COPY.theme_save}
            </Button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field>
            <FieldLabel htmlFor="marca">{COPY.theme_marca}</FieldLabel>
            <Input
              id="marca"
              value={draft.marca}
              onChange={(e) => setDraft({ ...draft, marca: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="primary">{COPY.theme_primary}</FieldLabel>
            <Input
              id="primary"
              type="color"
              value={draft.primary}
              onChange={(e) => setDraft({ ...draft, primary: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="accent">{COPY.theme_accent}</FieldLabel>
            <Input
              id="accent"
              type="color"
              value={draft.accent}
              onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="background">{COPY.theme_background}</FieldLabel>
            <Input
              id="background"
              type="color"
              value={draft.background}
              onChange={(e) => setDraft({ ...draft, background: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="logo">{COPY.theme_logo}</FieldLabel>
            <Input
              id="logo"
              value={draft.logo_url ?? ""}
              onChange={(e) => setDraft({ ...draft, logo_url: e.target.value || null })}
              placeholder="https://…"
            />
          </Field>
          {!contrastOk ? (
            <Alert>
              <AlertDescription>{COPY.theme_contrast_fail}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <div>
          <p className="mb-2 text-sm font-semibold">{COPY.theme_preview}</p>
          <div
            className="overflow-hidden rounded-md border border-border"
            style={themeStyle(draft)}
            data-theme="tenant"
          >
            <div className="space-y-4 p-4" style={{ background: "var(--color-background)" }}>
              <p className="font-display text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
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
              <div className="rounded-md border bg-white p-3 text-xs" style={{ borderColor: "var(--color-border)" }}>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td>SKU</td>
                      <td className="text-right">12</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded px-2 py-1" style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)", color: "var(--color-success)" }}>
                  Aprovado
                </span>
                <span className="rounded px-2 py-1" style={{ background: "color-mix(in srgb, var(--color-warning) 15%, transparent)", color: "var(--color-warning)" }}>
                  Pendente
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{COPY.actions.cancelar}</AlertDialogTitle>
            <AlertDialogDescription>{COPY.discard_theme}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{COPY.actions.fechar}</AlertDialogCancel>
            <AlertDialogAction onClick={discard}>{COPY.actions.confirmar}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SaasMain>
  );
}
