import type { ThemeTokens } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http/respond";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function toDto(row: {
  marca: string;
  primary: string;
  accent: string;
  background: string;
  logoUrl: string | null;
}): ThemeTokens {
  return {
    marca: row.marca,
    primary: row.primary,
    accent: row.accent,
    background: row.background,
    logo_url: row.logoUrl,
  };
}

export async function getPublicTheme(slug?: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug: slug || env.defaultTenantSlug },
    include: { theme: true },
  });
  if (!tenant?.theme) throw new ApiError("nao_encontrado", "Tema não encontrado.");
  return toDto(tenant.theme);
}

export async function getSaasTheme(session: SessionContext) {
  assertSaasRole(session, "admin");
  const theme = await db.theme.findUnique({ where: { tenantId: session.tenantId } });
  if (!theme) throw new ApiError("nao_encontrado", "Tema não encontrado.");
  return toDto(theme);
}

export async function putSaasTheme(session: SessionContext, input: ThemeTokens) {
  assertSaasRole(session, "admin");
  for (const [key, value] of Object.entries({
    primary: input.primary,
    accent: input.accent,
    background: input.background,
  })) {
    if (!HEX.test(value)) throw new ApiError("validacao", `Cor inválida: ${key}.`);
  }
  if (!input.marca.trim()) throw new ApiError("validacao", "Marca é obrigatória.");
  const theme = await db.theme.update({
    where: { tenantId: session.tenantId },
    data: {
      marca: input.marca.trim(),
      primary: input.primary,
      accent: input.accent,
      background: input.background,
      logoUrl: input.logo_url,
    },
  });
  return toDto(theme);
}
