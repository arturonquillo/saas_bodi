import type { OrcamentoStatus, PedidoStatus, SaasRole, VendaStatus } from "@saas-frota/shared";
import {
  LEGAL_ORCAMENTO_TRANSITIONS,
  LEGAL_PEDIDO_TRANSITIONS,
  LEGAL_VENDA_TRANSITIONS,
} from "@saas-frota/shared";
import { ApiError } from "../http/respond";

const ORCAMENTO_ROLE: Record<SaasRole, ReadonlyArray<readonly [OrcamentoStatus, OrcamentoStatus]>> = {
  admin: [
    ["rascunho", "enviado"],
    ["rascunho", "cancelado"],
    ["enviado", "aceito"],
    ["enviado", "recusado"],
    ["enviado", "cancelado"],
    ["enviado", "expirado"],
  ],
  vendedor: [
    ["rascunho", "enviado"],
    ["rascunho", "cancelado"],
    ["enviado", "aceito"],
    ["enviado", "recusado"],
    ["enviado", "cancelado"],
    ["enviado", "expirado"],
  ],
};

const PEDIDO_ROLE: Record<SaasRole, ReadonlyArray<readonly [PedidoStatus, PedidoStatus]>> = {
  admin: [
    ["confirmado", "em_separacao"],
    ["confirmado", "cancelado"],
    ["em_separacao", "despachado"],
    ["em_separacao", "cancelado"],
    ["despachado", "entregue"],
  ],
  vendedor: [
    ["confirmado", "em_separacao"],
    ["confirmado", "cancelado"],
    ["em_separacao", "despachado"],
    ["em_separacao", "cancelado"],
    ["despachado", "entregue"],
  ],
};

const VENDA_ROLE: Record<SaasRole, ReadonlyArray<readonly [VendaStatus, VendaStatus]>> = {
  admin: [
    ["rascunho", "faturado"],
    ["rascunho", "cancelado"],
  ],
  vendedor: [
    ["rascunho", "faturado"],
    ["rascunho", "cancelado"],
  ],
};

export function assertOrcamentoTransition(
  from: OrcamentoStatus,
  to: OrcamentoStatus,
  role: SaasRole | "cliente",
) {
  if (!LEGAL_ORCAMENTO_TRANSITIONS[from].includes(to)) {
    throw new ApiError("transicao_ilegal", "Transição de orçamento não permitida.");
  }
  if (role === "cliente") {
    if (!(from === "enviado" && (to === "aceito" || to === "recusado"))) {
      throw new ApiError("forbidden", "Cliente só pode aceitar ou recusar orçamento enviado.");
    }
    return;
  }
  const allowed = ORCAMENTO_ROLE[role].some(([f, t]) => f === from && t === to);
  if (!allowed) throw new ApiError("forbidden", "Papel sem permissão para esta transição.");
}

export function assertPedidoTransition(from: PedidoStatus, to: PedidoStatus, role: SaasRole) {
  if (!LEGAL_PEDIDO_TRANSITIONS[from].includes(to)) {
    throw new ApiError("transicao_ilegal", "Transição de pedido não permitida.");
  }
  const allowed = PEDIDO_ROLE[role].some(([f, t]) => f === from && t === to);
  if (!allowed) throw new ApiError("forbidden", "Papel sem permissão para esta transição.");
}

export function assertVendaTransition(from: VendaStatus, to: VendaStatus, role: SaasRole) {
  if (!LEGAL_VENDA_TRANSITIONS[from].includes(to)) {
    throw new ApiError("transicao_ilegal", "Transição de venda não permitida.");
  }
  const allowed = VENDA_ROLE[role].some(([f, t]) => f === from && t === to);
  if (!allowed) throw new ApiError("forbidden", "Papel sem permissão para esta transição.");
}
