/** Canal flags only — Account / subscription entitlement is out of MVP. */
export const CANAIS_AVISO = ["email", "whatsapp", "ambos"] as const;
export type CanalAviso = (typeof CANAIS_AVISO)[number];
