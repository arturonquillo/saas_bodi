"use client";

import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const rowClass =
  "group flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function AffordanceIcon({ className }: { className?: string }) {
  return (
    <SquareArrowOutUpRight
      aria-hidden
      className={cn(
        "size-4 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:text-primary group-hover:opacity-100",
        className,
      )}
      strokeWidth={1.75}
    />
  );
}

/** Navigational list row (Link) with pointer + link-icon affordance. */
export function DetailNavLink({
  href,
  children,
  className,
  meta,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(rowClass, className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {meta ? <div className="flex shrink-0 flex-wrap items-center gap-3">{meta}</div> : null}
      <AffordanceIcon />
    </Link>
  );
}

/** Navigational list row (button) for router.push detail opens. */
export function DetailNavButton({
  onClick,
  children,
  className,
  meta,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  meta?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(rowClass, className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {meta ? <div className="flex shrink-0 flex-wrap items-center gap-3">{meta}</div> : null}
      <AffordanceIcon />
    </button>
  );
}
