import type { Prisma, SkuUnidade } from "@prisma/client";
import { availableQty, netUnitFromDesconto } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { ApiError } from "../http/respond";

type Tx = Prisma.TransactionClient;

export type ResolvedLine = {
  skuId: string;
  codigoSnapshot: string;
  nomeSnapshot: string;
  unidadeSnapshot: SkuUnidade;
  qty: number;
  precoListaCentavos: number;
  descontoPct: number;
  unitPriceCentavos: number;
};

export function assertDescontoPermitido(
  session: SessionContext | { saasRole: "admin" | "vendedor" | null },
  sku: { descontoMaxPct: number; codigo: string },
  descontoPct: number,
) {
  const pct = Math.trunc(descontoPct);
  if (pct < 0 || pct > 100) {
    throw new ApiError("validacao", "desconto_pct deve ser entre 0 e 100.");
  }
  if (session.saasRole === "admin") return;
  if (pct > sku.descontoMaxPct) {
    throw new ApiError("forbidden", `Desconto acima do máximo para ${sku.codigo}.`, {
      desconto_pct: pct,
      desconto_max_pct: sku.descontoMaxPct,
    });
  }
}

export async function resolveAtacadoLines(
  tx: Tx,
  tenantId: string,
  linhas: Array<{ sku_id: string; qty: number; desconto_pct?: number }>,
  opts: {
    requireVisibleLoja?: boolean;
    checkAvailable?: boolean;
    /** Loja path: force list price, ignore discount. */
    forceListPrice?: boolean;
    /** Reject inactive SKUs on new lines (default true). */
    requireAtivo?: boolean;
    session?: SessionContext | { saasRole: "admin" | "vendedor" | null };
  } = {},
): Promise<ResolvedLine[]> {
  if (!linhas.length) throw new ApiError("validacao", "Informe ao menos uma linha.");
  const requireAtivo = opts.requireAtivo !== false;
  const resolved: ResolvedLine[] = [];
  for (const line of linhas) {
    const qty = Math.trunc(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError("validacao", "Quantidade inválida.");
    const sku = await tx.sku.findFirst({
      where: { id: line.sku_id, tenantId },
      include: { balance: true },
    });
    if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
    if (opts.requireVisibleLoja && (!sku.visivelLoja || !sku.ativo)) {
      throw new ApiError("nao_encontrado", "Não encontrado.");
    }
    if (requireAtivo && !sku.ativo) {
      throw new ApiError("validacao", `SKU ${sku.codigo} está inativo.`, { code: "sku_inativo" });
    }
    if (qty < sku.qtdMinAtacado) {
      throw new ApiError(
        "moq_atacado",
        `Quantidade mínima atacado para ${sku.codigo} é ${sku.qtdMinAtacado}.`,
      );
    }
    if (opts.checkAvailable !== false) {
      const available = availableQty(sku.balance?.onHand ?? 0, sku.balance?.reserved ?? 0);
      if (qty > available) {
        throw new ApiError("estoque_insuficiente", `Estoque insuficiente para ${sku.codigo}.`);
      }
    }

    const descontoPct = opts.forceListPrice ? 0 : Math.trunc(line.desconto_pct ?? 0);
    if (!opts.forceListPrice) {
      const session = opts.session ?? { saasRole: "vendedor" as const };
      assertDescontoPermitido(session, sku, descontoPct);
    }
    const precoListaCentavos = sku.precoAtacadoCentavos;
    const unitPriceCentavos = netUnitFromDesconto(precoListaCentavos, descontoPct);

    resolved.push({
      skuId: sku.id,
      codigoSnapshot: sku.codigo,
      nomeSnapshot: sku.nome,
      unidadeSnapshot: sku.unidade,
      qty,
      precoListaCentavos,
      descontoPct,
      unitPriceCentavos,
    });
  }
  return resolved;
}

export function lineCreateData(tenantId: string, line: ResolvedLine, id: string, notas?: string | null) {
  return {
    id,
    tenantId,
    skuId: line.skuId,
    codigoSnapshot: line.codigoSnapshot,
    nomeSnapshot: line.nomeSnapshot,
    unidadeSnapshot: line.unidadeSnapshot,
    qty: line.qty,
    precoListaCentavos: line.precoListaCentavos,
    descontoPct: line.descontoPct,
    unitPriceCentavos: line.unitPriceCentavos,
    ...(notas !== undefined ? { notas: notas ?? null } : {}),
  };
}

export function mapFrozenOrcamentoLines(
  lines: Array<{
    skuId: string;
    codigoSnapshot: string;
    nomeSnapshot: string;
    unidadeSnapshot: SkuUnidade | null;
    qty: number;
    precoListaCentavos: number;
    descontoPct: number;
    unitPriceCentavos: number;
  }>,
): ResolvedLine[] {
  return lines.map((l) => ({
    skuId: l.skuId,
    codigoSnapshot: l.codigoSnapshot,
    nomeSnapshot: l.nomeSnapshot,
    unidadeSnapshot: l.unidadeSnapshot ?? "un",
    qty: l.qty,
    precoListaCentavos: l.precoListaCentavos,
    descontoPct: l.descontoPct,
    unitPriceCentavos: l.unitPriceCentavos,
  }));
}
