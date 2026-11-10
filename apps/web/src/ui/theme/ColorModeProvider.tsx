"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  applyDocumentColorMode,
  clearDocumentColorMode,
  persistColorMode,
  readStoredColorMode,
  resolveColorMode,
  type ColorMode,
  type ResolvedColorMode,
} from "./color-mode";

type ColorModeCtx = {
  mode: ColorMode;
  resolved: ResolvedColorMode;
  setMode: (mode: ColorMode) => void;
};

const Ctx = createContext<ColorModeCtx>({
  mode: "system",
  resolved: "light",
  setMode: () => {},
});

export function useColorMode() {
  return useContext(Ctx);
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>("system");
  const [resolved, setResolved] = useState<ResolvedColorMode>("light");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const stored = readStoredColorMode();
    const next = resolveColorMode(stored);
    setModeState(stored);
    setResolved(next);
    applyDocumentColorMode(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      const next = resolveColorMode(mode);
      setResolved(next);
      applyDocumentColorMode(next);
    };
    apply();
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode, ready]);

  useEffect(() => () => clearDocumentColorMode(), []);

  const setMode = useCallback((next: ColorMode) => {
    persistColorMode(next);
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
