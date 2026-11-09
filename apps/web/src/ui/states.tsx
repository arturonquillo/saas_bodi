"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { COPY } from "./copy";
import { DeskWrap } from "./layout";
import { productInitials } from "./PlaceholderMedia";
import { useTenantTheme } from "./theme/TenantTheme";

export type EmptyArt = "catalog" | "cart" | "pedidos" | "warehouse" | "outbox" | "inbox";

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
    <Alert>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message ?? COPY.load_fail}</span>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            {COPY.retry}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <Alert>
      <AlertDescription>{message ?? COPY.forbidden}</AlertDescription>
    </Alert>
  );
}

export function GateBanner({ message }: { message?: string }) {
  return (
    <Alert role="status" className="border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10">
      <AlertDescription>{message ?? COPY.cadastro_pendente_gate}</AlertDescription>
    </Alert>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <Card key={i} className="gap-0 rounded-lg py-0 ring-border">
          <Skeleton className="aspect-square w-full rounded-none" />
          <CardContent className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
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
          <Skeleton key={i} className="h-10 w-full rounded-none border-b border-border" />
        ))}
      </div>
    </DeskWrap>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function CardSkeleton() {
  return <Skeleton className="h-48 w-full max-w-[420px] rounded-lg" />;
}

export function InboxSkeleton() {
  return (
    <div className="grid gap-0 md:grid-cols-[360px_1fr]" aria-busy="true">
      <div className="space-y-0 border-r border-border">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-none border-b border-border" />
        ))}
      </div>
      <Skeleton className="min-h-[320px] w-full rounded-none" />
    </div>
  );
}
