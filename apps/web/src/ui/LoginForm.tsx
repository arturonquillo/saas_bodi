"use client";

import { useState } from "react";
import type { SessionDto, Surface } from "@saas-frota/shared";
import { Loader2 } from "lucide-react";
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
  const starter = surface === "saas";

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

  const inputClass = starter
    ? "appearance-none relative block w-full rounded-full border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
    : "h-11";

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div>
        <Label
          htmlFor={`${surface}-email`}
          className={starter ? "block text-sm font-medium text-gray-700" : "mb-2"}
        >
          {COPY.email}
        </Label>
        <div className={starter ? "mt-1" : undefined}>
          <Input
            id={`${surface}-email`}
            name="email"
            type="email"
            required
            autoComplete="username"
            className={inputClass}
            placeholder={starter ? COPY.email : undefined}
          />
        </div>
      </div>
      <div>
        <Label
          htmlFor={`${surface}-password`}
          className={starter ? "block text-sm font-medium text-gray-700" : "mb-2"}
        >
          {COPY.password}
        </Label>
        <div className={starter ? "mt-1" : undefined}>
          <Input
            id={`${surface}-password`}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            placeholder={starter ? COPY.password : undefined}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Button
        type="submit"
        disabled={busy}
        className={
          starter
            ? "flex w-full items-center justify-center rounded-full border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            : "h-11 w-full"
        }
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {COPY.submit_login}
          </>
        ) : (
          COPY.submit_login
        )}
      </Button>
    </form>
  );
}
