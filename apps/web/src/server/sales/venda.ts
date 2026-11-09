import type { VendaStatus } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole, requireClienteAprovado } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { deliverOutboxIds, enqueueNotifications } from "../notifications/outbox-enqueue";
import { assertVendaTransition } from "./machines";

function vendaDto(row: {
  id: string;
  pedidoId: string;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  history?: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: row.id,
    pedido_id: row.pedidoId,
    status: row.status,
    created_by_user_id: row.createdByUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    historico: (row.history ?? []).map((h) => ({
      from: h.fromStatus,
      to: h.toStatus,
      actor_user_id: h.actorUserId,
      created_at: h.createdAt.toISOString(),
    })),
  };
}

async function loadVenda(tenantId: string, id: string) {
  const row = await db.vendaFaturamento.findFirst({
    where: { id, tenantId },
    include: { history: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return row;
}

export async function faturarPedido(session: SessionContext, pedidoId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const pedido = await db.pedidoVenda.findFirst({
    where: { id: pedidoId, tenantId: session.tenantId },
  });
  if (!pedido) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (pedido.status === "cancelado") {
    throw new ApiError("transicao_ilegal", "Pedido cancelado não pode ser faturado.");
  }
  await requireClienteAprovado(pedido.clienteId, session.tenantId);

  const existing = await db.vendaFaturamento.findFirst({
    where: {
      tenantId: session.tenantId,
      pedidoId,
      status: { not: "cancelado" },
    },
  });
  if (existing) throw new ApiError("conflito", "Já existe venda ativa para este pedido.");

  const id = newId("ven");
  await db.$transaction(async (tx) => {
    await tx.vendaFaturamento.create({
      data: {
        id,
        tenantId: session.tenantId,
        pedidoId,
        status: "rascunho",
        createdByUserId: session.userId,
        history: {
          create: {
            id: newId("vhs"),
            tenantId: session.tenantId,
            fromStatus: null,
            toStatus: "rascunho",
            actorUserId: session.userId,
          },
        },
      },
    });
  });
  // Silent create → rascunho
  return vendaDto(await loadVenda(session.tenantId, id));
}

export async function listVendas(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.vendaFaturamento.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { history: { orderBy: { createdAt: "asc" } } },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(vendaDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getVenda(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  return vendaDto(await loadVenda(session.tenantId, id));
}

export async function transitionVenda(session: SessionContext, id: string, para: VendaStatus) {
  assertSaasRole(session, "admin", "vendedor");
  if (!session.saasRole) throw new ApiError("forbidden", "Papel sem permissão.");
  const row = await loadVenda(session.tenantId, id);
  assertVendaTransition(row.status, para, session.saasRole);

  const pedido = await db.pedidoVenda.findFirstOrThrow({
    where: { id: row.pedidoId, tenantId: session.tenantId },
  });
  const cliente = await db.cliente.findFirstOrThrow({
    where: { id: pedido.clienteId, tenantId: session.tenantId },
  });
  const vendedor = await db.user.findUniqueOrThrow({ where: { id: pedido.vendedorUserId } });
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });

  let outboxIds: string[] = [];
  await db.$transaction(async (tx) => {
    await tx.vendaFaturamento.update({ where: { id }, data: { status: para } });
    await tx.vendaStatusHistory.create({
      data: {
        id: newId("vhs"),
        tenantId: session.tenantId,
        vendaId: id,
        fromStatus: row.status,
        toStatus: para,
        actorUserId: session.userId,
      },
    });
    if (para === "faturado") {
      outboxIds = await enqueueNotifications(tx, {
        tenantId: session.tenantId,
        canaisAviso: tenant.canaisAviso,
        customerRecipient: cliente.whatsapp || cliente.email,
        vendedorRecipient: vendedor.whatsapp || vendedor.email,
        templateKey: "venda.faturado",
        payload: { venda_id: id, pedido_id: pedido.id, status: "faturado" },
        vendaId: id,
        pedidoId: pedido.id,
      });
    }
  });
  await deliverOutboxIds(outboxIds);
  return vendaDto(await loadVenda(session.tenantId, id));
}
