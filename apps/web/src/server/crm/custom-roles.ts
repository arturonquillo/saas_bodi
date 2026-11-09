import {
  CUSTOM_ROLE_PERMISSION_BITS,
  type CustomRolePermissionBit,
} from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";
import { recordAudit } from "./audit";

const ALLOWED = new Set<string>(CUSTOM_ROLE_PERMISSION_BITS);

export function customRoleDto(row: {
  id: string;
  name: string;
  description: string | null;
  permissionsJson: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(row.permissionsJson || "[]") as unknown;
    if (Array.isArray(parsed)) permissions = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    permissions = [];
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function normalizePermissions(raw: unknown): CustomRolePermissionBit[] {
  if (!Array.isArray(raw)) throw new ApiError("validacao", "permissions deve ser array.");
  const out: CustomRolePermissionBit[] = [];
  for (const bit of raw) {
    if (typeof bit !== "string" || !ALLOWED.has(bit)) {
      throw new ApiError("validacao", `Permissão desconhecida: ${String(bit)}`);
    }
    if (!out.includes(bit as CustomRolePermissionBit)) {
      out.push(bit as CustomRolePermissionBit);
    }
  }
  return out;
}

export async function listPapeis(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.customRole.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(customRoleDto) };
}

export async function createPapel(
  session: SessionContext,
  input: { name: string; description?: string | null; permissions: string[] },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const permissions = normalizePermissions(input.permissions);
  const clash = await db.customRole.findFirst({
    where: { tenantId: session.tenantId, name: input.name.trim() },
  });
  if (clash) throw new ApiError("conflito", "Nome de papel já em uso.");
  const id = newId("rol");
  await db.customRole.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      description: input.description ?? null,
      permissionsJson: JSON.stringify(permissions),
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "custom_role.updated",
    aggregateType: "custom_role",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { custom_role_id: id, created: true },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "custom_role.created",
    aggregateType: "custom_role",
    aggregateId: id,
    payload: { name: input.name.trim(), permissions },
  });
  return getPapel(session, id);
}

export async function getPapel(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.customRole.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return customRoleDto(row);
}

export async function patchPapel(
  session: SessionContext,
  id: string,
  input: { name?: string; description?: string | null; permissions?: string[] },
) {
  assertSaasRole(session, "admin");
  const row = await db.customRole.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.name?.trim()) {
    const clash = await db.customRole.findFirst({
      where: {
        tenantId: session.tenantId,
        name: input.name.trim(),
        id: { not: id },
      },
    });
    if (clash) throw new ApiError("conflito", "Nome de papel já em uso.");
  }
  const permissions =
    input.permissions === undefined ? undefined : normalizePermissions(input.permissions);
  await db.customRole.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description,
      permissionsJson: permissions ? JSON.stringify(permissions) : undefined,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "custom_role.updated",
    aggregateType: "custom_role",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { custom_role_id: id },
  });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "custom_role.updated",
    aggregateType: "custom_role",
    aggregateId: id,
    payload: {},
  });
  return getPapel(session, id);
}

export async function deletePapel(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.customRole.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.membership.updateMany({
    where: { tenantId: session.tenantId, customRoleId: id },
    data: { customRoleId: null },
  });
  await db.customRole.delete({ where: { id } });
  await recordAudit({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "custom_role.deleted",
    aggregateType: "custom_role",
    aggregateId: id,
    payload: { name: row.name },
  });
  return { ok: true };
}
