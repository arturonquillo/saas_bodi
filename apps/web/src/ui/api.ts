import type {
  ApiErr,
  CadastroDto,
  CanalAviso,
  CatalogItemDto,
  EstoqueItemDto,
  InboxThreadDetailDto,
  InboxThreadDto,
  LojaConfigDto,
  MovementType,
  OrcamentoDto,
  OutboxDto,
  PedidoDto,
  SaasConfigDto,
  SessionDto,
  ThemeTokens,
  UserDto,
  VendaDto,
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

export type MovementDto = {
  id: string;
  type: MovementType | string;
  delta_on_hand?: number;
  delta_reserved?: number;
  reason?: string | null;
  created_at?: string;
};

export type CustomerPickDto = {
  id: string;
  razao_social: string;
  cnpj_masked: string;
  whatsapp?: string | null;
  status?: string;
};

export type {
  CadastroDto,
  CanalAviso,
  CatalogItemDto,
  EstoqueItemDto,
  InboxThreadDetailDto,
  InboxThreadDto,
  LojaConfigDto,
  OrcamentoDto,
  OutboxDto,
  PedidoDto,
  SaasConfigDto,
  SessionDto,
  ThemeTokens,
  UserDto,
  VendaDto,
};
