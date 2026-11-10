import type { ApiErrorCode } from "./errors";
import type { SkuUnidade } from "./inventory";
import type { CanalAviso } from "./subscription";
import type { SaasRole, Surface } from "./roles";
import type { CadastroStatus, LojaModo, WhatsappIntent } from "./sales-status";
import type { ThemeTokens } from "./theme";

export type ApiOk<T> = { data: T };
export type ApiErr = { error: { code: ApiErrorCode; message: string; details?: unknown } };

export type SessionDto = {
  user_id: string;
  tenant_id: string;
  tenant_slug: string;
  surface: Surface;
  saas_role: SaasRole | null;
  is_customer: boolean;
  cliente_status?: "aprovado" | "pendente" | null;
  cnpj_last4?: string;
};

export type CatalogItemDto = {
  id: string;
  /** Prefer `codigo`; `sku` kept as alias during FE migrate. */
  sku: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: SkuUnidade;
  preco_atacado_centavos: number;
  qtd_min_atacado: number;
  available: number;
  sem_estoque: boolean;
};

export type ThemeDto = ThemeTokens;

export type LojaConfigDto = {
  loja_modo: LojaModo;
  whatsapp_comercial: string | null;
  nome_fantasia: string;
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export function availableQty(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

export type { CadastroStatus, WhatsappIntent, CanalAviso };
