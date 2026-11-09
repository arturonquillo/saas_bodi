import bcrypt from "bcryptjs";
import type { SaasRole } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

function userDto(row: {
  id: string;
  email: string;
  nome: string;
  whatsapp: string | null;
  ativo: boolean;
  memberships: Array<{ saasRole: SaasRole | null; isCustomer: boolean }>;
}) {
  const mem = row.memberships[0];
  return {
    id: row.id,
    email: row.email,
    nome: row.nome,
    whatsapp: row.whatsapp,
    ativo: row.ativo,
    saas_role: mem?.saasRole ?? null,
    is_customer: mem?.isCustomer ?? false,
  };
}

export async function listUsuarios(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const memberships = await db.membership.findMany({
    where: {
      tenantId: session.tenantId,
      saasRole: { not: null },
      ...(decoded ? { userId: { gt: decoded[0] } } : {}),
    },
    include: { user: true },
    orderBy: { userId: "asc" },
    take: limit + 1,
  });
  const page = memberships.slice(0, limit);
  return {
    items: page.map((m) =>
      userDto({
        ...m.user,
        memberships: [{ saasRole: m.saasRole, isCustomer: m.isCustomer }],
      }),
    ),
    next_cursor: memberships.length > limit ? encodeCursor([page[page.length - 1]!.userId]) : null,
  };
}

export async function createUsuario(
  session: SessionContext,
  input: { email: string; nome: string; senha: string; saas_role: SaasRole; whatsapp?: string },
) {
  assertSaasRole(session, "admin");
  if (!["admin", "vendedor"].includes(input.saas_role)) {
    throw new ApiError("validacao", "Papel inválido.");
  }
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new ApiError("conflito", "E-mail já em uso.");
  }
  if (input.senha.length < 8) throw new ApiError("validacao", "Senha deve ter ao menos 8 caracteres.");
  const id = newId("usr");
  const passwordHash = await bcrypt.hash(input.senha, 10);
  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        email,
        nome: input.nome.trim(),
        passwordHash,
        whatsapp: input.whatsapp?.trim() || null,
        ativo: true,
      },
    });
    await tx.membership.create({
      data: {
        id: newId("mem"),
        tenantId: session.tenantId,
        userId: id,
        saasRole: input.saas_role,
        isCustomer: false,
      },
    });
  });
  const user = await db.user.findUniqueOrThrow({
    where: { id },
    include: { memberships: { where: { tenantId: session.tenantId } } },
  });
  return userDto(user);
}

export async function patchUsuario(
  session: SessionContext,
  id: string,
  input: { ativo?: boolean; saas_role?: SaasRole },
) {
  assertSaasRole(session, "admin");
  const membership = await db.membership.findFirst({
    where: { tenantId: session.tenantId, userId: id, saasRole: { not: null } },
    include: { user: true },
  });
  if (!membership) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.saas_role && !["admin", "vendedor"].includes(input.saas_role)) {
    throw new ApiError("validacao", "Papel inválido.");
  }
  await db.$transaction(async (tx) => {
    if (input.ativo !== undefined) {
      await tx.user.update({ where: { id }, data: { ativo: input.ativo } });
    }
    if (input.saas_role) {
      await tx.membership.update({
        where: { id: membership.id },
        data: { saasRole: input.saas_role },
      });
    }
  });
  const user = await db.user.findUniqueOrThrow({
    where: { id },
    include: { memberships: { where: { tenantId: session.tenantId } } },
  });
  return userDto(user);
}
