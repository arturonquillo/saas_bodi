"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThemeTokens } from "@saas-frota/shared";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiGet, apiSend, isApiError } from "../api";
import { COPY } from "../copy";
import { ListHeader, SaasMain } from "../layout";
import { themePassesContrast, themeStyle } from "../theme/apply-tokens";
import { useTenantTheme } from "../theme/TenantTheme";
import { ErrorState, FormSkeleton } from "../states";

export function TemaScreen() {
  const { refresh } = useTenantTheme();
  const [saved, setSaved] = useState<ThemeTokens | null>(null);
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
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

  const dirty =
    !!saved &&
    !!draft &&
    (saved.marca !== draft.marca ||
      saved.primary !== draft.primary ||
      saved.accent !== draft.accent ||
      saved.background !== draft.background ||
      saved.logo_url !== draft.logo_url);

  async function save() {
    if (!draft) return;
    if (!themePassesContrast(draft)) {
      setError(COPY.theme_contrast_fail);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<ThemeTokens>("/api/saas/tema", "PUT", draft);
      setSaved(next);
      setDraft(next);
      await refresh();
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
  if (status === "error" || !draft) {
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

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
          {error ? (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <div
          className="overflow-hidden rounded-md border border-border bg-card p-4"
          style={themeStyle(draft)}
        >
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {COPY.theme_preview}
          </p>
          <div
            className="mb-4 rounded-md p-6"
            style={{ background: "var(--color-background)" }}
          >
            <p className="font-display text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              {draft.marca || COPY.marca}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              {COPY.hero_support}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={{ background: "var(--color-primary)", color: "var(--color-text-on-primary)" }}
              >
                {COPY.cta_whatsapp}
              </button>
              <span className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                R$ 89,90
              </span>
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-border)] bg-white p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span style={{ color: "var(--color-text)" }}>Pedido PED-1</span>
              <span
                className="rounded px-2 py-0.5 text-xs"
                style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", color: "var(--color-primary)" }}
              >
                Confirmado
              </span>
            </div>
            <div className="h-2 rounded" style={{ background: "var(--color-accent)", opacity: 0.35 }} />
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
            <AlertDialogAction
              onClick={() => {
                if (saved) setDraft(saved);
                setDiscardOpen(false);
              }}
            >
              {COPY.actions.confirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SaasMain>
  );
}
