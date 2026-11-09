export const ORCAMENTO_STATUSES = [
  "rascunho",
  "enviado",
  "aceito",
  "recusado",
  "expirado",
  "cancelado",
] as const;
export type OrcamentoStatus = (typeof ORCAMENTO_STATUSES)[number];

export const ORCAMENTO_CHANNELS = ["saas", "whatsapp", "loja"] as const;
export type OrcamentoChannel = (typeof ORCAMENTO_CHANNELS)[number];

export const PEDIDO_STATUSES = [
  "confirmado",
  "em_separacao",
  "despachado",
  "entregue",
  "cancelado",
] as const;
export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

export const PEDIDO_CHANNELS = ["loja", "saas", "orcamento"] as const;
export type PedidoChannel = (typeof PEDIDO_CHANNELS)[number];

export const VENDA_STATUSES = ["rascunho", "faturado", "cancelado"] as const;
export type VendaStatus = (typeof VENDA_STATUSES)[number];

export const CADASTRO_STATUSES = ["pendente", "aprovado", "recusado"] as const;
export type CadastroStatus = (typeof CADASTRO_STATUSES)[number];

export const CADASTRO_SOURCES = ["loja", "whatsapp", "saas"] as const;
export type CadastroSource = (typeof CADASTRO_SOURCES)[number];

export const WHATSAPP_INTENTS = ["cadastro", "orcamento", "info_empresa", "outro"] as const;
export type WhatsappIntent = (typeof WHATSAPP_INTENTS)[number];

export const LOJA_MODOS = ["pedido_direto", "orcamento"] as const;
export type LojaModo = (typeof LOJA_MODOS)[number];

/** Legal edges only. Role checks live in authz. */
export const LEGAL_ORCAMENTO_TRANSITIONS: Readonly<
  Record<OrcamentoStatus, readonly OrcamentoStatus[]>
> = {
  rascunho: ["enviado", "cancelado"],
  enviado: ["aceito", "recusado", "expirado", "cancelado"],
  aceito: [],
  recusado: [],
  expirado: [],
  cancelado: [],
};

export const LEGAL_PEDIDO_TRANSITIONS: Readonly<Record<PedidoStatus, readonly PedidoStatus[]>> = {
  confirmado: ["em_separacao", "cancelado"],
  em_separacao: ["despachado", "cancelado"],
  despachado: ["entregue"],
  entregue: [],
  cancelado: [],
};

export const LEGAL_VENDA_TRANSITIONS: Readonly<Record<VendaStatus, readonly VendaStatus[]>> = {
  rascunho: ["faturado", "cancelado"],
  faturado: [],
  cancelado: [],
};

export type StockEffect = "none" | "reserve" | "release" | "consume";

export function stockEffectForPedidoTransition(
  from: PedidoStatus,
  to: PedidoStatus,
): StockEffect | null {
  if (!LEGAL_PEDIDO_TRANSITIONS[from].includes(to)) return null;
  if (from === "confirmado" && to === "cancelado") return "release";
  if (from === "em_separacao" && to === "cancelado") return "release";
  if (from === "em_separacao" && to === "despachado") return "consume";
  return "none";
}
