import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { putChannel, getChannel } from "./channels";
import { postMensagem, simularInbound } from "./conversations";
import {
  assertWhatsappWebhookSignature,
  handleWhatsappVerifyChallenge,
  ingestMetaWhatsappPayload,
} from "./whatsapp-webhook";
import { db } from "../db";
import {
  metaSignatureHeader,
  setMetaWhatsappFetch,
  verifyMetaWebhookSignature,
} from "../ports/meta-whatsapp";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";

describe("WhatsApp Meta Cloud API (mocked HTTP)", () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = await createWorld("wa-meta");
    setMetaWhatsappFetch(null);
  });

  afterEach(async () => {
    setMetaWhatsappFetch(null);
    await destroyWorld(world);
  });

  it("rejects live without required Meta secrets / ids", async () => {
    const admin = sessionOf(world, "admin");
    const err = await catchApi(() =>
      putChannel(admin, world.inboxId, { connection_status: "live" }),
    );
    expect(err?.code).toBe("validacao");
  });

  it("accepts connected alias as live when credentials complete", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_test",
      business_account_id: "waba_test",
      api_token: "tok_test_not_logged",
      api_secret: "app_secret_test",
      webhook_verify_token: "verify_me",
      connection_status: "connected",
    });
    const ch = await getChannel(admin, world.inboxId);
    expect(ch.connection_status).toBe("live");
    expect(ch.api_token).toBe("••••••••");
    expect(JSON.stringify(ch)).not.toContain("tok_test_not_logged");
    expect(ch.webhook_url).toContain(`/api/webhooks/whatsapp/${world.inboxId}`);
  });

  it("keeps non-WA channels rejecting live", async () => {
    const admin = sessionOf(world, "admin");
    const { createInbox } = await import("./channels");
    const box = await createInbox(admin, { name: "Email stub", channel_type: "email" });
    const err = await catchApi(() =>
      putChannel(admin, box.id, { connection_status: "live" }),
    );
    expect(err?.code).toBe("nao_implementado");
  });

  it("verify challenge matches sealed verify token", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_v",
      business_account_id: "waba_v",
      api_token: "tok",
      api_secret: "sec",
      webhook_verify_token: "hub-verify-xyz",
      connection_status: "ready_stub",
    });
    const ok = await handleWhatsappVerifyChallenge({
      mode: "subscribe",
      verifyToken: "hub-verify-xyz",
      challenge: "challenge-123",
      inboxId: world.inboxId,
    });
    expect(ok).toEqual({ challenge: "challenge-123" });

    const bad = await handleWhatsappVerifyChallenge({
      mode: "subscribe",
      verifyToken: "wrong",
      challenge: "challenge-123",
      inboxId: world.inboxId,
    });
    expect("status" in bad && bad.status).toBe(403);
  });

  it("validates X-Hub-Signature-256 with App Secret", async () => {
    const raw = `{"object":"whatsapp_business_account"}`;
    expect(verifyMetaWebhookSignature("app_secret", raw, metaSignatureHeader("app_secret", raw))).toBe(
      true,
    );
    expect(verifyMetaWebhookSignature("app_secret", raw, "sha256=deadbeef")).toBe(false);

    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_sig",
      business_account_id: "waba_sig",
      api_token: "tok",
      api_secret: "app_secret",
      webhook_verify_token: "v",
      connection_status: "live",
    });
    const channel = await db.channelWhatsapp.findFirstOrThrow({
      where: { inboxId: world.inboxId },
    });
    await expect(
      assertWhatsappWebhookSignature({
        rawBody: raw,
        signatureHeader: metaSignatureHeader("app_secret", raw),
        channel,
      }),
    ).resolves.toBeUndefined();
    await expect(
      assertWhatsappWebhookSignature({
        rawBody: raw,
        signatureHeader: "sha256=00",
        channel,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("ingests Meta inbound text into CRM conversation (simulated=false)", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_in",
      business_account_id: "waba_in",
      api_token: "tok",
      api_secret: "sec",
      webhook_verify_token: "v",
      connection_status: "live",
    });

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_in",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "5511988877766",
                  phone_number_id: "pnid_in",
                },
                contacts: [{ profile: { name: "Cliente Meta" }, wa_id: "5511999887766" }],
                messages: [
                  {
                    from: "5511999887766",
                    id: "wamid.TEST",
                    timestamp: "1710000000",
                    type: "text",
                    text: { body: "Olá do WhatsApp real" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await ingestMetaWhatsappPayload({ payload, inboxIdHint: world.inboxId });
    expect(result.ingested).toBe(1);

    const msg = await db.message.findFirst({
      where: { tenantId: world.tenantId, content: "Olá do WhatsApp real" },
    });
    expect(msg).toBeTruthy();
    expect(msg!.simulated).toBe(false);
    expect(msg!.messageType).toBe("incoming");
  });

  it("outbound agent reply calls Meta Graph when live (mocked fetch)", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_out",
      business_account_id: "waba_out",
      api_token: "permanent-token-secret",
      api_secret: "sec",
      webhook_verify_token: "v",
      phone_e164_display: "+5511988877766",
      connection_status: "live",
    });

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    setMetaWhatsappFetch(fetchMock as unknown as typeof fetch);

    const conv = await simularInbound(admin, {
      inbox_id: world.inboxId,
      phone_e164: "+5511999001122",
      body: "oi",
    });
    const out = await postMensagem(sessionOf(world, "vendedor"), conv.id, {
      content: "Resposta live",
    });
    expect(out.delivery_status).toBe("sent");
    expect(out.simulated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/pnid_out/messages");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer permanent-token-secret");
    // Ensure we never stringify secrets into console via test assertion on body only
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.to).toBe("5511999001122");
    expect(body.text.body).toContain("Resposta live");
  });

  it("stub outbound when not live (no fetch)", async () => {
    const admin = sessionOf(world, "admin");
    const fetchMock = vi.fn();
    setMetaWhatsappFetch(fetchMock as unknown as typeof fetch);
    const conv = await simularInbound(admin, {
      inbox_id: world.inboxId,
      phone_e164: "+5511999003344",
      body: "stub path",
    });
    const out = await postMensagem(sessionOf(world, "vendedor"), conv.id, {
      content: "ainda stub",
    });
    expect(out.delivery_status).toBe("sent");
    expect(out.simulated).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("vault never returns plaintext on GET after live save", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      phone_number_id: "pnid_v2",
      business_account_id: "waba_v2",
      api_token: "super-secret-token",
      api_secret: "super-secret-secret",
      webhook_verify_token: "verify",
      connection_status: "live",
    });
    const ch = await getChannel(admin, world.inboxId);
    expect(JSON.stringify(ch)).not.toContain("super-secret");
    const row = await db.channelWhatsapp.findFirstOrThrow({
      where: { inboxId: world.inboxId },
    });
    const opened = await channelCredentialsVault.open(row.secretsCiphertext!);
    expect(opened.api_token).toBe("super-secret-token");
  });
});
