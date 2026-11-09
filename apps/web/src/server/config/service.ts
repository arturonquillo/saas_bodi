import type { CanalAviso, LojaModo } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http/respond";

export async function getLojaConfig(slug?: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug: slug || env.defaultTenantSlug },
  });
  if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");
  return {
    loja_modo: tenant.lojaModo,
    whatsapp_comercial: tenant.whatsappComercial,
    nome_fantasia: tenant.nomeFantasia,
  };
}

export async function getSaasConfig(session: SessionContext) {
  assertSaasRole(session, "admin");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  return {
    razao_social: tenant.razaoSocial,
    nome_fantasia: tenant.nomeFantasia,
    cnpj_last4: tenant.cnpjLast4,
    whatsapp_comercial: tenant.whatsappComercial,
    canais_aviso: tenant.canaisAviso,
    loja_modo: tenant.lojaModo,
    default_vendedor_user_id: tenant.defaultVendedorUserId,
  };
}

export async function putSaasConfig(
  session: SessionContext,
  input: {
    razao_social?: string;
    nome_fantasia?: string;
    whatsapp_comercial?: string | null;
    canais_aviso?: CanalAviso;
    loja_modo?: LojaModo;
    default_vendedor_user_id?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  if (input.default_vendedor_user_id) {
    const mem = await db.membership.findFirst({
      where: {
        tenantId: session.tenantId,
        userId: input.default_vendedor_user_id,
        saasRole: { in: ["admin", "vendedor"] },
      },
    });
    if (!mem) throw new ApiError("validacao", "Vendedor padrão inválido.");
  }
  const tenant = await db.tenant.update({
    where: { id: session.tenantId },
    data: {
      razaoSocial: input.razao_social?.trim() || undefined,
      nomeFantasia: input.nome_fantasia?.trim() || undefined,
      whatsappComercial:
        input.whatsapp_comercial === undefined ? undefined : input.whatsapp_comercial,
      canaisAviso: input.canais_aviso,
      lojaModo: input.loja_modo,
      defaultVendedorUserId:
        input.default_vendedor_user_id === undefined
          ? undefined
          : input.default_vendedor_user_id,
    },
  });
  return {
    razao_social: tenant.razaoSocial,
    nome_fantasia: tenant.nomeFantasia,
    cnpj_last4: tenant.cnpjLast4,
    whatsapp_comercial: tenant.whatsappComercial,
    canais_aviso: tenant.canaisAviso,
    loja_modo: tenant.lojaModo,
    default_vendedor_user_id: tenant.defaultVendedorUserId,
  };
}
