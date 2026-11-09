import type { SessionContext } from "../authz/session";
import { assertPermission, assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

export function auditDto(row: {
  id: string;
  actorUserId: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}) {
  let payload: unknown = {};
  try {
    payload = JSON.parse(row.payloadJson || "{}");
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    actor_user_id: row.actorUserId,
    action: row.action,
    aggregate_type: row.aggregateType,
    aggregate_id: row.aggregateId,
    payload,
    ip: row.ip,
    user_agent: row.userAgent,
    created_at: row.createdAt.toISOString(),
  };
}

/** Append-only audit write — no secrets / full CNPJ / MFA secrets. */
export async function recordAudit(input: {
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const id = newId("aud");
  await db.auditEvent.create({
    data: {
      id,
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payloadJson: JSON.stringify(input.payload ?? {}),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return id;
}

export async function listAudit(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  assertPermission(session, "audit_read");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const actor = url.searchParams.get("actor_user_id");
  const action = url.searchParams.get("action");
  const aggregateType = url.searchParams.get("aggregate_type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rows = await db.auditEvent.findMany({
    where: {
      tenantId: session.tenantId,
      ...(actor ? { actorUserId: actor } : {}),
      ...(action ? { action } : {}),
      ...(aggregateType ? { aggregateType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(decoded ? { id: { lt: decoded[0] } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(auditDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getAudit(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  assertPermission(session, "audit_read");
  const row = await db.auditEvent.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return auditDto(row);
}

export async function pruneAudit(tenantId: string, olderThanDays = 90) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  await db.auditEvent.deleteMany({
    where: { tenantId, createdAt: { lt: cutoff } },
  });
}
