/** Tenant-editable slots. Names match docs/design/tokens.md */
export type ThemeTokens = {
  marca: string;
  primary: string;
  accent: string;
  background: string;
  logo_url: string | null;
};

export const THEME_CSS_VARS = {
  marca: "--marca",
  primary: "--color-primary",
  accent: "--color-accent",
  background: "--color-background",
  logo_url: "--logo-url",
} as const;

/** Seed must match docs/design/tokens.md (wins over architecture seed example). */
export const SEED_THEME: ThemeTokens = {
  marca: "Casa dos Frios",
  primary: "#7A1F1F",
  accent: "#1F5C6B",
  background: "#EEF2F4",
  logo_url: null,
};
