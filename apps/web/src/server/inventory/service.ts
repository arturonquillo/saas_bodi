import { availableQty, SKU_UNIDADES, type SkuUnidade } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

const UNIDADE_SET = new Set<string>(SKU_UNIDADES);

function parseUnidade(value: unknown, fallback: SkuUnidade = "un"): SkuUnidade {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !UNIDADE_SET.has(value)) {
    throw new ApiError("validacao", "Unidade inválida.");
  }
  return value as SkuUnidade;
}

function normalizeDescricao(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) throw new ApiError("validacao", "Descrição deve ter no máximo 500 caracteres.");
  return trimmed;
}

function skuDto(sku: {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: SkuUnidade;
  precoAtacadoCentavos: number;
  descontoMaxPct: number;
  qtdMinAtacado: number;
  visivelLoja: boolean;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
  balance: { onHand: number; reserved: number } | null;
}) {
  const onHand = sku.balance?.onHand ?? 0;
  const reserved = sku.balance?.reserved ?? 0;
  return {
    id: sku.id,
    codigo: sku.codigo,
    nome: sku.nome,
    descricao: sku.descricao,
    unidade: sku.unidade,
    preco_atacado_centavos: sku.precoAtacadoCentavos,
    desconto_max_pct: sku.descontoMaxPct,
    qtd_min_atacado: sku.qtdMinAtacado,
    visivel_loja: sku.visivelLoja,
    ativo: sku.ativo,
    on_hand: onHand,
    reserved,
    available: availableQty(onHand, reserved),
    created_at: sku.createdAt.toISOString(),
    updated_at: sku.updatedAt.toISOString(),
  };
}

function movementDto(m: {
  id: string;
  type: "adjust" | "reserve" | "release" | "consume";
  deltaOnHand: number;
  deltaReserved: number;
  reason: string | null;
  actorUserId: string | null;
  pedidoId: string | null;
  createdAt: Date;
}) {
  let qty: number;
  if (m.type === "adjust") qty = m.deltaOnHand;
  else if (m.type === "reserve") qty = m.deltaReserved;
  else if (m.type === "release") qty = Math.abs(m.deltaReserved);
  else qty = Math.abs(m.deltaOnHand);
  return {
    id: m.id,
    type: m.type,
    qty,
    motivo: m.reason,
    actor_user_id: m.actorUserId,
    pedido_id: m.pedidoId,
    created_at: m.createdAt.toISOString(),
    // transitional aliases
    delta_on_hand: m.deltaOnHand,
    delta_reserved: m.deltaReserved,
    reason: m.reason,
  };
}

export async function listEstoque(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const q = url.searchParams.get("q")?.trim();
  const ativoParam = url.searchParams.get("ativo");
  const visivelParam = url.searchParams.get("visivel_loja");
  const rows = await db.sku.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
      ...(q
        ? {
            OR: [
              { codigo: { contains: q.toUpperCase() } },
              { nome: { contains: q } },
            ],
          }
        : {}),
      ...(ativoParam === "true" || ativoParam === "false"
        ? { ativo: ativoParam === "true" }
        : {}),
      ...(visivelParam === "true" || visivelParam === "false"
        ? { visivelLoja: visivelParam === "true" }
        : {}),
    },
    include: { balance: true },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(skuDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getEstoque(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const sku = await db.sku.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { balance: true },
  });
  if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
  return skuDto(sku);
}

export async function listMovimentos(session: SessionContext, id: string, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const sku = await db.sku.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.inventoryMovement.findMany({
    where: {
      tenantId: session.tenantId,
      skuId: id,
      ...(decoded ? { createdAt: { lt: new Date(decoded[0]!) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(movementDto),
    next_cursor:
      rows.length > limit ? encodeCursor([page[page.length - 1]!.createdAt.toISOString()]) : null,
  };
}

export async function createSku(
  session: SessionContext,
  input: {
    codigo: string;
    nome: string;
    descricao?: string | null;
    unidade?: SkuUnidade;
    preco_atacado_centavos: number;
    desconto_max_pct?: number;
    qtd_min_atacado?: number;
    on_hand?: number;
    visivel_loja?: boolean;
    ativo?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const codigo = input.codigo.trim().toUpperCase();
  if (!codigo || !input.nome.trim()) throw new ApiError("validacao", "Código e nome são obrigatórios.");
  if (input.preco_atacado_centavos < 0) throw new ApiError("validacao", "Preço inválido.");
  const descontoMax =
    input.desconto_max_pct === undefined ? 0 : Math.trunc(input.desconto_max_pct);
  if (descontoMax < 0 || descontoMax > 100) {
    throw new ApiError("validacao", "desconto_max_pct deve ser entre 0 e 100.");
  }
  const onHand = Math.max(0, Math.trunc(input.on_hand ?? 0));
  const unidade = parseUnidade(input.unidade);
  const descricao = normalizeDescricao(input.descricao);
  const id = newId("sku");
  try {
    await db.$transaction(async (tx) => {
      await tx.sku.create({
        data: {
          id,
          tenantId: session.tenantId,
          codigo,
          nome: input.nome.trim(),
          descricao,
          unidade,
          precoAtacadoCentavos: Math.trunc(input.preco_atacado_centavos),
          descontoMaxPct: descontoMax,
          qtdMinAtacado: Math.max(1, Math.trunc(input.qtd_min_atacado ?? 1)),
          visivelLoja: input.visivel_loja ?? true,
          ativo: input.ativo ?? true,
        },
      });
      await tx.inventoryBalance.create({
        data: { skuId: id, tenantId: session.tenantId, onHand, reserved: 0 },
      });
      if (onHand > 0) {
        await tx.inventoryMovement.create({
          data: {
            id: newId("mov"),
            tenantId: session.tenantId,
            skuId: id,
            type: "adjust",
            deltaOnHand: onHand,
            deltaReserved: 0,
            reason: "estoque_inicial",
            actorUserId: session.userId,
          },
        });
      }
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new ApiError("conflito", "Código de SKU já existe.", { code: "codigo_duplicado" });
    }
    throw err;
  }
  return getEstoque(session, id);
}

export async function patchSku(
  session: SessionContext,
  id: string,
  input: {
    codigo?: string;
    nome?: string;
    descricao?: string | null;
    unidade?: SkuUnidade;
    preco_atacado_centavos?: number;
    desconto_max_pct?: number;
    qtd_min_atacado?: number;
    visivel_loja?: boolean;
    ativo?: boolean;
    on_hand?: unknown;
    reserved?: unknown;
    available?: unknown;
  },
) {
  assertSaasRole(session, "admin");
  if (
    input.on_hand !== undefined ||
    input.reserved !== undefined ||
    input.available !== undefined
  ) {
    throw new ApiError(
      "validacao",
      "Quantidades não podem ser alteradas via PATCH; use /ajuste.",
    );
  }
  const sku = await db.sku.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");

  const data: {
    codigo?: string;
    nome?: string;
    descricao?: string | null;
    unidade?: SkuUnidade;
    precoAtacadoCentavos?: number;
    descontoMaxPct?: number;
    qtdMinAtacado?: number;
    visivelLoja?: boolean;
    ativo?: boolean;
  } = {};

  if (input.codigo !== undefined) {
    const codigo = input.codigo.trim().toUpperCase();
    if (!codigo) throw new ApiError("validacao", "Código inválido.");
    data.codigo = codigo;
  }
  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (!nome) throw new ApiError("validacao", "Nome inválido.");
    data.nome = nome;
  }
  if (input.descricao !== undefined) data.descricao = normalizeDescricao(input.descricao);
  if (input.unidade !== undefined) data.unidade = parseUnidade(input.unidade);
  if (input.preco_atacado_centavos !== undefined) {
    if (input.preco_atacado_centavos < 0) throw new ApiError("validacao", "Preço inválido.");
    data.precoAtacadoCentavos = Math.trunc(input.preco_atacado_centavos);
  }
  if (input.desconto_max_pct !== undefined) {
    const pct = Math.trunc(input.desconto_max_pct);
    if (pct < 0 || pct > 100) {
      throw new ApiError("validacao", "desconto_max_pct deve ser entre 0 e 100.");
    }
    data.descontoMaxPct = pct;
  }
  if (input.qtd_min_atacado !== undefined) {
    data.qtdMinAtacado = Math.max(1, Math.trunc(input.qtd_min_atacado));
  }
  if (input.visivel_loja !== undefined) data.visivelLoja = input.visivel_loja;
  if (input.ativo !== undefined) data.ativo = input.ativo;

  try {
    await db.sku.update({ where: { id }, data });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new ApiError("conflito", "Código de SKU já existe.", { code: "codigo_duplicado" });
    }
    throw err;
  }
  return getEstoque(session, id);
}

export async function adjustOnHand(
  session: SessionContext,
  id: string,
  delta: number,
  motivo: string,
) {
  assertSaasRole(session, "admin");
  const deltaOnHand = Math.trunc(delta);
  if (deltaOnHand === 0) throw new ApiError("validacao", "delta_on_hand não pode ser zero.");
  if (!motivo.trim()) throw new ApiError("validacao", "Motivo do ajuste é obrigatório.");
  const sku = await db.sku.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { balance: true },
  });
  if (!sku || !sku.balance) throw new ApiError("nao_encontrado", "Não encontrado.");
  const next = sku.balance.onHand + deltaOnHand;
  if (next < sku.balance.reserved) {
    throw new ApiError("estoque_insuficiente", "on_hand não pode ficar abaixo de reserved.");
  }
  if (next < 0) throw new ApiError("validacao", "Saldo não pode ser negativo.");
  await db.$transaction(async (tx) => {
    await tx.inventoryBalance.update({
      where: { skuId: id },
      data: { onHand: next },
    });
    await tx.inventoryMovement.create({
      data: {
        id: newId("mov"),
        tenantId: session.tenantId,
        skuId: id,
        type: "adjust",
        deltaOnHand,
        deltaReserved: 0,
        reason: motivo.trim(),
        actorUserId: session.userId,
      },
    });
  });
  return getEstoque(session, id);
}

export async function toggleVisibilidade(session: SessionContext, id: string, visivel: boolean) {
  return patchSku(session, id, { visivel_loja: visivel });
}
