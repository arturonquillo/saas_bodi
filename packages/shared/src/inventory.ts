export const MOVEMENT_TYPES = ["reserve", "release", "consume", "adjust"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const SKU_UNIDADES = ["un", "kg", "cx", "pct", "lt"] as const;
export type SkuUnidade = (typeof SKU_UNIDADES)[number];

/** Half-up discount to integer centavos (architecture lock). */
export function discountCentavos(precoListaCentavos: number, descontoPct: number) {
  const gross = Math.max(0, Math.trunc(precoListaCentavos));
  const pct = Math.min(100, Math.max(0, Math.trunc(descontoPct)));
  return Math.floor((gross * pct + 50) / 100);
}

export function netUnitCentavos(precoListaCentavos: number, descontoPct: number) {
  return Math.max(0, Math.trunc(precoListaCentavos) - discountCentavos(precoListaCentavos, descontoPct));
}
