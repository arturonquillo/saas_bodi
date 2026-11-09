/** Keep type for legacy Account later — MVP ops ignore entitlement. */
export const SUBSCRIPTION_STATUSES = ["ativa", "inadimplente", "cancelada"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const CANAIS_AVISO = ["email", "whatsapp", "ambos"] as const;
export type CanalAviso = (typeof CANAIS_AVISO)[number];

export const LOJA_MODOS = ["pedido_direto", "orcamento"] as const;
export type LojaModo = (typeof LOJA_MODOS)[number];

/** MVP: always allow writes (seed tenant is operational). */
export function writesAllowed(_status?: SubscriptionStatus | null): boolean {
  return true;
}
