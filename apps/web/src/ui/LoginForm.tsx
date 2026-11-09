"use client";

import { useState } from "react";
import type { SessionDto, Surface } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <form className="space-y-6" onSubmit={onSubmit}>
      <div>
        <Label htmlFor={`${surface}-email`} className="mb-2">
          {COPY.email}
        </Label>
        <Input
          id={`${surface}-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          className={tall ? "h-11" : undefined}
        />
      </div>
      <div>
        <Label htmlFor={`${surface}-password`} className="mb-2">
          {COPY.password}
        </Label>
        <Input
          id={`${surface}-password`}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={tall ? "h-11" : undefined}
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button type="submit" disabled={busy} className={tall ? "h-11 w-full" : "w-full"}>
        {COPY.submit_login}
      </Button>
    </form>
  );
}
