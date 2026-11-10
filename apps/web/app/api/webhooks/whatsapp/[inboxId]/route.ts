import { NextResponse } from "next/server";
import { handleError } from "@/server/http/respond";
import {
  assertWhatsappWebhookSignature,
  findWhatsappChannelByInboxId,
  handleWhatsappVerifyChallenge,
  ingestMetaWhatsappPayload,
} from "@/server/crm/whatsapp-webhook";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ inboxId: string }> };

/**
 * Meta Cloud API webhook scoped to a CRM inbox (preferred callback URL).
 * Example (test3): https://test3.lecrunch.com.br/api/webhooks/whatsapp/inx_wa_default
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { inboxId } = await ctx.params;
    const url = new URL(req.url);
    const result = await handleWhatsappVerifyChallenge({
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
      inboxId,
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

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { inboxId } = await ctx.params;
    const channel = await findWhatsappChannelByInboxId(inboxId);
    if (!channel) {
      return NextResponse.json(
        { error: { code: "nao_encontrado", message: "Caixa WhatsApp não encontrada." } },
        { status: 404 },
      );
    }

    const rawBody = await req.text();
    await assertWhatsappWebhookSignature({
      rawBody,
      signatureHeader: req.headers.get("x-hub-signature-256"),
      channel,
    });

    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { error: { code: "validacao", message: "JSON inválido." } },
        { status: 400 },
      );
    }

    const result = await ingestMetaWhatsappPayload({
      payload,
      inboxIdHint: inboxId,
    });
    return NextResponse.json({ data: { ok: true, ...result } });
  } catch (err) {
    return handleError(err);
  }
}
