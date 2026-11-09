"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { COPY } from "./copy";
import { useTenantTheme } from "./theme/TenantTheme";

type BrandMarkProps = {
  href: string;
  fallback?: string;
  layout?: "full" | "sidebar" | "hero";
  iconOnly?: boolean;
} & Omit<ComponentProps<typeof Link>, "href">;

export function BrandMark({
  href,
  fallback,
  className,
  layout = "full",
  iconOnly = false,
  ...props
}: BrandMarkProps) {
  const { tokens } = useTenantTheme();
  const [broken, setBroken] = useState(false);
  const marca = tokens?.marca ?? fallback ?? COPY.marca;
  const logo = tokens?.logo_url;
  const showLogo = Boolean(logo && !broken);
  const initial = marca.slice(0, 1).toUpperCase();

  if (layout === "hero") {
    return (
      <Link href={href} className={cn("inline-block no-underline", className)} {...props}>
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo!}
            alt={marca}
            className="h-14 w-auto max-w-[280px] object-contain md:h-16"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {marca}
          </span>
        )}
        {logo && broken ? <span className="mt-1 block text-sm text-muted-foreground">{COPY.logo_unavailable}</span> : null}
      </Link>
    );
  }

  if (layout === "sidebar") {
    return (
      <Link
        href={href}
        aria-label={marca}
        className={cn(
          "flex min-w-0 items-center gap-2.5 overflow-hidden",
          iconOnly && "size-8 justify-center gap-0",
          className,
        )}
        {...props}
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo!} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
          ) : (
            initial
          )}
        </span>
        {iconOnly ? null : (
          <div className="flex min-w-0 flex-1 flex-col items-start leading-none">
            <span className="font-display w-full truncate text-base font-semibold">{marca}</span>
          </div>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-display font-semibold text-inherit no-underline", className)}
      {...props}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo!} alt={marca} className="h-8 w-auto max-w-[160px] object-contain" onError={() => setBroken(true)} />
      ) : (
        <strong className="text-lg font-semibold tracking-tight">{marca}</strong>
      )}
      {logo && broken ? <span className="text-xs text-muted-foreground">{COPY.logo_unavailable}</span> : null}
    </Link>
  );
}
