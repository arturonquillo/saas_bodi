export const COLOR_MODE_KEY = "sf-color-mode";
export const COLOR_MODE_COOKIE = "sf-color-mode";

export type ColorMode = "light" | "dark" | "system";
export type ResolvedColorMode = "light" | "dark";

export const COLOR_MODES: ColorMode[] = ["light", "dark", "system"];

export function isColorMode(value: string | null | undefined): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}

function readCookieColorMode(): ColorMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COLOR_MODE_COOKIE}=([^;]+)`));
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isColorMode(value) ? value : null;
}

export function readStoredColorMode(): ColorMode {
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_KEY);
    if (isColorMode(stored)) return stored;
  } catch {
    /* private mode */
  }
  const fromCookie = readCookieColorMode();
  if (fromCookie) return fromCookie;
  return "system";
}

export function persistColorMode(mode: ColorMode) {
  try {
    window.localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    /* private mode */
  }
  try {
    document.cookie = `${COLOR_MODE_COOKIE}=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* cookie blocked */
  }
}

export function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveColorMode(mode: ColorMode): ResolvedColorMode {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function applyDocumentColorMode(resolved: ResolvedColorMode) {
  const dark = resolved === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function clearDocumentColorMode() {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
}

/** Runs before paint on /saas and /loja so the first frame matches the saved preference. */
export const COLOR_MODE_BOOT_SCRIPT = `(function(){
  try {
    var path = location.pathname;
    if (path.indexOf("/saas") !== 0 && path.indexOf("/loja") !== 0) {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "";
      return;
    }
    var stored = null;
    try { stored = localStorage.getItem("${COLOR_MODE_KEY}"); } catch (e) {}
    if (!stored) {
      var match = document.cookie.match(/(?:^|;\\s*)${COLOR_MODE_COOKIE}=([^;]+)/);
      stored = match ? decodeURIComponent(match[1]) : "system";
    }
    if (stored !== "light" && stored !== "dark" && stored !== "system") stored = "system";
    var dark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();`;
