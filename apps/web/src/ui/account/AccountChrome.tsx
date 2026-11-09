"use client";

/** Account out of MVP — minimal shell so routes compile. */
export function AccountChrome({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
