/** Orçamento → Pedido de venda → Venda/Faturamento machines. */

export const ORCAMENTO_STATUSES = [
  "rascunho",
  "enviado",
  "aceito",
  "recusado",
  "expirado",
  "cancelado",
] as const;
export type OrcamentoStatus = (typeof ORCAMENTO_STATUSES)[number];

export const PEDIDO_STATUSES = [
  "confirmado",
  "em_separacao",
  "despachado",
  "entregue",
  "cancelado",
] as const;
export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

/** @deprecated Use PedidoStatus — kept alias for gradual migration */
export type OrderStatus = PedidoStatus;

export const VENDA_STATUSES = ["rascunho", "faturado", "cancelado"] as const;
export type VendaStatus = (typeof VENDA_STATUSES)[number];

export const CADASTRO_STATUSES = ["pendente", "aprovado", "recusado"] as const;
export type CadastroStatus = (typeof CADASTRO_STATUSES)[number];

export const WHATSAPP_INTENTS = ["cadastro", "orcamento", "info_empresa", "outro"] as const;
export type WhatsappIntent = (typeof WHATSAPP_INTENTS)[number];

export const LEGAL_ORCAMENTO: Readonly<Record<OrcamentoStatus, readonly OrcamentoStatus[]>> = {
  rascunho: ["enviado", "cancelado"],
  enviado: ["aceito", "recusado", "expirado", "cancelado"],
  aceito: [],
  recusado: [],
  expirado: [],
  cancelado: [],
};

export const LEGAL_PEDIDO: Readonly<Record<PedidoStatus, readonly PedidoStatus[]>> = {
  confirmado: ["em_separacao", "cancelado"],
  em_separacao: ["despachado", "cancelado"],
  despachado: ["entregue"],
  entregue: [],
  cancelado: [],
};

export const LEGAL_VENDA: Readonly<Record<VendaStatus, readonly VendaStatus[]>> = {
  rascunho: ["faturado", "cancelado"],
  faturado: [],
  cancelado: [],
};

export type StockEffect = "none" | "reserve" | "release" | "consume";

export function stockEffectForPedido(from: PedidoStatus, to: PedidoStatus): StockEffect | null {
  if (!LEGAL_PEDIDO[from].includes(to)) return null;
  if (to === "cancelado" && (from === "confirmado" || from === "em_separacao")) return "release";
  if (from === "em_separacao" && to === "despachado") return "consume";
  return "none";
}

/** Pedido create always reserves. */
export function stockEffectOnPedidoCreate(): StockEffect {
  return "reserve";
}
