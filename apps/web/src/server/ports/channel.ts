import type {
  ChannelSendPort,
  ChannelSimulateInboundPort,
  SystemIntentLabel,
  WhatsappInboxSimulatePort,
  WhatsappIntent,
} from "@saas-frota/shared";
import { db } from "../db";
import { appendDomainEvent } from "../crm/events";
import { newId } from "../ids";
import { ensureJobWorkerStarted } from "./jobs";

const INTENT_TO_LABEL: Record<WhatsappIntent, SystemIntentLabel> = {
  cadastro: "intent:cadastro",
  orcamento: "intent:orcamento",
  info_empresa: "intent:info_empresa",
  outro: "intent:outro",
};

export async function getDefaultWhatsappInbox(tenantId: string) {
  const inbox = await db.inbox.findFirst({
    where: { tenantId, channelType: "whatsapp" },
    orderBy: { createdAt: "asc" },
  });
  return inbox;
}

export const channelSimulateInboundPort: ChannelSimulateInboundPort = {
  async ingestInbound(input) {
    ensureJobWorkerStarted();
    const inbox =
      (input.inboxId
        ? await db.inbox.findFirst({ where: { id: input.inboxId, tenantId: input.tenantId } })
        : null) ?? (await getDefaultWhatsappInbox(input.tenantId));
    if (!inbox) {
      throw new Error("Caixa WhatsApp padrão não encontrada para o tenant.");
    }

    let contact = await db.contact.findFirst({
      where: { tenantId: input.tenantId, phoneE164: input.phoneE164 },
    });
    if (!contact) {
      contact = await db.contact.create({
        data: {
          id: newId("ct"),
          tenantId: input.tenantId,
          nome: input.phoneE164,
          phoneE164: input.phoneE164,
        },
      });
    }

    const existingCi = await db.contactInbox.findFirst({
      where: {
        tenantId: input.tenantId,
        inboxId: inbox.id,
        sourceId: input.phoneE164,
      },
    });
    if (!existingCi) {
      await db.contactInbox.create({
        data: {
          id: newId("ci"),
          tenantId: input.tenantId,
          contactId: contact.id,
          inboxId: inbox.id,
          sourceId: input.phoneE164,
        },
      });
    }

    let conversation = await db.conversation.findFirst({
      where: {
        tenantId: input.tenantId,
        inboxId: inbox.id,
        contactId: contact.id,
        status: { in: ["open", "pending", "snoozed"] },
      },
      orderBy: { lastActivityAt: "desc" },
    });

    const now = new Date();
    let created = false;
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          id: newId("cnv"),
          tenantId: input.tenantId,
          inboxId: inbox.id,
          contactId: contact.id,
          status: "open",
          lastActivityAt: now,
        },
      });
      created = true;
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastActivityAt: now, status: conversation.status === "resolved" ? "open" : undefined },
      });
    }

    if (input.intentLabel) {
      const label = await db.label.findUnique({
        where: { tenantId_title: { tenantId: input.tenantId, title: input.intentLabel } },
      });
      if (label) {
        const existing = await db.conversationLabel.findUnique({
          where: {
            conversationId_labelId: { conversationId: conversation.id, labelId: label.id },
          },
        });
        if (!existing) {
          await db.conversationLabel.create({
            data: {
              id: newId("clb"),
              tenantId: input.tenantId,
              conversationId: conversation.id,
              labelId: label.id,
            },
          });
        }
      }
    }

    const messageId = newId("msg");
    await db.message.create({
      data: {
        id: messageId,
        tenantId: input.tenantId,
        conversationId: conversation.id,
        messageType: "incoming",
        private: false,
        content: input.body,
        contentType: "text",
        deliveryStatus: "delivered",
        simulated: true,
      },
    });

    if (created) {
      await appendDomainEvent(db, {
        tenantId: input.tenantId,
        type: "conversation.created",
        aggregateType: "conversation",
        aggregateId: conversation.id,
        payload: { conversation_id: conversation.id, inbox_id: inbox.id },
      });
    }
    await appendDomainEvent(db, {
      tenantId: input.tenantId,
      type: "message.created",
      aggregateType: "message",
      aggregateId: messageId,
      payload: { conversation_id: conversation.id, message_id: messageId, message_type: "incoming" },
    });

    return {
      conversationId: conversation.id,
      messageId,
      contactId: contact.id,
    };
  },
};

export const stubChannelSendPort: ChannelSendPort = {
  async sendOutgoing() {
    // No Meta HTTP — mark as sent.
    return { deliveryStatus: "sent" };
  },
};

/** Legacy adapter: maps CRM Conversation → old thread ids for deprecated callers. */
export const whatsappInboxSimulatePort: WhatsappInboxSimulatePort = {
  async ingestInbound(input) {
    const intentLabel = input.intentHint ? INTENT_TO_LABEL[input.intentHint] : undefined;
    const result = await channelSimulateInboundPort.ingestInbound({
      tenantId: input.tenantId,
      phoneE164: input.phoneE164,
      body: input.body,
      intentLabel,
    });
    return { threadId: result.conversationId, messageId: result.messageId };
  },
};
