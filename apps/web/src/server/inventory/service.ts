import { availableQty } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

function skuDto(sku: {
  id: string;
  codigo: string;
  nome: string;
  precoAtacadoCentavos: number;
  qtdMinAtacado: number;
  visivelLoja: boolean;
  balance: { onHand: number; reserved: number } | null;
}) {
  const onHand = sku.balance?.onHand ?? 0;
  const reserved = sku.balance?.reserved ?? 0;
  return {
    id: sku.id,
    codigo: sku.codigo,
    nome: sku.nome,
    preco_atacado_centavos: sku.precoAtacadoCentavos,
    qtd_min_atacado: sku.qtdMinAtacado,
    visivel_loja: sku.visivelLoja,
    on_hand: onHand,
    reserved,
    available: availableQty(onHand, reserved),
  };
}

export async function listEstoque(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.sku.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
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
    items: page.map((m) => ({
      id: m.id,
      type: m.type,
      delta_on_hand: m.deltaOnHand,
      delta_reserved: m.deltaReserved,
      reason: m.reason,
      pedido_id: m.pedidoId,
      created_at: m.createdAt.toISOString(),
    })),
    next_cursor:
      rows.length > limit ? encodeCursor([page[page.length - 1]!.createdAt.toISOString()]) : null,
  };
}

export async function createSku(
  session: SessionContext,
  input: {
    codigo: string;
    nome: string;
    preco_atacado_centavos: number;
    qtd_min_atacado?: number;
    on_hand?: number;
    visivel_loja?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const codigo = input.codigo.trim().toUpperCase();
  if (!codigo || !input.nome.trim()) throw new ApiError("validacao", "Código e nome são obrigatórios.");
  if (input.preco_atacado_centavos < 0) throw new ApiError("validacao", "Preço inválido.");
  const onHand = Math.max(0, Math.trunc(input.on_hand ?? 0));
  const id = newId("sku");
  await db.$transaction(async (tx) => {
    await tx.sku.create({
      data: {
        id,
        tenantId: session.tenantId,
        codigo,
        nome: input.nome.trim(),
        precoAtacadoCentavos: Math.trunc(input.preco_atacado_centavos),
        qtdMinAtacado: Math.max(1, Math.trunc(input.qtd_min_atacado ?? 1)),
        visivelLoja: input.visivel_loja ?? true,
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
          reason: "criação",
          actorUserId: session.userId,
        },
      });
    }
  });
  return getEstoque(session, id);
}

export async function patchSku(
  session: SessionContext,
  id: string,
  input: {
    nome?: string;
    preco_atacado_centavos?: number;
    qtd_min_atacado?: number;
  },
) {
  assertSaasRole(session, "admin");
  const sku = await db.sku.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.sku.update({
    where: { id },
    data: {
      nome: input.nome?.trim() || undefined,
      precoAtacadoCentavos:
        input.preco_atacado_centavos !== undefined
          ? Math.trunc(input.preco_atacado_centavos)
          : undefined,
      qtdMinAtacado:
        input.qtd_min_atacado !== undefined
          ? Math.max(1, Math.trunc(input.qtd_min_atacado))
          : undefined,
    },
  });
  return getEstoque(session, id);
}

export async function adjustOnHand(session: SessionContext, id: string, delta: number, reason: string) {
  assertSaasRole(session, "admin");
  if (!reason.trim()) throw new ApiError("validacao", "Motivo do ajuste é obrigatório.");
  const sku = await db.sku.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { balance: true },
  });
  if (!sku || !sku.balance) throw new ApiError("nao_encontrado", "Não encontrado.");
  const next = sku.balance.onHand + Math.trunc(delta);
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
        deltaOnHand: Math.trunc(delta),
        deltaReserved: 0,
        reason: reason.trim(),
        actorUserId: session.userId,
      },
    });
  });
  return getEstoque(session, id);
}

export async function toggleVisibilidade(session: SessionContext, id: string, visivel: boolean) {
  assertSaasRole(session, "admin");
  const sku = await db.sku.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!sku) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.sku.update({ where: { id }, data: { visivelLoja: visivel } });
  return getEstoque(session, id);
}
