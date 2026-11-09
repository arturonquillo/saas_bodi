import type { CustomRolePermissionBit, SaasRole } from "@saas-frota/shared";
import { ApiError } from "../http/respond";
import { db } from "../db";
import { requireSession, type SessionContext } from "./session";

export async function requireCustomer() {
  const session = await requireSession("loja");
  if (!session.isCustomer) throw new ApiError("forbidden", "Acesso só para clientes.");
  return session;
}

export async function requireSaasRole(...roles: SaasRole[]) {
  const session = await requireSession("saas");
  assertSaasRole(session, ...roles);
  return session;
}

/** Domain services use this with an already-resolved session (no cookie read). */
export function assertSaasRole(session: SessionContext, ...roles: SaasRole[]) {
  if (session.surface !== "saas") {
    throw new ApiError("forbidden", "Superfície de sessão inválida.");
  }
  if (!session.saasRole || (roles.length && !roles.includes(session.saasRole))) {
    throw new ApiError("forbidden", "Papel sem permissão para esta ação.");
  }
}

/** Admin short-circuits; otherwise CustomRole permissions_json bits. */
export function hasPermission(
  session: SessionContext,
  bit: CustomRolePermissionBit | string,
): boolean {
  if (session.saasRole === "admin") return true;
  return (session.permissionBits ?? []).includes(bit);
}

export function assertPermission(
  session: SessionContext,
  ...bits: Array<CustomRolePermissionBit | string>
) {
  if (!bits.length) return;
  if (bits.some((b) => hasPermission(session, b))) return;
  throw new ApiError("forbidden", "Papel sem permissão para esta ação.");
}

/** Require SaaS session with at least one permission bit (admin always passes). */
export async function requirePermission(...bits: Array<CustomRolePermissionBit | string>) {
  const session = await requireSession("saas");
  if (!session.saasRole) {
    throw new ApiError("forbidden", "Papel sem permissão para esta ação.");
  }
  assertPermission(session, ...bits);
  return session;
}

/** Reports: admin or report_manage. */
export function assertReportAccess(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  assertPermission(session, "report_manage");
}

export async function requireClienteAprovado(clienteId: string, tenantId: string) {
  const cliente = await db.cliente.findFirst({
    where: { id: clienteId, tenantId },
  });
  if (!cliente) {
    throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (cliente.status !== "aprovado") {
    throw new ApiError("cadastro_nao_aprovado", "Cadastro do cliente não está aprovado.");
  }
  return cliente;
}

export function assertTenantScope(rowTenantId: string, sessionTenantId: string) {
  if (rowTenantId !== sessionTenantId) {
    throw new ApiError("nao_encontrado", "Não encontrado.");
  }
}

export function assertSurface(session: SessionContext, surface: "loja" | "saas") {
  if (session.surface !== surface) {
    throw new ApiError("forbidden", "Superfície de sessão inválida.");
  }
}
