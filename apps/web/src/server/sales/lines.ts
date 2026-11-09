import type { Prisma } from "@prisma/client";
import { availableQty } from "@saas-frota/shared";
import { ApiError } from "../http/respond";

type Tx = Prisma.TransactionClient;

export type ResolvedLine = {
  skuId: string;
  codigoSnapshot: string;
  nomeSnapshot: string;
  qty: number;
  unitPriceCentavos: number;
};

export async function resolveAtacadoLines(
  tx: Tx,
  tenantId: string,
  linhas: Array<{ sku_id: string; qty: number }>,
  opts: { requireVisibleLoja?: boolean; checkAvailable?: boolean } = {},
): Promise<ResolvedLine[]> {
  if (!linhas.length) throw new ApiError("validacao", "Informe ao menos uma linha.");
  const resolved: ResolvedLine[] = [];
  for (const line of linhas) {
    const qty = Math.trunc(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError("validacao", "Quantidade inválida.");
    const sku = await tx.sku.findFirst({
      where: { id: line.sku_id, tenantId },
      include: { balance: true },
    });
    if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
    if (opts.requireVisibleLoja && !sku.visivelLoja) {
      throw new ApiError("nao_encontrado", "Não encontrado.");
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
    resolved.push({
      skuId: sku.id,
      codigoSnapshot: sku.codigo,
      nomeSnapshot: sku.nome,
      qty,
      unitPriceCentavos: sku.precoAtacadoCentavos,
    });
  }
  return resolved;
}
