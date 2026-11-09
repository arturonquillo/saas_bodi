import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

const FILTER_TYPES = new Set(["conversation", "contact"]);

function parseQuery(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function filterDto(row: {
  id: string;
  name: string;
  filterType: string;
  queryJson: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    filter_type: row.filterType,
    query: parseQuery(row.queryJson),
    user_id: row.userId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listFiltros(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const rows = await db.customFilter.findMany({
    where: { tenantId: session.tenantId, userId: session.userId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(filterDto) };
}

export async function createFiltro(
  session: SessionContext,
  input: { name: string; filter_type: string; query?: Record<string, unknown> },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  if (!FILTER_TYPES.has(input.filter_type)) {
    throw new ApiError("validacao", "filter_type inválido.");
  }
  const id = newId("flt");
  await db.customFilter.create({
    data: {
      id,
      tenantId: session.tenantId,
      userId: session.userId,
      name: input.name.trim(),
      filterType: input.filter_type,
      queryJson: JSON.stringify(input.query ?? {}),
    },
  });
  return getFiltro(session, id);
}

export async function getFiltro(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.customFilter.findFirst({
    where: { id, tenantId: session.tenantId, userId: session.userId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return filterDto(row);
}

export async function patchFiltro(
  session: SessionContext,
  id: string,
  input: { name?: string; query?: Record<string, unknown> },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.customFilter.findFirst({
    where: { id, tenantId: session.tenantId, userId: session.userId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.customFilter.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      queryJson: input.query === undefined ? undefined : JSON.stringify(input.query),
    },
  });
  return getFiltro(session, id);
}

export async function deleteFiltro(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.customFilter.findFirst({
    where: { id, tenantId: session.tenantId, userId: session.userId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.customFilter.delete({ where: { id } });
  return { id, deleted: true };
}
