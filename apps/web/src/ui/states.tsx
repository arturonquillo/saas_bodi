"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { COPY } from "./copy";
import { DeskWrap } from "./layout";
import { productInitials } from "./PlaceholderMedia";
import { useTenantTheme } from "./theme/TenantTheme";

export type EmptyArt = "catalog" | "cart" | "pedidos" | "warehouse" | "outbox" | "inbox";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EmptyState({
  title,
  action,
  art,
}: {
  title: string;
  action?: React.ReactNode;
  art?: EmptyArt;
}) {
  const { tokens } = useTenantTheme();
  const kind = art ?? "pedidos";
  const initials = kind === "catalog" && tokens?.marca ? productInitials(tokens.marca) : "";
  const desk = kind === "warehouse" || kind === "outbox" || kind === "pedidos" || kind === "inbox";

  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center gap-3 py-8 text-center">
      <span
        aria-hidden="true"
        className={
          desk
            ? "grid size-14 place-items-center rounded-md border border-border bg-card text-xl font-semibold text-muted-foreground"
            : "relative grid size-[72px] place-items-center overflow-hidden rounded-lg bg-[linear-gradient(152deg,var(--primary)_0%,color-mix(in_srgb,var(--brand-accent)_52%,var(--primary))_100%)] text-[22px] font-semibold text-primary-foreground"
        }
      >
        {initials || (kind === "cart" ? "○" : kind === "warehouse" ? "▢" : kind === "outbox" || kind === "inbox" ? "…" : "—")}
      </span>
      <p className="m-0 text-base font-semibold">{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
      <p className="text-sm text-red-500">{message ?? COPY.load_fail}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {COPY.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return <p className="text-sm text-red-500">{message ?? COPY.forbidden}</p>;
}

export function GateBanner({ message }: { message?: string }) {
  return (
    <p
      role="status"
      className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm"
    >
      {message ?? COPY.cadastro_pendente_gate}
    </p>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <Card key={i} className="gap-0 rounded-lg py-0 ring-border">
          <Pulse className="aspect-square w-full rounded-none" />
          <CardContent className="space-y-2 p-3">
            <Pulse className="h-4 w-3/4" />
            <Pulse className="h-4 w-1/2" />
            <Pulse className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <DeskWrap aria-busy="true">
      <div className="space-y-0 p-0">
        {Array.from({ length: rows }, (_, i) => (
          <Pulse key={i} className="h-10 w-full rounded-none border-b border-border" />
        ))}
      </div>
    </DeskWrap>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-8 w-48" />
      <Pulse className="h-24 w-full" />
      <Pulse className="h-24 w-full" />
      <Pulse className="h-24 w-full" />
    </div>
  );
}

export function CardSkeleton() {
  return <Pulse className="h-48 w-full max-w-[420px] rounded-lg" />;
}

export function InboxSkeleton() {
  return (
    <div className="grid gap-0 md:grid-cols-[360px_1fr]" aria-busy="true">
      <div className="space-y-0 border-r border-border">
        {Array.from({ length: 6 }, (_, i) => (
          <Pulse key={i} className="h-16 w-full rounded-none border-b border-border" />
        ))}
      </div>
      <Pulse className="min-h-[320px] w-full rounded-none" />
    </div>
  );
}
