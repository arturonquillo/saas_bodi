"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ThemeTokens } from "@saas-frota/shared";
import { apiGet } from "../api";
import { themeStyle } from "./apply-tokens";

type ThemeCtx = {
  tokens: ThemeTokens | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ThemeCtx>({ tokens: null, refresh: async () => {} });

export function useTenantTheme() {
  return useContext(Ctx);
}

export function TenantTheme({
  children,
  density,
}: {
  children: React.ReactNode;
  density: "comfortable" | "compact";
}) {
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await apiGet<ThemeTokens>("/api/loja/tema?tenant=casa-dos-frios");
      setTokens(next);
    } catch {
      /* keep CSS seed fallbacks */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ tokens, refresh }), [tokens, refresh]);

  return (
    <Ctx.Provider value={value}>
      <div
        className="min-h-dvh bg-background text-foreground"
        data-theme="tenant"
        data-density={density}
        style={tokens ? themeStyle(tokens) : undefined}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}
