import { COPY } from "../copy";
import type {
  ConversationPriority,
  ConversationStatus,
  WaConnectionStatus,
} from "./types";

export function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "open":
      return COPY.crm.status_open;
    case "pending":
      return COPY.crm.status_pending;
    case "snoozed":
      return COPY.crm.status_snoozed;
    case "resolved":
      return COPY.crm.status_resolved;
    default:
      return status ?? "—";
  }
}

export function priorityLabel(priority: string | null | undefined) {
  switch (priority) {
    case "low":
      return COPY.crm.priority_low;
    case "medium":
      return COPY.crm.priority_medium;
    case "high":
      return COPY.crm.priority_high;
    case "urgent":
      return COPY.crm.priority_urgent;
    default:
      return "—";
  }
}

export function statusBadgeClass(status: string | null | undefined) {
  switch (status as ConversationStatus) {
    case "open":
      return "border-primary/40 text-primary";
    case "pending":
      return "border-[var(--color-warning)]/50 text-[var(--color-warning)]";
    case "snoozed":
      return "border-border text-muted-foreground";
    case "resolved":
      return "border-emerald-500/40 text-emerald-700";
    default:
      return "";
  }
}

export function priorityClass(priority: string | null | undefined) {
  switch (priority as ConversationPriority) {
    case "urgent":
      return "text-destructive";
    case "high":
      return "text-[var(--color-warning)]";
    default:
      return "text-muted-foreground";
  }
}

export function connectionLabel(status: string | null | undefined) {
  switch (status as WaConnectionStatus) {
    case "not_configured":
      return COPY.crm.canal_not_configured;
    case "credentials_saved":
      return COPY.crm.canal_credentials_saved;
    case "ready_stub":
      return COPY.crm.canal_ready_stub;
    default:
      return status ?? COPY.crm.canal_not_configured;
  }
}

export function connectionBadgeClass(status: string | null | undefined) {
  switch (status as WaConnectionStatus) {
    case "credentials_saved":
      return "border-[var(--color-warning)]/50 text-[var(--color-warning)]";
    case "ready_stub":
      return "border-emerald-500/40 text-emerald-700";
    default:
      return "border-border text-muted-foreground";
  }
}

export function displayLabelTitle(title: string) {
  const map: Record<string, string> = {
    "intent:cadastro": COPY.intent_cadastro,
    "intent:orcamento": COPY.intent_orcamento,
    "intent:info_empresa": COPY.intent_info_empresa,
    "intent:outro": COPY.intent_outro,
  };
  return map[title] ?? title.replace(/^intent:/, "");
}

export function substituteCanned(content: string, vars: Record<string, string>) {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export const STATUSES: ConversationStatus[] = ["open", "pending", "snoozed", "resolved"];
export const PRIORITIES: ConversationPriority[] = ["low", "medium", "high", "urgent"];
