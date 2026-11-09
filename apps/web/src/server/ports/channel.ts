import type {
  ChannelSendPort,
  ChannelSimulateInboundPort,
  SystemIntentLabel,
  WhatsappInboxSimulatePort,
  WhatsappIntent,
} from "@saas-frota/shared";
import { db } from "../db";
import { appendDomainEvent } from "../crm/events";
import { inboxIsOpen } from "../crm/hours";
import { newId } from "../ids";
import { ensureJobWorkerStarted, jobEnqueuePort } from "./jobs";

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
      where: { tenantId: input.tenantId, phoneE164: input.phoneE164, mergedIntoId: null },
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
      await appendDomainEvent(db, {
        tenantId: input.tenantId,
        type: "contact.updated",
        aggregateType: "contact",
        aggregateId: contact.id,
        payload: { contact_id: contact.id, created: true },
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

    const botLink = await db.agentBotInbox.findFirst({
      where: { tenantId: input.tenantId, inboxId: inbox.id },
      include: { agentBot: true },
    });
    const activeBot = botLink?.agentBot?.active ? botLink.agentBot : null;

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          id: newId("cnv"),
          tenantId: input.tenantId,
          inboxId: inbox.id,
          contactId: contact.id,
          status: activeBot ? "pending" : "open",
          botAgentBotId: activeBot?.id ?? null,
          lastActivityAt: now,
        },
      });
      created = true;
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastActivityAt: now,
          status: conversation.status === "resolved" ? "open" : undefined,
          ...(activeBot && !conversation.botAgentBotId && conversation.status !== "open"
            ? {}
            : activeBot && conversation.status === "pending"
              ? { botAgentBotId: activeBot.id }
              : {}),
        },
      });
      if (activeBot && conversation.status === "pending") {
        conversation = { ...conversation, botAgentBotId: activeBot.id };
      }
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

    // Greeting (new) / OOOH (outside hours) auto-replies
    const openNow = await inboxIsOpen(input.tenantId, inbox.id, now);
    const autoBody = !openNow
      ? inbox.oooMessage
      : created
        ? inbox.greeting
        : null;
    if (autoBody?.trim()) {
      await db.message.create({
        data: {
          id: newId("msg"),
          tenantId: input.tenantId,
          conversationId: conversation.id,
          messageType: "outgoing",
          private: false,
          content: autoBody.trim(),
          contentType: "text",
          deliveryStatus: "sent",
          simulated: true,
        },
      });
    }

    if (created) {
      await appendDomainEvent(db, {
        tenantId: input.tenantId,
        type: "conversation.created",
        aggregateType: "conversation",
        aggregateId: conversation.id,
        payload: {
          conversation_id: conversation.id,
          inbox_id: inbox.id,
          bot_agent_bot_id: activeBot?.id ?? null,
        },
      });
      if (inbox.allowAutoAssign) {
        const policy = await db.assignmentPolicy.findFirst({
          where: { tenantId: input.tenantId, inboxId: inbox.id },
        });
        const kind =
          policy?.kind === "balanced" ? "assignment.balanced" : "assignment.round_robin";
        await jobEnqueuePort.enqueue({
          tenantId: input.tenantId,
          kind,
          payload: {
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            inbox_id: inbox.id,
          },
        });
      }
    }
    await appendDomainEvent(db, {
      tenantId: input.tenantId,
      type: "message.created",
      aggregateType: "message",
      aggregateId: messageId,
      payload: {
        conversation_id: conversation.id,
        inbox_id: inbox.id,
        message_id: messageId,
        message_type: "incoming",
      },
    });

    if (activeBot && (created || conversation.botAgentBotId === activeBot.id)) {
      if (!conversation.botAgentBotId) {
        await db.conversation.update({
          where: { id: conversation.id },
          data: { botAgentBotId: activeBot.id, status: "pending" },
        });
      }
      await jobEnqueuePort.enqueue({
        tenantId: input.tenantId,
        kind: "bot.deliver",
        payload: {
          tenant_id: input.tenantId,
          conversation_id: conversation.id,
          message_id: messageId,
          event: "message_created",
          payload: { content: input.body },
        },
      });
    }

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
