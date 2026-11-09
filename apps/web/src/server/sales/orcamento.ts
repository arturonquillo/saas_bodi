import type { OrcamentoChannel, OrcamentoStatus } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { deliverOutboxIds, enqueueNotifications } from "../notifications/outbox-enqueue";
import { resolveAtacadoLines } from "./lines";
import { assertOrcamentoTransition } from "./machines";
import { createPedidoConfirmado } from "./pedido";

function orcamentoDto(row: {
  id: string;
  clienteId: string | null;
  cadastroRequestId: string | null;
  vendedorUserId: string;
  status: string;
  validoAte: Date | null;
  channel: string;
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    id: string;
    skuId: string;
    codigoSnapshot: string;
    nomeSnapshot: string;
    qty: number;
    unitPriceCentavos: number;
    notas: string | null;
  }>;
  history?: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    createdAt: Date;
  }>;
  pedido?: { id: string } | null;
}) {
  return {
    id: row.id,
    cliente_id: row.clienteId,
    cadastro_request_id: row.cadastroRequestId,
    vendedor_user_id: row.vendedorUserId,
    status: row.status,
    valido_ate: row.validoAte?.toISOString() ?? null,
    channel: row.channel,
    pedido_id: row.pedido?.id ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    linhas: row.lines.map((l) => ({
      id: l.id,
      sku_id: l.skuId,
      codigo: l.codigoSnapshot,
      nome: l.nomeSnapshot,
      qty: l.qty,
      unit_price_centavos: l.unitPriceCentavos,
      notas: l.notas,
    })),
    historico: (row.history ?? []).map((h) => ({
      from: h.fromStatus,
      to: h.toStatus,
      actor_user_id: h.actorUserId,
      created_at: h.createdAt.toISOString(),
    })),
  };
}

async function loadOrcamento(tenantId: string, id: string) {
  const row = await db.orcamento.findFirst({
    where: { id, tenantId },
    include: {
      lines: true,
      history: { orderBy: { createdAt: "asc" } },
      pedido: true,
    },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return row;
}

export async function createOrcamento(
  session: SessionContext,
  input: {
    cliente_id?: string;
    cadastro_request_id?: string;
    channel?: OrcamentoChannel;
    linhas: Array<{ sku_id: string; qty: number; notas?: string }>;
    valido_ate?: string;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (input.cliente_id) {
    const cliente = await db.cliente.findFirst({
      where: { id: input.cliente_id, tenantId: session.tenantId },
    });
    if (!cliente) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (input.cadastro_request_id) {
    const cad = await db.cadastroRequest.findFirst({
      where: { id: input.cadastro_request_id, tenantId: session.tenantId },
    });
    if (!cad) throw new ApiError("nao_encontrado", "Não encontrado.");
  }

  const id = newId("orc");
  await db.$transaction(async (tx) => {
    const lines = await resolveAtacadoLines(
      tx,
      session.tenantId,
      input.linhas.map((l) => ({ sku_id: l.sku_id, qty: l.qty })),
      { checkAvailable: false },
    );
    await tx.orcamento.create({
      data: {
        id,
        tenantId: session.tenantId,
        clienteId: input.cliente_id,
        cadastroRequestId: input.cadastro_request_id,
        vendedorUserId: session.userId,
        status: "rascunho",
        validoAte: input.valido_ate ? new Date(input.valido_ate) : null,
        channel: input.channel ?? "saas",
        lines: {
          create: lines.map((l, idx) => ({
            id: newId("oln"),
            tenantId: session.tenantId,
            skuId: l.skuId,
            codigoSnapshot: l.codigoSnapshot,
            nomeSnapshot: l.nomeSnapshot,
            qty: l.qty,
            unitPriceCentavos: l.unitPriceCentavos,
            notas: input.linhas[idx]?.notas ?? null,
          })),
        },
        history: {
          create: {
            id: newId("ohs"),
            tenantId: session.tenantId,
            fromStatus: null,
            toStatus: "rascunho",
            actorUserId: session.userId,
          },
        },
      },
    });
  });
  // Silent create → rascunho: no outbox
  return orcamentoDto(await loadOrcamento(session.tenantId, id));
}

export async function listSaasOrcamentos(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.orcamento.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } }, pedido: true },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(orcamentoDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getSaasOrcamento(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  return orcamentoDto(await loadOrcamento(session.tenantId, id));
}

function lojaOrcamentoScope(session: SessionContext) {
  const or: Array<{ clienteId: string } | { cadastroRequestId: string }> = [];
  if (session.clienteId) or.push({ clienteId: session.clienteId });
  if (session.cadastroRequestId) or.push({ cadastroRequestId: session.cadastroRequestId });
  if (!or.length) throw new ApiError("forbidden", "Sem cadastro ou cliente vinculado.");
  return or;
}

export async function listLojaOrcamentos(session: SessionContext, url: URL) {
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.orcamento.findMany({
    where: {
      tenantId: session.tenantId,
      OR: lojaOrcamentoScope(session),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } }, pedido: true },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(orcamentoDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getLojaOrcamento(session: SessionContext, id: string) {
  const row = await db.orcamento.findFirst({
    where: {
      id,
      tenantId: session.tenantId,
      OR: lojaOrcamentoScope(session),
    },
    include: { lines: true, history: { orderBy: { createdAt: "asc" } }, pedido: true },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return orcamentoDto(row);
}

async function maybeExpire(row: Awaited<ReturnType<typeof loadOrcamento>>) {
  if (
    row.status === "enviado" &&
    row.validoAte &&
    row.validoAte.getTime() < Date.now()
  ) {
    await db.orcamento.update({ where: { id: row.id }, data: { status: "expirado" } });
    await db.orcamentoStatusHistory.create({
      data: {
        id: newId("ohs"),
        tenantId: row.tenantId,
        orcamentoId: row.id,
        fromStatus: "enviado",
        toStatus: "expirado",
        actorUserId: null,
      },
    });
    return loadOrcamento(row.tenantId, row.id);
  }
  return row;
}

export async function transitionOrcamento(
  session: SessionContext,
  id: string,
  para: OrcamentoStatus,
  asCliente = false,
) {
  let row = await loadOrcamento(session.tenantId, id);
  row = await maybeExpire(row);

  if (asCliente) {
    const owns =
      (session.clienteId && row.clienteId === session.clienteId) ||
      (session.cadastroRequestId && row.cadastroRequestId === session.cadastroRequestId);
    if (!owns) throw new ApiError("nao_encontrado", "Não encontrado.");
    assertOrcamentoTransition(row.status, para, "cliente");
  } else {
    assertSaasRole(session, "admin", "vendedor");
    if (!session.saasRole) throw new ApiError("forbidden", "Papel sem permissão.");
    assertOrcamentoTransition(row.status, para, session.saasRole);
  }

  if (para === "enviado" && !row.validoAte) {
    // default +7 days
    row = await db.orcamento.update({
      where: { id },
      data: { validoAte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      include: { lines: true, history: { orderBy: { createdAt: "asc" } }, pedido: true },
    });
  }

  if (para === "aceito") {
    let clienteId = row.clienteId;
    if (!clienteId && row.cadastroRequestId) {
      const cad = await db.cadastroRequest.findFirst({
        where: { id: row.cadastroRequestId, tenantId: session.tenantId },
      });
      if (cad?.status === "aprovado" && cad.clienteId) clienteId = cad.clienteId;
    }
    if (!clienteId) {
      throw new ApiError("cadastro_nao_aprovado", "Cadastro do cliente não está aprovado.");
    }
    const cliente = await db.cliente.findFirst({
      where: { id: clienteId, tenantId: session.tenantId, status: "aprovado" },
    });
    if (!cliente) {
      throw new ApiError("cadastro_nao_aprovado", "Cadastro do cliente não está aprovado.");
    }

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
    const vendedor = await db.user.findUniqueOrThrow({ where: { id: row.vendedorUserId } });
    let outboxIds: string[] = [];

    // Create pedido first (reserves). Then mark orçamento aceito.
    const pedido = await createPedidoConfirmado({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      clienteId,
      vendedorUserId: row.vendedorUserId,
      channel: "orcamento",
      orcamentoId: row.id,
      linhas: row.lines.map((l) => ({ sku_id: l.skuId, qty: l.qty })),
    });

    await db.$transaction(async (tx) => {
      await tx.orcamento.update({
        where: { id },
        data: { status: "aceito", clienteId },
      });
      await tx.orcamentoStatusHistory.create({
        data: {
          id: newId("ohs"),
          tenantId: session.tenantId,
          orcamentoId: id,
          fromStatus: row.status,
          toStatus: "aceito",
          actorUserId: session.userId,
        },
      });
      outboxIds = await enqueueNotifications(tx, {
        tenantId: session.tenantId,
        canaisAviso: tenant.canaisAviso,
        customerRecipient: cliente.whatsapp || cliente.email,
        vendedorRecipient: vendedor.whatsapp || vendedor.email,
        templateKey: "orcamento.status",
        payload: { orcamento_id: id, status: "aceito", pedido_id: pedido.id },
        orcamentoId: id,
      });
    });
    await deliverOutboxIds(outboxIds);
    return orcamentoDto(await loadOrcamento(session.tenantId, id));
  }

  // Non-accept transitions
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const vendedor = await db.user.findUniqueOrThrow({ where: { id: row.vendedorUserId } });
  let customerRecipient: string | null = null;
  if (row.clienteId) {
    const c = await db.cliente.findFirst({ where: { id: row.clienteId } });
    customerRecipient = c?.whatsapp || c?.email || null;
  } else if (row.cadastroRequestId) {
    const c = await db.cadastroRequest.findFirst({ where: { id: row.cadastroRequestId } });
    customerRecipient = c?.whatsapp || c?.email || null;
  }

  let outboxIds: string[] = [];
  await db.$transaction(async (tx) => {
    await tx.orcamento.update({ where: { id }, data: { status: para } });
    await tx.orcamentoStatusHistory.create({
      data: {
        id: newId("ohs"),
        tenantId: session.tenantId,
        orcamentoId: id,
        fromStatus: row.status,
        toStatus: para,
        actorUserId: session.userId,
      },
    });
    // notify except silent rascunho create (already skipped)
    outboxIds = await enqueueNotifications(tx, {
      tenantId: session.tenantId,
      canaisAviso: tenant.canaisAviso,
      customerRecipient,
      vendedorRecipient: vendedor.whatsapp || vendedor.email,
      templateKey: "orcamento.status",
      payload: { orcamento_id: id, status: para },
      orcamentoId: id,
    });
  });
  await deliverOutboxIds(outboxIds);
  return orcamentoDto(await loadOrcamento(session.tenantId, id));
}
