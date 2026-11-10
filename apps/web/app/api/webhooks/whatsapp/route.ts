import { NextResponse } from "next/server";
import { handleError } from "@/server/http/respond";
import {
  assertWhatsappWebhookSignature,
  findWhatsappChannelByPhoneNumberId,
  handleWhatsappVerifyChallenge,
  ingestMetaWhatsappPayload,
} from "@/server/crm/whatsapp-webhook";

export const runtime = "nodejs";

/**
 * Meta Cloud API webhook (global).
 * GET — subscription verify challenge (matches sealed webhook_verify_token).
 * POST — inbound messages resolved by metadata.phone_number_id.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const result = await handleWhatsappVerifyChallenge({
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    });
    if ("challenge" in result) {
      return new NextResponse(result.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.json({ error: { code: "forbidden", message: result.error } }, {
      status: result.status,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { error: { code: "validacao", message: "JSON inválido." } },
        { status: 400 },
      );
    }

    const phoneNumberId = extractPhoneNumberId(payload);
    if (!phoneNumberId) {
      // Meta may send status-only payloads; ack without processing.
      return NextResponse.json({ data: { ok: true, ingested: 0 } });
    }

    const channel = await findWhatsappChannelByPhoneNumberId(phoneNumberId);
    if (!channel) {
      return NextResponse.json(
        { error: { code: "nao_encontrado", message: "Canal WhatsApp não encontrado." } },
        { status: 404 },
      );
    }

    await assertWhatsappWebhookSignature({
      rawBody,
      signatureHeader: req.headers.get("x-hub-signature-256"),
      channel,
    });

    const result = await ingestMetaWhatsappPayload({
      payload,
      inboxIdHint: channel.inboxId,
    });
    return NextResponse.json({ data: { ok: true, ...result } });
  } catch (err) {
    return handleError(err);
  }
}

function extractPhoneNumberId(payload: unknown): string | null {
  const root = payload as {
    entry?: Array<{
      changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }>;
    }>;
  };
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const id = change.value?.metadata?.phone_number_id?.trim();
      if (id) return id;
    }
  }
  return null;
}
