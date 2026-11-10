import type { CSSProperties } from "react";
import type { ThemeTokens } from "@saas-frota/shared";
import { THEME_CSS_VARS } from "@saas-frota/shared";
import type { ResolvedColorMode } from "./color-mode";

/** Design locked contrast pair — docs/design/tokens.md */
const TEXT = "#141A1F";
const ON_PRIMARY = "#F7F1F0";
const ON_ACCENT = "#F2F8FA";
const DARK_CANVAS = "#12181C";

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function srgbToLin(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(srgbToLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex: string, toward: string, t: number) {
  const a = parseHex(hex);
  const b = parseHex(toward);
  if (!a || !b) return hex;
  return toHex([
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]);
}

export function textOnPrimary(_bg: string) {
  void _bg;
  return ON_PRIMARY;
}

export function themePassesContrast(tokens: ThemeTokens) {
  return contrastRatio(TEXT, tokens.background) >= 4.5 && contrastRatio(ON_PRIMARY, tokens.primary) >= 4.5;
}

/**
 * Apply tenant editor-contract vars on Loja/SaaS.
 * Never assign tenant --color-background to --background or --color-accent to shadcn --accent.
 * Surface/text/border stay in CSS so `.dark` can remap them; only editable brand slots go inline.
 */
export function themeStyle(tokens: ThemeTokens, resolved: ResolvedColorMode = "light"): CSSProperties {
  const background =
    resolved === "dark" ? mix(tokens.background, DARK_CANVAS, 0.88) : tokens.background;

  return {
    [THEME_CSS_VARS.marca]: tokens.marca,
    [THEME_CSS_VARS.primary]: tokens.primary,
    [THEME_CSS_VARS.accent]: tokens.accent,
    [THEME_CSS_VARS.background]: background,
    [THEME_CSS_VARS.logo_url]: tokens.logo_url ? `url(${tokens.logo_url})` : "none",
    "--color-marca": tokens.primary,
    "--color-text-on-primary": ON_PRIMARY,
    "--color-text-on-accent": ON_ACCENT,
    "--brand-accent": tokens.accent,
    "--brand-accent-foreground": ON_ACCENT,
  } as CSSProperties;
}
