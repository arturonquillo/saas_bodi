"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SkipLink() {
  return (
    <Button variant="link" asChild className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-card">
      <a href="#conteudo">Ir para o conteúdo</a>
    </Button>
  );
}

export function StoreMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main id="conteudo" className={cn("mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-6", className)}>
      {children}
    </main>
  );
}

/**
 * saas-starter dashboard page shell:
 * <section className="flex-1 p-4 lg:p-8">
 *   <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">…
 */
export function SaasPage({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium text-gray-900 lg:text-2xl">{title}</h1>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** @deprecated Prefer SaasPage — kept for store/account until rewired */
export function SaasMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id="conteudo" className={cn("flex-1 p-4 lg:p-8", className)}>
      {children}
    </section>
  );
}

/** @deprecated Prefer SaasPage title prop */
export function ListHeader({
  title,
  subtitle,
  actions,
  filters,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-gray-900 lg:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {filters ? <div className="mt-3">{filters}</div> : null}
    </div>
  );
}

export function DeskWrap({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-200 bg-white", className)} {...props}>
      {children}
    </div>
  );
}

export function FormWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-6", className)}>{children}</div>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 py-4 first:pt-0">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

/** saas-starter (login)/login.tsx shell */
export function AuthStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      id="conteudo"
      className={cn(
        "flex min-h-[100dvh] flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function QtyStepper({
  id,
  value,
  min,
  max,
  onChange,
  surface,
}: {
  id?: string;
  value: number;
  min: number;
  max?: number;
  onChange: (next: number) => void;
  surface: "store" | "saas";
}) {
  const store = surface === "store";
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={store ? "size-11" : "size-8"}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Diminuir"
      >
        −
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        className={store ? "h-11 w-14 text-center" : "h-8 w-12 text-center"}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value) || min;
          const capped = max != null ? Math.min(max, Math.max(min, n)) : Math.max(min, n);
          onChange(capped);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={store ? "size-11" : "size-8"}
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        aria-label="Aumentar"
      >
        +
      </Button>
    </div>
  );
}

export function CrumbLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted-foreground hover:text-primary">
      {children}
    </Link>
  );
}

export const AUTH_CARD =
  "w-full max-w-[420px] rounded-lg p-8 shadow-[var(--shadow-card)] ring-1 ring-border";

export const ACCOUNT_CARD =
  "w-full max-w-[480px] rounded-lg p-8 shadow-[var(--shadow-card)]";
