import { availableQty, type CatalogItemDto, type SkuUnidade } from "@saas-frota/shared";
import { db } from "../db";
import { env } from "../env";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";

async function resolveTenant(slug?: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug: slug || env.defaultTenantSlug },
  });
  if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");
  return tenant;
}

function toItem(row: {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: SkuUnidade;
  precoAtacadoCentavos: number;
  qtdMinAtacado: number;
  balance: { onHand: number; reserved: number } | null;
}): CatalogItemDto {
  const available = availableQty(row.balance?.onHand ?? 0, row.balance?.reserved ?? 0);
  return {
    id: row.id,
    sku: row.codigo,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao,
    unidade: row.unidade,
    preco_atacado_centavos: row.precoAtacadoCentavos,
    qtd_min_atacado: row.qtdMinAtacado,
    available,
    sem_estoque: available <= 0,
  };
}

export async function getStoreCatalog(slug: string | undefined, url: URL) {
  const tenant = await resolveTenant(slug);
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.sku.findMany({
    where: {
      tenantId: tenant.id,
      ativo: true,
      visivelLoja: true,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { balance: true },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(toItem),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getStoreProduct(id: string, slug?: string) {
  const tenant = await resolveTenant(slug);
  const row = await db.sku.findFirst({
    where: { id, tenantId: tenant.id, ativo: true, visivelLoja: true },
    include: { balance: true },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return toItem(row);
}
