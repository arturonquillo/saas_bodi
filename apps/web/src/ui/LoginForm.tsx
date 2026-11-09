"use client";

import { useState } from "react";
import type { SessionDto, Surface } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiSend, isApiError } from "./api";
import { COPY } from "./copy";

export function LoginForm({
  surface,
  redirectTo,
  onSuccess,
}: {
  surface: Exclude<Surface, never>;
  redirectTo: string;
  onSuccess?: (session: SessionDto) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tall = surface === "loja";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const session = await apiSend<SessionDto>(`/api/${surface}/login`, "POST", {
        email: fd.get("email"),
        password: fd.get("password"),
        tenant: "casa-dos-frios",
      });
      if (onSuccess) onSuccess(session);
      else window.location.href = redirectTo;
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || COPY.login_error);
      } else {
        setError(COPY.save_fail);
      }
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <Field>
        <FieldLabel htmlFor={`${surface}-email`}>{COPY.email}</FieldLabel>
        <Input
          id={`${surface}-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          className={tall ? "h-11" : undefined}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${surface}-password`}>{COPY.password}</FieldLabel>
        <Input
          id={`${surface}-password`}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={tall ? "h-11" : undefined}
        />
      </Field>
      <Button type="submit" disabled={busy} className={tall ? "h-11 w-full" : "w-full"}>
        {COPY.submit_login}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}
