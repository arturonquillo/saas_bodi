import type { Prisma } from "@prisma/client";
import { availableQty } from "@saas-frota/shared";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

type Tx = Prisma.TransactionClient;

export async function applyReserve(
  tx: Tx,
  input: {
    tenantId: string;
    pedidoId: string;
    actorUserId: string;
    lines: Array<{ skuId: string; qty: number }>;
  },
) {
  for (const line of input.lines) {
    const balance = await tx.inventoryBalance.findFirst({
      where: { skuId: line.skuId, tenantId: input.tenantId },
    });
    if (!balance) throw new ApiError("nao_encontrado", "SKU sem saldo.");
    if (line.qty > availableQty(balance.onHand, balance.reserved)) {
      throw new ApiError("estoque_insuficiente", "Estoque insuficiente para reservar.");
    }
    await tx.inventoryBalance.update({
      where: { skuId: line.skuId },
      data: { reserved: balance.reserved + line.qty },
    });
    await tx.inventoryMovement.create({
      data: {
        id: newId("mov"),
        tenantId: input.tenantId,
        skuId: line.skuId,
        pedidoId: input.pedidoId,
        type: "reserve",
        deltaOnHand: 0,
        deltaReserved: line.qty,
        actorUserId: input.actorUserId,
      },
    });
  }
}

export async function applyRelease(
  tx: Tx,
  input: {
    tenantId: string;
    pedidoId: string;
    actorUserId: string;
    lines: Array<{ skuId: string; qty: number }>;
  },
) {
  for (const line of input.lines) {
    const balance = await tx.inventoryBalance.findFirst({
      where: { skuId: line.skuId, tenantId: input.tenantId },
    });
    if (!balance) throw new ApiError("nao_encontrado", "SKU sem saldo.");
    if (balance.reserved < line.qty) {
      throw new ApiError("conflito", "Reserva inconsistente ao liberar estoque.");
    }
    await tx.inventoryBalance.update({
      where: { skuId: line.skuId },
      data: { reserved: balance.reserved - line.qty },
    });
    await tx.inventoryMovement.create({
      data: {
        id: newId("mov"),
        tenantId: input.tenantId,
        skuId: line.skuId,
        pedidoId: input.pedidoId,
        type: "release",
        deltaOnHand: 0,
        deltaReserved: -line.qty,
        actorUserId: input.actorUserId,
      },
    });
  }
}

export async function applyConsume(
  tx: Tx,
  input: {
    tenantId: string;
    pedidoId: string;
    actorUserId: string;
    lines: Array<{ skuId: string; qty: number }>;
  },
) {
  for (const line of input.lines) {
    const balance = await tx.inventoryBalance.findFirst({
      where: { skuId: line.skuId, tenantId: input.tenantId },
    });
    if (!balance) throw new ApiError("nao_encontrado", "SKU sem saldo.");
    if (balance.reserved < line.qty || balance.onHand < line.qty) {
      throw new ApiError("estoque_insuficiente", "Estoque insuficiente para consumir.");
    }
    await tx.inventoryBalance.update({
      where: { skuId: line.skuId },
      data: {
        onHand: balance.onHand - line.qty,
        reserved: balance.reserved - line.qty,
      },
    });
    await tx.inventoryMovement.create({
      data: {
        id: newId("mov"),
        tenantId: input.tenantId,
        skuId: line.skuId,
        pedidoId: input.pedidoId,
        type: "consume",
        deltaOnHand: -line.qty,
        deltaReserved: -line.qty,
        actorUserId: input.actorUserId,
      },
    });
  }
}
