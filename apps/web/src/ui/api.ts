import type {
  ApiErr,
  CadastroStatus,
  CanalAviso,
  CatalogItemDto,
  LojaModo,
  MovementType,
  OrcamentoStatus,
  PedidoStatus,
  SaasRole,
  SessionDto,
  ThemeTokens,
  VendaStatus,
  WhatsappIntent,
} from "@saas-frota/shared";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function isApiError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body instanceof FormData ? init.headers : { accept: "application/json", ...init?.headers },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    const err = (body as ApiErr | null)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? (res.status === 501 ? "nao_implementado" : "validacao"),
      err?.message ?? "Não foi possível concluir.",
      err?.details,
    );
  }
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export function apiGet<T>(path: string) {
  return api<T>(path);
}

export function apiSend<T>(path: string, method: string, json?: unknown) {
  return api<T>(path, {
    method,
    headers: { "content-type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

export type PageDto<T> = { items: T[]; next_cursor: string | null };

export function asPage<T>(data: unknown): PageDto<T> {
  if (Array.isArray(data)) return { items: data as T[], next_cursor: null };
  if (data && typeof data === "object" && "items" in data && Array.isArray((data as PageDto<T>).items)) {
    const page = data as PageDto<T>;
    return { items: page.items, next_cursor: page.next_cursor ?? null };
  }
  return { items: [], next_cursor: null };
}

/** Frontend DTOs matching apps/web/src/server response shapes. */

export type LojaConfigDto = {
  loja_modo: LojaModo;
  whatsapp_comercial: string | null;
  nome_fantasia: string;
  /** Phase D — public website_token for Loja chat widget (optional until seed). */
  widget_website_token?: string | null;
};

export function whatsappLink(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export function maskFromLast4(last4?: string | null) {
  if (!last4) return "—";
  const tail = last4.slice(-2).padStart(2, "*");
  return `**.***.***/****-${tail}`;
}

export type DocLineDto = {
  id: string;
  sku_id: string;
  codigo: string;
  nome: string;
  qty: number;
  /** Legacy alias for net unit (billing). Prefer preco_unitario_centavos. */
  unit_price_centavos: number;
  preco_lista_centavos?: number;
  desconto_pct?: number;
  preco_unitario_centavos?: number;
  unidade?: string | null;
  notas?: string | null;
};

export type StatusHistoryDto = {
  from: string | null;
  to: string;
  actor_user_id?: string | null;
  created_at: string;
};

export type CadastroDto = {
  id: string;
  status: CadastroStatus | string;
  cnpj_last4: string;
  cnpj_registro_pendente: boolean;
  razao_social: string;
  contato_nome: string;
  email: string;
  whatsapp: string;
  source: string;
  motivo_recusa?: string | null;
  cliente_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrcamentoDto = {
  id: string;
  status: OrcamentoStatus;
  valido_ate: string | null;
  channel?: string;
  cliente_id?: string | null;
  cadastro_request_id?: string | null;
  vendedor_user_id?: string;
  linhas: DocLineDto[];
  historico: StatusHistoryDto[];
  pedido_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type PedidoDto = {
  id: string;
  status: PedidoStatus;
  channel: string;
  cliente_id: string;
  vendedor_user_id?: string;
  orcamento_id?: string | null;
  linhas: DocLineDto[];
  historico: StatusHistoryDto[];
  created_at: string;
  updated_at: string;
};

export type VendaDto = {
  id: string;
  status: VendaStatus;
  pedido_id: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  historico: StatusHistoryDto[];
};

export type InboxThreadDto = {
  id: string;
  phone_e164: string;
  intent: WhatsappIntent | string | null;
  cliente_id?: string | null;
  cadastro_request_id?: string | null;
  orcamento_id?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  messages?: InboxMessageDto[];
};

export type InboxMessageDto = {
  id: string;
  direction: string;
  body: string;
  simulated: boolean;
  created_at: string;
};

export type InboxThreadDetailDto = InboxThreadDto & {
  messages: InboxMessageDto[];
};

export type SkuUnidadeDto = "un" | "kg" | "cx" | "pct" | "lt";

export type EstoqueItemDto = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: SkuUnidadeDto;
  on_hand: number;
  reserved: number;
  available: number;
  visivel_loja: boolean;
  ativo: boolean;
  preco_atacado_centavos: number;
  desconto_max_pct: number;
  qtd_min_atacado: number;
  created_at: string;
  updated_at: string;
};

export type UserDto = {
  id: string;
  email: string;
  nome: string;
  whatsapp?: string | null;
  saas_role: SaasRole | null;
  ativo: boolean;
  is_customer?: boolean;
  /** Phase E custom role overlay */
  custom_role_id?: string | null;
};

export type SaasConfigDto = {
  razao_social: string;
  nome_fantasia: string;
  cnpj_last4: string;
  whatsapp_comercial: string | null;
  canais_aviso: CanalAviso;
  loja_modo: LojaModo;
  default_vendedor_user_id: string | null;
};

export type OutboxDto = {
  id: string;
  created_at: string;
  channel: "email" | "whatsapp" | string;
  recipient_role: string;
  recipient: string;
  template_key: string;
  status: "pendente" | "enviado" | "falha" | string;
  orcamento_id?: string | null;
  pedido_id?: string | null;
  venda_id?: string | null;
  cadastro_request_id?: string | null;
};

export type MovementDto = {
  id: string;
  type: MovementType | string;
  /** Architecture contract: signed for adjust. */
  qty?: number;
  motivo?: string | null;
  actor_user_id?: string | null;
  pedido_id?: string | null;
  /** Legacy MVP movement shape. */
  delta_on_hand?: number;
  delta_reserved?: number;
  reason?: string | null;
  created_at?: string;
};

export function lineNetUnitCentavos(line: DocLineDto) {
  if (typeof line.preco_unitario_centavos === "number") return line.preco_unitario_centavos;
  return line.unit_price_centavos;
}

export function docTotal(linhas: DocLineDto[]) {
  return linhas.reduce((sum, l) => sum + l.qty * lineNetUnitCentavos(l), 0);
}

export function movementQty(m: MovementDto) {
  if (typeof m.qty === "number") return m.qty;
  if (typeof m.delta_on_hand === "number") return m.delta_on_hand;
  return 0;
}

export function movementMotivo(m: MovementDto) {
  return m.motivo ?? m.reason ?? null;
}

export function skuIsActive(item: EstoqueItemDto) {
  return item.ativo !== false;
}

/** Alias used by screens; mirrors maskFromLast4. */
export function maskCnpjLast4(last4?: string | null) {
  return maskFromLast4(last4);
}

export function threadPreview(thread: InboxThreadDto) {
  const msgs = thread.messages;
  if (!msgs?.length) return "";
  const last = msgs[msgs.length - 1] ?? msgs[0];
  return last?.body?.slice(0, 80) ?? "";
}

export type ClienteOption = { id: string; label: string };

export const SEED_CLIENTE_OPTION: ClienteOption = {
  id: "cli_mercado",
  label: "Mercado Exemplo LTDA",
};

/** No /api/saas/clientes — derive options from docs + approved cadastros. */
export function buildClienteOptions(input: {
  pedidos?: Array<{ cliente_id: string }>;
  orcamentos?: Array<{ cliente_id?: string | null }>;
  cadastros?: CadastroDto[];
}): ClienteOption[] {
  const map = new Map<string, string>();
  map.set(SEED_CLIENTE_OPTION.id, SEED_CLIENTE_OPTION.label);

  for (const p of input.pedidos ?? []) {
    if (p.cliente_id) map.set(p.cliente_id, map.get(p.cliente_id) ?? p.cliente_id);
  }
  for (const o of input.orcamentos ?? []) {
    if (o.cliente_id) map.set(o.cliente_id, map.get(o.cliente_id) ?? o.cliente_id);
  }
  for (const c of input.cadastros ?? []) {
    if (String(c.status) === "aprovado" && c.cliente_id) {
      map.set(c.cliente_id, c.razao_social);
    }
  }

  return Array.from(map, ([id, label]) => ({ id, label }));
}

export function clienteDisplay(doc: { cliente_id?: string | null }) {
  return doc.cliente_id ?? "—";
}

export type {
  CatalogItemDto,
  SessionDto,
  ThemeTokens,
  CanalAviso,
  CadastroStatus,
  OrcamentoStatus,
  PedidoStatus,
  VendaStatus,
  WhatsappIntent,
};
