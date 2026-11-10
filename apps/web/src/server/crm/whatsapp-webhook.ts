import { db } from "../db";
import { env } from "../env";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { channelSimulateInboundPort } from "../ports/channel";
import { verifyMetaWebhookSignature } from "../ports/meta-whatsapp";
import { ApiError } from "../http/respond";

type MetaInboundMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

type MetaChangeValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: MetaInboundMessage[];
  statuses?: unknown[];
};

function toE164(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (!digits) return waId;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function openChannelSecrets(ciphertext: string | null | undefined) {
  if (!ciphertext) return null;
  try {
    return await channelCredentialsVault.open(ciphertext);
  } catch {
    return null;
  }
}

export async function findWhatsappChannelByInboxId(inboxId: string) {
  return db.channelWhatsapp.findFirst({
    where: { inboxId },
    include: { inbox: true },
  });
}

export async function findWhatsappChannelByPhoneNumberId(phoneNumberId: string) {
  return db.channelWhatsapp.findFirst({
    where: { phoneNumberId },
    include: { inbox: true },
  });
}

/** Match verify token against sealed secrets (scoped inbox or scan). Never log token. */
export async function resolveChannelForVerifyToken(
  verifyToken: string,
  inboxId?: string,
): Promise<{ tenantId: string; inboxId: string } | null> {
  if (!verifyToken) return null;
  const rows = inboxId
    ? await db.channelWhatsapp.findMany({
        where: { inboxId },
        select: { tenantId: true, inboxId: true, secretsCiphertext: true },
      })
    : await db.channelWhatsapp.findMany({
        where: { secretsCiphertext: { not: null } },
        select: { tenantId: true, inboxId: true, secretsCiphertext: true },
        take: 200,
      });

  for (const row of rows) {
    const secrets = await openChannelSecrets(row.secretsCiphertext);
    if (secrets?.webhook_verify_token && secrets.webhook_verify_token === verifyToken) {
      return { tenantId: row.tenantId, inboxId: row.inboxId };
    }
  }
  return null;
}

export async function handleWhatsappVerifyChallenge(input: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
  inboxId?: string;
}): Promise<{ challenge: string } | { error: string; status: number }> {
  if (input.mode !== "subscribe" || !input.verifyToken || !input.challenge) {
    return { error: "Parâmetros de verificação inválidos.", status: 400 };
  }
  const match = await resolveChannelForVerifyToken(input.verifyToken, input.inboxId);
  if (!match) {
    return { error: "Verify token não confere.", status: 403 };
  }
  if (input.inboxId && match.inboxId !== input.inboxId) {
    return { error: "Verify token não confere.", status: 403 };
  }
  return { challenge: input.challenge };
}

export async function assertWhatsappWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  channel: { secretsCiphertext: string | null };
}): Promise<void> {
  const secrets = await openChannelSecrets(input.channel.secretsCiphertext);
  const appSecret = secrets?.api_secret;
  if (!appSecret) {
    throw new ApiError("forbidden", "Canal sem App Secret configurado.");
  }
  const ok = verifyMetaWebhookSignature(appSecret, input.rawBody, input.signatureHeader);
  if (!ok) {
    throw new ApiError("forbidden", "Assinatura do webhook inválida.");
  }
}

export async function ingestMetaWhatsappPayload(input: {
  payload: unknown;
  inboxIdHint?: string;
}): Promise<{ ingested: number; ignored: number }> {
  const root = input.payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: MetaChangeValue }>;
    }>;
  };

  if (root.object && root.object !== "whatsapp_business_account") {
    return { ingested: 0, ignored: 0 };
  }

  let ingested = 0;
  let ignored = 0;

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "messages") {
        ignored += 1;
        continue;
      }
      const value = change.value;
      if (!value?.messages?.length) {
        // status updates etc.
        ignored += 1;
        continue;
      }

      const phoneNumberId = value.metadata?.phone_number_id?.trim();
      const channel =
        (phoneNumberId ? await findWhatsappChannelByPhoneNumberId(phoneNumberId) : null) ??
        (input.inboxIdHint ? await findWhatsappChannelByInboxId(input.inboxIdHint) : null);

      if (!channel) {
        ignored += value.messages.length;
        continue;
      }

      if (channel.connectionStatus === "not_configured") {
        ignored += value.messages.length;
        continue;
      }

      for (const msg of value.messages) {
        if (!msg.from || msg.type !== "text" || !msg.text?.body?.trim()) {
          ignored += 1;
          continue;
        }
        const phoneE164 = toE164(msg.from);
        const contactName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

        await channelSimulateInboundPort.ingestInbound({
          tenantId: channel.tenantId,
          inboxId: channel.inboxId,
          phoneE164,
          body: msg.text.body.trim(),
          simulated: false,
          contactNome: contactName,
          providerMessageId: msg.id,
        });
        ingested += 1;
      }
    }
  }

  return { ingested, ignored };
}

export function publicWhatsappWebhookUrl(inboxId: string): string {
  const base = (env.publicAppUrl || "").replace(/\/$/, "");
  const path = `/api/webhooks/whatsapp/${inboxId}`;
  return base ? `${base}${path}` : path;
}
