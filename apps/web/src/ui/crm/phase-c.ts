/** Phase C vocabulary — mirrors docs/architecture/crm-chatwoot-parity.md */

export const CAMPAIGN_KINDS = ["one_off", "ongoing"] as const;
export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;
export const CAMPAIGN_CHANNELS = ["whatsapp", "sms"] as const;
export const ARTICLE_STATUSES = ["draft", "published", "archived"] as const;

export const REPORT_SERIES = [
  { key: "visao-geral", path: "visao-geral", labelKey: "relatorio_visao_geral" as const },
  { key: "conversas", path: "conversas", labelKey: "relatorio_conversas" as const },
  { key: "agentes", path: "agentes", labelKey: "relatorio_agentes" as const },
  { key: "labels", path: "labels", labelKey: "relatorio_labels" as const },
  { key: "inboxes", path: "inboxes", labelKey: "relatorio_inboxes" as const },
  { key: "equipes", path: "equipes", labelKey: "relatorio_equipes" as const },
  { key: "csat", path: "csat", labelKey: "relatorio_csat" as const },
  { key: "bots", path: "bots", labelKey: "relatorio_bots" as const },
] as const;

export type ReportSeriesKey = (typeof REPORT_SERIES)[number]["key"];

export function campaignKindLabel(kind: string) {
  if (kind === "one_off") return "Única";
  if (kind === "ongoing") return "Contínua";
  return kind;
}

export function campaignStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "scheduled":
      return "Agendada";
    case "active":
      return "Ativa";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

export function campaignChannelLabel(channel: string) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "sms") return "SMS";
  return channel;
}

export function recipientStatusLabel(status: string) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "enviado":
      return "Enviado";
    case "falha":
      return "Falha";
    case "omitido":
      return "Omitido";
    default:
      return status;
  }
}

export function articleStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "published":
      return "Publicado";
    case "archived":
      return "Arquivado";
    default:
      return status;
  }
}

export function campaignEditable(status: string) {
  return status === "draft" || status === "scheduled";
}

export function campaignDeletable(status: string) {
  return status === "draft" || status === "cancelled";
}

export function campaignSendable(status: string) {
  return status === "draft" || status === "scheduled";
}

export function campaignCancellable(status: string) {
  return status === "scheduled" || status === "active";
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Default report window: last 30 days in America/Sao_Paulo calendar sense (UTC ISO). */
export function defaultReportRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function reportQuery(params: {
  from: string;
  to: string;
  inbox_id?: string;
  team_id?: string;
  tz?: string;
}) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  q.set("tz", params.tz || "America/Sao_Paulo");
  if (params.inbox_id) q.set("inbox_id", params.inbox_id);
  if (params.team_id) q.set("team_id", params.team_id);
  return q.toString();
}
