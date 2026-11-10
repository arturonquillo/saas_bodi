"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "sf-saas-layout:";

export const LAYOUT_KEYS = {
  sidebarCollapsed: `${PREFIX}sidebarCollapsed`,
  conversasFiltersOpen: `${PREFIX}conversasFiltersOpen`,
  conversasContatoOpen: `${PREFIX}conversasContatoOpen`,
  conversasListWidth: `${PREFIX}conversasListWidth`,
} as const;

export const LIST_WIDTH_DEFAULT = 320;
export const LIST_WIDTH_MIN = 240;
export const LIST_WIDTH_MAX = 480;
export const CONTATO_WIDTH_DEFAULT = 320;
export const CONTATO_WIDTH_MIN = 300;
export const FILTER_RAIL_WIDTH = 220;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function readBool(key: string, fallback: boolean): boolean {
  const raw = readRaw(key);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

export function writeBool(key: string, value: boolean) {
  writeRaw(key, value ? "1" : "0");
}

export function clampListWidth(px: number): number {
  if (!Number.isFinite(px)) return LIST_WIDTH_DEFAULT;
  return Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, Math.round(px)));
}

export function readListWidth(): number {
  const raw = readRaw(LAYOUT_KEYS.conversasListWidth);
  if (!raw) return LIST_WIDTH_DEFAULT;
  return clampListWidth(Number(raw));
}

export function writeListWidth(px: number) {
  writeRaw(LAYOUT_KEYS.conversasListWidth, String(clampListWidth(px)));
}

/** SSR-safe boolean layout pref with localStorage persistence. */
export function usePersistedBool(key: string, fallback: boolean) {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readBool(key, fallback));
    setHydrated(true);
  }, [key, fallback]);

  const setPersisted = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeBool(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, setPersisted, hydrated] as const;
}

/** SSR-safe list width pref. */
export function usePersistedListWidth() {
  const [width, setWidth] = useState(LIST_WIDTH_DEFAULT);

  useEffect(() => {
    setWidth(readListWidth());
  }, []);

  const setPersisted = useCallback((next: number | ((prev: number) => number)) => {
    setWidth((prev) => {
      const resolved = clampListWidth(typeof next === "function" ? next(prev) : next);
      writeListWidth(resolved);
      return resolved;
    });
  }, []);

  return [width, setPersisted] as const;
}
