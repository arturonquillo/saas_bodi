export const MOVEMENT_TYPES = ["reserve", "release", "consume", "adjust"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const SKU_UNIDADES = ["un", "kg", "cx", "pct", "lt"] as const;
export type SkuUnidade = (typeof SKU_UNIDADES)[number];

/** Half-up discount to integer centavos, then net floored at 0. */
export function netUnitFromDesconto(precoListaCentavos: number, descontoPct: number): number {
  const gross = Math.trunc(precoListaCentavos);
  const pct = Math.trunc(descontoPct);
  if (gross < 0 || pct < 0) return 0;
  const discountCentavos = Math.floor((gross * pct + 50) / 100);
  return Math.max(0, gross - discountCentavos);
}

/** UI alias for netUnitFromDesconto. */
export function netUnitCentavos(precoListaCentavos: number, descontoPct: number) {
  return netUnitFromDesconto(precoListaCentavos, descontoPct);
}
