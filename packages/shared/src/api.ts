import type { ApiErrorCode } from "./errors";
import type {
  CadastroStatus,
  OrcamentoStatus,
  PedidoStatus,
  VendaStatus,
  WhatsappIntent,
} from "./order-status";
import type { CanalAviso, LojaModo } from "./subscription";
import type { SaasRole, Surface } from "./roles";
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
  cliente_status?: CadastroStatus | null;
  cnpj_last4?: string;
  nome?: string;
  email?: string;
};

export type CatalogItemDto = {
  id: string;
  sku: string;
  nome: string;
  preco_atacado_centavos: number;
  qtd_min_atacado: number;
  available: number;
  sem_estoque: boolean;
};

export type ThemeDto = ThemeTokens;

export type Page<T> = { items: T[]; next_cursor: string | null };

export type LojaConfigDto = {
  loja_modo: LojaModo;
  whatsapp_comercial: string | null;
  whatsapp_wa_link: string | null;
  marca: string;
};

export type DocLineDto = {
  id: string;
  sku_id: string;
  codigo_snapshot: string;
  nome_snapshot: string;
  qty: number;
  unit_price_centavos: number;
};

export type StatusHistoryDto = {
  from_status: string | null;
  to_status: string;
  actor_user_id?: string | null;
  created_at: string;
};

export type CustomerStripDto = {
  id: string;
  razao_social: string;
  cnpj_masked: string;
  whatsapp?: string | null;
  status?: CadastroStatus;
};

export type OrcamentoDto = {
  id: string;
  numero?: string;
  status: OrcamentoStatus;
  valido_ate: string | null;
  cliente?: CustomerStripDto | null;
  prospect_phone?: string | null;
  linhas: DocLineDto[];
  history: StatusHistoryDto[];
  total_centavos: number;
  pedido_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type PedidoDto = {
  id: string;
  numero?: string;
  status: PedidoStatus;
  channel: "loja" | "saas" | "orcamento";
  cliente: CustomerStripDto;
  linhas: DocLineDto[];
  history: StatusHistoryDto[];
  total_centavos: number;
  orcamento_id?: string | null;
  venda_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type VendaDto = {
  id: string;
  status: VendaStatus;
  pedido_id: string;
  cliente?: CustomerStripDto;
  created_at: string;
  updated_at: string;
  history: StatusHistoryDto[];
};

export type CadastroDto = {
  id: string;
  status: CadastroStatus;
  cnpj_masked: string;
  cnpj_registro_pendente: boolean;
  razao_social: string;
  contato_nome: string;
  email: string;
  whatsapp: string;
  source: "loja" | "whatsapp" | "saas";
  motivo_recusa?: string | null;
  cliente_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type InboxThreadDto = {
  id: string;
  phone_e164: string;
  intent: WhatsappIntent | null;
  preview: string;
  unread: boolean;
  updated_at: string;
  cadastro_request_id?: string | null;
  orcamento_id?: string | null;
  cliente_id?: string | null;
};

export type InboxMessageDto = {
  id: string;
  direction: "inbound" | "outbound_note";
  body: string;
  simulated: boolean;
  created_at: string;
};

export type InboxThreadDetailDto = InboxThreadDto & {
  messages: InboxMessageDto[];
};

export type EstoqueItemDto = {
  id: string;
  sku: string;
  nome: string;
  on_hand: number;
  reserved: number;
  available: number;
  visivel_loja: boolean;
  preco_atacado_centavos: number;
  qtd_min_atacado: number;
};

export type UserDto = {
  id: string;
  email: string;
  nome: string;
  saas_role: SaasRole;
  ativo: boolean;
};

export type SaasConfigDto = {
  razao_social: string;
  nome_fantasia: string;
  cnpj_masked: string;
  whatsapp_comercial: string | null;
  canais_aviso: CanalAviso;
  loja_modo: LojaModo;
  default_vendedor_user_id: string | null;
};

export type OutboxDto = {
  id: string;
  created_at: string;
  channel: "email" | "whatsapp";
  recipient_role: "customer" | "vendedor";
  recipient: string;
  template_key: string;
  status: "pendente" | "enviado" | "falha";
  orcamento_id?: string | null;
  pedido_id?: string | null;
  venda_id?: string | null;
  cadastro_request_id?: string | null;
};

export type { ThemeTokens };
