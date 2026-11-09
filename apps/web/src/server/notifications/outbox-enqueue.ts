import type { CanalAviso, Prisma } from "@prisma/client";
import { newId } from "../ids";
import { stubOutboxTransport } from "../ports/outbox";

type Tx = Prisma.TransactionClient;

type EnqueueInput = {
  tenantId: string;
  canaisAviso: CanalAviso;
  customerRecipient: string | null;
  vendedorRecipient: string | null;
  templateKey: string;
  payload: Record<string, unknown>;
  orcamentoId?: string;
  pedidoId?: string;
  vendaId?: string;
  cadastroRequestId?: string;
};

function channelsFor(canais: CanalAviso): Array<"email" | "whatsapp"> {
  if (canais === "ambos") return ["email", "whatsapp"];
  return [canais];
}

export async function enqueueNotifications(tx: Tx, input: EnqueueInput) {
  const channels = channelsFor(input.canaisAviso);
  const createdIds: string[] = [];
  const payloadJson = JSON.stringify(input.payload);

  for (const channel of channels) {
    if (input.customerRecipient) {
      const id = newId("out");
      await tx.notificationOutbox.create({
        data: {
          id,
          tenantId: input.tenantId,
          channel,
          recipientRole: "customer",
          recipient: input.customerRecipient,
          templateKey: input.templateKey,
          payloadJson,
          status: "pendente",
          orcamentoId: input.orcamentoId,
          pedidoId: input.pedidoId,
          vendaId: input.vendaId,
          cadastroRequestId: input.cadastroRequestId,
        },
      });
      createdIds.push(id);
    }
    if (input.vendedorRecipient) {
      const id = newId("out");
      await tx.notificationOutbox.create({
        data: {
          id,
          tenantId: input.tenantId,
          channel,
          recipientRole: "vendedor",
          recipient: input.vendedorRecipient,
          templateKey: input.templateKey,
          payloadJson,
          status: "pendente",
          orcamentoId: input.orcamentoId,
          pedidoId: input.pedidoId,
          vendaId: input.vendaId,
          cadastroRequestId: input.cadastroRequestId,
        },
      });
      createdIds.push(id);
    }
  }
  return createdIds;
}

/** After commit: stub transport flips pendente → enviado. */
export async function deliverOutboxIds(ids: string[]) {
  for (const id of ids) {
    await stubOutboxTransport.send({
      id,
      channel: "whatsapp",
      recipient: "",
      templateKey: "",
      payload: {},
    });
  }
}
