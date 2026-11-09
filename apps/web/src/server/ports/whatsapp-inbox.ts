import type { WhatsappInboxSimulatePort, WhatsappIntent } from "@saas-frota/shared";
import { db } from "../db";
import { newId } from "../ids";

export const whatsappInboxSimulatePort: WhatsappInboxSimulatePort = {
  async ingestInbound(input) {
    const existing = await db.whatsappThread.findFirst({
      where: { tenantId: input.tenantId, phoneE164: input.phoneE164, status: "aberta" },
      orderBy: { updatedAt: "desc" },
    });
    const threadId = existing?.id ?? newId("wath");
    if (!existing) {
      await db.whatsappThread.create({
        data: {
          id: threadId,
          tenantId: input.tenantId,
          phoneE164: input.phoneE164,
          intent: (input.intentHint as WhatsappIntent | undefined) ?? null,
          status: "aberta",
        },
      });
    } else if (input.intentHint && !existing.intent) {
      await db.whatsappThread.update({
        where: { id: existing.id },
        data: { intent: input.intentHint },
      });
    }
    const messageId = newId("wmsg");
    await db.whatsappMessage.create({
      data: {
        id: messageId,
        tenantId: input.tenantId,
        threadId,
        direction: "inbound",
        body: input.body,
        simulated: true,
      },
    });
    return { threadId, messageId };
  },
};
