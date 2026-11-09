import type { PedidoChannel, PedidoStatus } from "@saas-frota/shared";
import { stockEffectForPedidoTransition } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole, requireClienteAprovado } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { applyConsume, applyRelease, applyReserve } from "../inventory/stock-math";
import { deliverOutboxIds, enqueueNotifications } from "../notifications/outbox-enqueue";
import { resolveAtacadoLines } from "./lines";
import { assertPedidoTransition } from "./machines";

function pedidoDto(row: {
  id: string;
  clienteId: string;
  vendedorUserId: string;
  orcamentoId: string | null;
  channel: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    id: string;
    skuId: string;
    codigoSnapshot: string;
    nomeSnapshot: string;
    qty: number;
    unitPriceCentavos: number;
  }>;
  history?: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: row.id,
    cliente_id: row.clienteId,
    vendedor_user_id: row.vendedorUserId,
    orcamento_id: row.orcamentoId,
    channel: row.channel,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    linhas: row.lines.map((l) => ({
      id: l.id,
      sku_id: l.skuId,
      codigo: l.codigoSnapshot,
      nome: l.nomeSnapshot,
      qty: l.qty,
      unit_price_centavos: l.unitPriceCentavos,
    })),
    historico: (row.history ?? []).map((h) => ({
      from: h.fromStatus,
      to: h.toStatus,
      actor_user_id: h.actorUserId,
      created_at: h.createdAt.toISOString(),
    })),
  };
}

async function loadPedido(tenantId: string, id: string) {
  const row = await db.pedidoVenda.findFirst({
    where: { id, tenantId },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return row;
}

export async function createPedidoConfirmado(input: {
  tenantId: string;
  actorUserId: string;
  clienteId: string;
  vendedorUserId: string;
  channel: PedidoChannel;
  orcamentoId?: string;
  linhas: Array<{ sku_id: string; qty: number }>;
  requireVisibleLoja?: boolean;
}) {
  await requireClienteAprovado(input.clienteId, input.tenantId);
  if (input.orcamentoId) {
    const existing = await db.pedidoVenda.findFirst({
      where: { tenantId: input.tenantId, orcamentoId: input.orcamentoId },
    });
    if (existing) throw new ApiError("conflito", "Este orçamento já gerou um pedido.");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const cliente = await db.cliente.findFirstOrThrow({
    where: { id: input.clienteId, tenantId: input.tenantId },
  });
  const vendedor = await db.user.findUniqueOrThrow({ where: { id: input.vendedorUserId } });

  const pedidoId = newId("ped");
  let outboxIds: string[] = [];

  await db.$transaction(async (tx) => {
    const lines = await resolveAtacadoLines(tx, input.tenantId, input.linhas, {
      requireVisibleLoja: input.requireVisibleLoja,
      checkAvailable: true,
    });
    await tx.pedidoVenda.create({
      data: {
        id: pedidoId,
        tenantId: input.tenantId,
        clienteId: input.clienteId,
        vendedorUserId: input.vendedorUserId,
        orcamentoId: input.orcamentoId,
        channel: input.channel,
        status: "confirmado",
        lines: {
          create: lines.map((l) => ({
            id: newId("pln"),
            tenantId: input.tenantId,
            skuId: l.skuId,
            codigoSnapshot: l.codigoSnapshot,
            nomeSnapshot: l.nomeSnapshot,
            qty: l.qty,
            unitPriceCentavos: l.unitPriceCentavos,
          })),
        },
        history: {
          create: {
            id: newId("phs"),
            tenantId: input.tenantId,
            fromStatus: null,
            toStatus: "confirmado",
            actorUserId: input.actorUserId,
          },
        },
      },
    });
    await applyReserve(tx, {
      tenantId: input.tenantId,
      pedidoId,
      actorUserId: input.actorUserId,
      lines: lines.map((l) => ({ skuId: l.skuId, qty: l.qty })),
    });
    outboxIds = await enqueueNotifications(tx, {
      tenantId: input.tenantId,
      canaisAviso: tenant.canaisAviso,
      customerRecipient: cliente.whatsapp || cliente.email,
      vendedorRecipient: vendedor.whatsapp || vendedor.email,
      templateKey: "pedido.status",
      payload: { pedido_id: pedidoId, status: "confirmado" },
      pedidoId,
    });
  });

  await deliverOutboxIds(outboxIds);
  return loadPedido(input.tenantId, pedidoId);
}

export async function createSaasPedido(
  session: SessionContext,
  input: { cliente_id: string; linhas: Array<{ sku_id: string; qty: number }> },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await createPedidoConfirmado({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    clienteId: input.cliente_id,
    vendedorUserId: session.userId,
    channel: "saas",
    linhas: input.linhas,
  });
  return pedidoDto(row);
}

export async function createLojaPedido(
  session: SessionContext,
  linhas: Array<{ sku_id: string; qty: number }>,
) {
  if (session.clienteStatus !== "aprovado" || !session.clienteId) {
    throw new ApiError("cadastro_nao_aprovado", "Cadastro do cliente não está aprovado.");
  }
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  if (tenant.lojaModo !== "pedido_direto") {
    throw new ApiError("forbidden", "Loja configurada para orçamento, não pedido direto.");
  }
  if (!tenant.defaultVendedorUserId) {
    throw new ApiError("validacao", "Tenant sem vendedor padrão.");
  }
  const row = await createPedidoConfirmado({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    clienteId: session.clienteId,
    vendedorUserId: tenant.defaultVendedorUserId,
    channel: "loja",
    linhas,
    requireVisibleLoja: true,
  });
  return pedidoDto(row);
}

export async function listSaasPedidos(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.pedidoVenda.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } } },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(pedidoDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getSaasPedido(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  return pedidoDto(await loadPedido(session.tenantId, id));
}

export async function listLojaPedidos(session: SessionContext, url: URL) {
  if (!session.clienteId) throw new ApiError("forbidden", "Sem cliente vinculado.");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.pedidoVenda.findMany({
    where: {
      tenantId: session.tenantId,
      clienteId: session.clienteId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } } },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(pedidoDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getLojaPedido(session: SessionContext, id: string) {
  if (!session.clienteId) throw new ApiError("forbidden", "Sem cliente vinculado.");
  const row = await db.pedidoVenda.findFirst({
    where: { id, tenantId: session.tenantId, clienteId: session.clienteId },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return pedidoDto(row);
}

export async function transitionPedido(session: SessionContext, id: string, para: PedidoStatus) {
  assertSaasRole(session, "admin", "vendedor");
  if (!session.saasRole) throw new ApiError("forbidden", "Papel sem permissão.");
  const row = await loadPedido(session.tenantId, id);
  assertPedidoTransition(row.status, para, session.saasRole);
  const effect = stockEffectForPedidoTransition(row.status, para);
  if (!effect) throw new ApiError("transicao_ilegal", "Transição de pedido não permitida.");

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const cliente = await db.cliente.findFirstOrThrow({
    where: { id: row.clienteId, tenantId: session.tenantId },
  });
  const vendedor = await db.user.findUniqueOrThrow({ where: { id: row.vendedorUserId } });

  let outboxIds: string[] = [];
  await db.$transaction(async (tx) => {
    await tx.pedidoVenda.update({ where: { id }, data: { status: para } });
    await tx.pedidoStatusHistory.create({
      data: {
        id: newId("phs"),
        tenantId: session.tenantId,
        pedidoId: id,
        fromStatus: row.status,
        toStatus: para,
        actorUserId: session.userId,
      },
    });
    const lines = row.lines.map((l) => ({ skuId: l.skuId, qty: l.qty }));
    if (effect === "release") {
      await applyRelease(tx, {
        tenantId: session.tenantId,
        pedidoId: id,
        actorUserId: session.userId,
        lines,
      });
    } else if (effect === "consume") {
      await applyConsume(tx, {
        tenantId: session.tenantId,
        pedidoId: id,
        actorUserId: session.userId,
        lines,
      });
    }
    outboxIds = await enqueueNotifications(tx, {
      tenantId: session.tenantId,
      canaisAviso: tenant.canaisAviso,
      customerRecipient: cliente.whatsapp || cliente.email,
      vendedorRecipient: vendedor.whatsapp || vendedor.email,
      templateKey: "pedido.status",
      payload: { pedido_id: id, status: para },
      pedidoId: id,
    });
  });
  await deliverOutboxIds(outboxIds);
  return pedidoDto(await loadPedido(session.tenantId, id));
}
