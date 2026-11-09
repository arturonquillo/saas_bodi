import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";
import {
  createInbox,
  getChannel,
  putChannel,
  rotateChannelToken,
  simulateChannelInbound,
} from "./inboxes";
import {
  bootstrapWidget,
  createWidgetSession,
  listWidgetCampaigns,
  listWidgetMessages,
  postWidgetMessage,
  submitPreChat,
  widgetSessionCookie,
} from "./widget";
import { postCrmClientMessage } from "./crm-client";
import {
  createEmailTemplate,
  listEmailTemplates,
} from "./email-templates";
import { createPushSubscription, getVapidPublic } from "./push";
import { createCampanha, enviarCampanha } from "./campaigns";
import { postMensagem, simularInbound } from "./conversations";
import { ApiError } from "../http/respond";
import { hashToken } from "./tokens";

let world: TestWorld;
let widgetInboxId: string;
let websiteToken: string;
let apiInboxId: string;
let apiToken: string;

function widgetReq(sessionToken: string, origin = "http://localhost:3000"): Request {
  return new Request("http://localhost/api/loja/widget", {
    headers: {
      "x-widget-session": sessionToken,
      origin,
      cookie: widgetSessionCookie(sessionToken),
    },
  });
}

beforeAll(async () => {
  world = await createWorld("crmd4");
  const admin = sessionOf(world, "admin");

  const widget = await createInbox(admin, {
    name: "Loja chat test",
    channel_type: "web_widget",
  });
  widgetInboxId = widget.id;
  const ch = await getChannel(admin, widgetInboxId);
  websiteToken = (ch as { website_token: string }).website_token;
  await putChannel(admin, widgetInboxId, {
    allowed_origins: ["http://localhost:3000"],
    connection_status: "ready_stub",
  });

  const apiBox = await createInbox(admin, { name: "API stub", channel_type: "api" });
  apiInboxId = apiBox.id;
  const rotated = await rotateChannelToken(admin, apiInboxId);
  apiToken = (rotated as { api_access_token: string }).api_access_token;
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("CRM Phase D omnichannel + Loja widget", () => {
  it("admin creates all channel types ≤ ready_stub; live rejected; no provider HTTP", async () => {
    const admin = sessionOf(world, "admin");
    const types = [
      "email",
      "facebook",
      "instagram",
      "sms",
      "telegram",
    ] as const;
    for (const channel_type of types) {
      const box = await createInbox(admin, { name: `Stub ${channel_type}`, channel_type });
      expect(box.channel_type).toBe(channel_type);
      const live = await catchApi(() =>
        putChannel(admin, box.id, { connection_status: "live" }),
      );
      expect(live?.code).toBe("nao_implementado");
      await putChannel(admin, box.id, { connection_status: "ready_stub" });
      const ch = await getChannel(admin, box.id);
      expect((ch as { connection_status: string }).connection_status).toBe("ready_stub");
      expect(JSON.stringify(ch)).not.toMatch(/graph\.facebook|twilio\.com|smtp\.|meta\.com/i);
    }
  });

  it("Loja widget bootstrap → session → pre-chat → messages; agent reply path", async () => {
    const admin = sessionOf(world, "admin");
    const boot = await bootstrapWidget({
      websiteToken,
      origin: "http://localhost:3000",
    });
    expect(boot.inbox_id).toBe(widgetInboxId);
    expect(boot.pre_chat_fields.length).toBeGreaterThan(0);

    const sess = await createWidgetSession({
      websiteToken,
      origin: "http://localhost:3000",
    });
    expect(sess.session_token).toBeTruthy();

    const req = widgetReq(sess.session_token);
    const missing = await catchApi(() =>
      postWidgetMessage(req, { content: "oi antes do prechat" }),
    );
    expect(missing?.code).toBe("validacao");

    await submitPreChat(req, {
      fields: { nome: "Visitante Teste", email: "visitante@test.local" },
    });

    const msg = await postWidgetMessage(req, { content: "Quero orçamento de picanha" });
    expect(msg.message_type).toBe("incoming");
    expect(msg.content).toContain("picanha");

    const listed = await listWidgetMessages(req, new URL("http://x"));
    expect(listed.items.some((m) => m.id === msg.id)).toBe(true);

    const convId = (
      await db.widgetSession.findFirstOrThrow({
        where: { sessionTokenHash: hashToken(sess.session_token) },
      })
    ).conversationId!;
    expect(convId).toBeTruthy();

    const reply = await postMensagem(admin, convId, {
      content: "Claro! Segue tabela.",
      content_type: "text",
    });
    expect(reply).toBeTruthy();

    const after = await listWidgetMessages(req, new URL("http://x"));
    expect(after.items.some((m) => m.message_type === "outgoing")).toBe(true);

    // Interactive OK on widget
    await postMensagem(admin, convId, {
      content: JSON.stringify({ items: [{ title: "Sim" }, { title: "Não" }] }),
      content_type: "input_select",
    });

    // Interactive rejected on WA
    const waConv = await simularInbound(admin, {
      phone_e164: "+5511999001122",
      body: "wa",
    });
    const bad = await catchApi(() =>
      postMensagem(admin, waConv.id, {
        content: "{}",
        content_type: "cards",
      }),
    );
    expect(bad?.code).toBe("validacao");
  });

  it("ongoing campaign becomes ready when widget ready_stub; bootstrap serves it", async () => {
    const admin = sessionOf(world, "admin");
    const camp = await createCampanha(admin, {
      title: "Banner D",
      kind: "ongoing",
      inbox_id: widgetInboxId,
      channel: "whatsapp",
      message: "Promo widget",
      audience_label_ids: [],
    });
    const activated = await enviarCampanha(admin, camp.id);
    expect(activated.status).toBe("active");
    expect(activated.display_status).toBe("ready");

    await bootstrapWidget({ websiteToken, origin: "http://localhost:3000" });
    const camps = await listWidgetCampaigns(
      new Request("http://x"),
      websiteToken,
    );
    expect(camps.items.some((c) => c.id === camp.id)).toBe(true);
  });

  it("API channel Bearer creates message; invalid token 401", async () => {
    const badReq = new Request("http://x", {
      headers: { authorization: "Bearer totally-wrong" },
    });
    const err = await catchApi(() =>
      postCrmClientMessage(badReq, { source_id: "ext-1", content: "hi" }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("unauthenticated");

    const req = new Request("http://x", {
      headers: { authorization: `Bearer ${apiToken}` },
    });
    const created = await postCrmClientMessage(req, {
      source_id: "client-user-1",
      content: "Pedido via API",
      content_type: "form",
      contact: { nome: "API User", email: "api@test.local" },
    });
    expect(created.message.content).toBe("Pedido via API");
    expect(created.message.content_type).toBe("form");

    const conv = await db.conversation.findFirst({
      where: { id: created.conversation_id, tenantId: world.tenantId },
      include: { inbox: true },
    });
    expect(conv?.inboxId).toBe(apiInboxId);
    expect(conv?.inbox.channelType).toBe("api");
  });

  it("email templates CRUD admin; push vapid 404 without keys; rotate website_token", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");

    expect((await catchApi(() => listEmailTemplates(ven)))?.code).toBe("forbidden");
    const tpl = await createEmailTemplate(admin, {
      name: "Stub layout",
      subject_template: "Olá",
      body_html_template: "<p>Oi</p><script>evil()</script>",
    });
    expect(tpl.body_html_template).not.toContain("<script>");
    expect((await listEmailTemplates(admin)).items.some((t) => t.id === tpl.id)).toBe(true);

    const vapid = await catchApi(() => getVapidPublic(admin));
    expect(vapid?.code).toBe("nao_encontrado");

    const sub = await createPushSubscription(admin, {
      endpoint: "https://example.test/push/abc",
      keys: { p256dh: "x", auth: "y" },
    });
    expect(sub.id).toBeTruthy();

    const before = websiteToken;
    const rotated = await rotateChannelToken(admin, widgetInboxId);
    expect((rotated as { website_token: string }).website_token).toBeTruthy();
    expect((rotated as { website_token: string }).website_token).not.toBe(before);
    websiteToken = (rotated as { website_token: string }).website_token;

    // simulate email inbound stub
    const emailBox = await createInbox(admin, { name: "Email sim", channel_type: "email" });
    const sim = await simulateChannelInbound(admin, emailBox.id, {
      email: "cliente@ex.com",
      body: "Segue NF",
      contact_nome: "Cliente Email",
    });
    expect(sim.conversation_id).toBeTruthy();
  });
});
