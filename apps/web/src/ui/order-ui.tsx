"use client";

import type {
  CadastroStatus,
  CanalAviso,
  OrcamentoStatus,
  PedidoStatus,
  VendaStatus,
  WhatsappIntent,
} from "@saas-frota/shared";
import {
  LEGAL_ORCAMENTO_TRANSITIONS,
  LEGAL_PEDIDO_TRANSITIONS,
  LEGAL_VENDA_TRANSITIONS,
} from "@saas-frota/shared";
import { cn } from "@/lib/utils";
import { COPY } from "./copy";
import { formatMoney } from "./format";

export function legalOrcamentoTargets(status: OrcamentoStatus): OrcamentoStatus[] {
  return [...(LEGAL_ORCAMENTO_TRANSITIONS[status] ?? [])];
}

export function legalPedidoTargets(status: PedidoStatus): PedidoStatus[] {
  return [...(LEGAL_PEDIDO_TRANSITIONS[status] ?? [])];
}

export function legalVendaTargets(status: VendaStatus): VendaStatus[] {
  return [...(LEGAL_VENDA_TRANSITIONS[status] ?? [])];
}

export function orcamentoTransitionLabel(to: OrcamentoStatus) {
  if (to === "enviado") return COPY.orcamento_enviar;
  if (to === "aceito") return COPY.orcamento_aceitar;
  if (to === "recusado") return COPY.orcamento_recusar;
  if (to === "cancelado") return COPY.orcamento_cancelar;
  return COPY.orcamento[to];
}

export function pedidoTransitionLabel(to: PedidoStatus) {
  if (to === "em_separacao") return COPY.to_em_separacao;
  if (to === "despachado") return COPY.to_despachado;
  if (to === "entregue") return COPY.to_entregue;
  if (to === "cancelado") return COPY.cancel_pedido;
  return COPY.pedido[to];
}

export function vendaTransitionLabel(to: VendaStatus) {
  if (to === "faturado") return COPY.confirmar_faturamento;
  if (to === "cancelado") return COPY.cancel_venda;
  return COPY.venda[to];
}

export function notifyCopy(canais: CanalAviso | undefined) {
  const channel = canais ?? "whatsapp";
  return {
    customer: COPY.notify[channel],
    seller: COPY.notify.seller_same,
  };
}

function toneClass(tone: "muted" | "primary" | "warning" | "success" | "danger" | "accent") {
  if (tone === "warning") return "bg-[var(--color-warning)]/15 text-[var(--color-warning)]";
  if (tone === "success") return "bg-[var(--color-success)]/15 text-[var(--color-success)]";
  if (tone === "danger") return "bg-destructive/15 text-destructive";
  if (tone === "accent") return "bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]";
  if (tone === "primary") return "bg-primary text-primary-foreground";
  return "bg-secondary text-secondary-foreground";
}

function StatusPill({
  label,
  tone,
  large,
}: {
  label: string;
  tone: "muted" | "primary" | "warning" | "success" | "danger" | "accent";
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        large && "px-3 py-1 text-sm",
        toneClass(tone),
      )}
    >
      {label}
    </span>
  );
}

export function OrcamentoStatusBadge({ status, large }: { status: OrcamentoStatus | string; large?: boolean }) {
  const tone =
    status === "rascunho"
      ? "muted"
      : status === "enviado"
        ? "primary"
        : status === "aceito"
          ? "success"
          : status === "expirado"
            ? "warning"
            : status === "recusado" || status === "cancelado"
              ? "danger"
              : "muted";
  const label = COPY.orcamento[status as OrcamentoStatus] ?? status;
  return <StatusPill label={label} tone={tone} large={large} />;
}

export function PedidoStatusBadge({ status, large }: { status: PedidoStatus | string; large?: boolean }) {
  const tone =
    status === "confirmado"
      ? "primary"
      : status === "em_separacao"
        ? "warning"
        : status === "despachado"
          ? "accent"
          : status === "entregue"
            ? "success"
            : status === "cancelado"
              ? "danger"
              : "muted";
  const label = COPY.pedido[status as PedidoStatus] ?? status;
  return <StatusPill label={label} tone={tone} large={large} />;
}

/** @deprecated Prefer PedidoStatusBadge — alias for gradual migration */
export function StatusBadge({ status, large }: { status: PedidoStatus | string; large?: boolean }) {
  return <PedidoStatusBadge status={status} large={large} />;
}

export function VendaStatusBadge({ status, large }: { status: VendaStatus | string; large?: boolean }) {
  const tone =
    status === "rascunho" ? "muted" : status === "faturado" ? "success" : status === "cancelado" ? "danger" : "muted";
  const label = COPY.venda[status as VendaStatus] ?? status;
  return <StatusPill label={label} tone={tone} large={large} />;
}

export function CadastroStatusBadge({ status }: { status: CadastroStatus | string }) {
  const tone =
    status === "pendente" ? "warning" : status === "aprovado" ? "success" : status === "recusado" ? "danger" : "muted";
  const label =
    status === "pendente"
      ? COPY.status_pendente
      : status === "aprovado"
        ? COPY.status_aprovado
        : status === "recusado"
          ? COPY.status_recusado
          : status;
  return <StatusPill label={label} tone={tone} />;
}

export function IntentBadge({ intent }: { intent: WhatsappIntent | null | undefined }) {
  if (!intent) return <StatusPill label="—" tone="muted" />;
  const label =
    intent === "cadastro"
      ? COPY.intent_cadastro
      : intent === "orcamento"
        ? COPY.intent_orcamento
        : intent === "info_empresa"
          ? COPY.intent_info_empresa
          : COPY.intent_outro;
  return <StatusPill label={label} tone="accent" />;
}

export function OutboxBadge({ status }: { status: string }) {
  if (status === "enviado") return <StatusPill label={COPY.outbox.enviado} tone="success" />;
  if (status === "falha") return <StatusPill label={COPY.outbox.falha} tone="danger" />;
  return <StatusPill label={COPY.outbox.pendente} tone="muted" />;
}

const PEDIDO_TRAIL: PedidoStatus[] = ["confirmado", "em_separacao", "despachado", "entregue"];

export function PedidoStatusTrail({ status }: { status: PedidoStatus }) {
  const current = PEDIDO_TRAIL.indexOf(status);
  const cancelled = status === "cancelado";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {PEDIDO_TRAIL.map((step, i) => {
        const active = !cancelled && i <= current;
        const isCurrent = !cancelled && step === status;
        return (
          <span key={step} className="inline-flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">→</span> : null}
            <span className={cn(active && "text-foreground", isCurrent && "font-semibold text-primary")}>
              {COPY.pedido[step]}
            </span>
          </span>
        );
      })}
      {cancelled ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-destructive">{COPY.pedido.cancelado}</span>
        </>
      ) : null}
    </div>
  );
}

export function NotifyAlert({ canais }: { canais?: CanalAviso }) {
  const copy = notifyCopy(canais);
  return (
    <p role="status" className="rounded-md border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/8 px-3 py-2 text-sm">
      {copy.customer} {copy.seller}
    </p>
  );
}

export function MoneyCell({ centavos }: { centavos: number }) {
  return <span className="tabular-nums">{formatMoney(centavos)}</span>;
}
