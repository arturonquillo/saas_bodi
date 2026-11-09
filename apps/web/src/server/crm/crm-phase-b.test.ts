import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { jobEnqueuePort, jobWorkerPort } from "../ports/jobs";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";
import { createAutomacao, listAutomacoes, testarAutomacao } from "./automations";
import { createMacro, executarMacro, listMacros } from "./macros";
import { createAtributo, listAtributos, patchContatoAtributos } from "./attributes";
import { createBot, putBotInboxes } from "./bots";
import { createWebhook, rotacionarSegredoWebhook } from "./webhooks";
import { putHorarios, getHorariosEstado } from "./hours";
import { putPoliticaAtribuicao } from "./assignment";
import { createFiltro, listFiltros } from "./filters";
import { mesclarContatos } from "./merge-import";
import { getPublicCsat, submitPublicCsat } from "./csat";
import { patchConversa, postMensagem, simularInbound } from "./conversations";
import { patchInbox } from "./inboxes";
import { createContato } from "./contacts";

let world: TestWorld;

beforeAll(async () => {
  world = await createWorld("crmb2");
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("CRM Phase B operator power", () => {
  it("admin CRUD automation/macro/attribute/bot/webhook/hours/assignment; vendedor macro+filter; RBAC denials", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");

    const auto = await createAutomacao(admin, {
      name: "Resolve high",
      event_name: "conversation_status_changed",
      conditions: {
        operator: "and",
        values: [{ attribute_key: "status", filter_operator: "equal", values: ["resolved"] }],
      },
      actions: [{ action_name: "add_private_note", action_params: { content: "auto" } }],
      active: true,
    });
    expect(auto.id).toBeTruthy();
    expect((await listAutomacoes(admin)).items.some((i) => i.id === auto.id)).toBe(true);
    expect((await catchApi(() => listAutomacoes(ven)))?.code).toBe("forbidden");

    const dry = await testarAutomacao(admin, auto.id, { status: "resolved" });
    expect(dry.matched).toBe(true);
    expect(dry.dry_run).toBe(true);

    const pubMacro = await createMacro(admin, {
      name: "Saudação",
      visibility: "public",
      actions: [{ action_name: "send_message", action_params: { content: "Oi cliente" } }],
    });
    expect((await catchApi(() => createMacro(ven, { name: "x", visibility: "public" })))?.code).toBe(
      "forbidden",
    );
    const priv = await createMacro(ven, {
      name: "Minha macro",
      visibility: "private",
      actions: [{ action_name: "mute", action_params: {} }],
    });
    const macros = await listMacros(ven);
    expect(macros.items.some((m) => m.id === pubMacro.id)).toBe(true);
    expect(macros.items.some((m) => m.id === priv.id)).toBe(true);

    const attr = await createAtributo(admin, {
      attribute_model: "contact",
      attribute_display_type: "text",
      attribute_key: "origem",
      attribute_display_name: "Origem",
    });
    expect((await listAtributos(ven, "contact")).items.some((a) => a.id === attr.id)).toBe(true);
    expect(
      (await catchApi(() =>
        createAtributo(ven, {
          attribute_model: "contact",
          attribute_display_type: "text",
          attribute_key: "x",
          attribute_display_name: "X",
        }),
      ))?.code,
    ).toBe("forbidden");

    const botDeny = await catchApi(() =>
      createBot(admin, { name: "Bot", outgoing_url: "https://127.0.0.1/bot" }),
    );
    expect(botDeny?.code === "forbidden" || botDeny?.code === "validacao").toBe(true);

    const bot = await createBot(admin, {
      name: "Safe Bot",
      outgoing_url: "https://example.com/bot-hook",
    });
    expect(bot.token_revealed).toBe(true);
    await putBotInboxes(admin, bot.id, [world.inboxId]);

    const whDeny = await catchApi(() =>
      createWebhook(admin, { url: "https://192.168.0.1/hook", subscriptions: ["message_created"] }),
    );
    expect(whDeny?.code === "forbidden" || whDeny?.code === "validacao").toBe(true);

    const wh = await createWebhook(admin, {
      url: "https://example.com/account-hook",
      subscriptions: ["conversation_created", "message_created"],
    });
    expect(wh.id).toBeTruthy();
    const secret = await rotacionarSegredoWebhook(admin);
    expect(secret.webhook_signing_secret.length).toBeGreaterThan(16);

    await putHorarios(admin, world.inboxId, {
      timezone: "America/Sao_Paulo",
      hours: [
        { day_of_week: 0, closed_all_day: true },
        { day_of_week: 1, open_all_day: true },
        { day_of_week: 2, open_all_day: true },
        { day_of_week: 3, open_all_day: true },
        { day_of_week: 4, open_all_day: true },
        { day_of_week: 5, open_all_day: true },
        { day_of_week: 6, closed_all_day: true },
      ],
    });
    const estado = await getHorariosEstado(ven, world.inboxId);
    expect(typeof estado.open_now).toBe("boolean");

    await putPoliticaAtribuicao(admin, world.inboxId, { kind: "round_robin", enabled: true });
    expect((await catchApi(() => putPoliticaAtribuicao(ven, world.inboxId, { enabled: true })))?.code).toBe(
      "forbidden",
    );

    const filtro = await createFiltro(ven, {
      name: "Minhas abertas",
      filter_type: "conversation",
      query: { status: "open" },
    });
    expect((await listFiltros(ven)).items.some((f) => f.id === filtro.id)).toBe(true);

    const conv = await simularInbound(admin, {
      phone_e164: "+5511977110001",
      body: "macro exec",
    });
    const exec = await executarMacro(ven, pubMacro.id, [conv.id]);
    expect(exec.results[0]?.applied).toBeGreaterThanOrEqual(1);
  });

  it("resolve + CSAT → outbox category=csat + public token submit", async () => {
    const admin = sessionOf(world, "admin");
    await patchInbox(admin, world.inboxId, { csat_enabled: true });
    const conv = await simularInbound(admin, {
      phone_e164: "+5511977110002",
      body: "csat please",
    });
    await patchConversa(admin, conv.id, { status: "resolved" });

    // Process csat.deliver job
    let ticks = 0;
    while (ticks < 5) {
      const n = await jobWorkerPort.tick(20);
      if (n === 0) break;
      ticks += 1;
    }

    const updated = await db.conversation.findUniqueOrThrow({ where: { id: conv.id } });
    expect(updated.csatToken).toBeTruthy();
    expect(updated.csatSentAt).toBeTruthy();

    const outbox = await db.notificationOutbox.findFirst({
      where: { tenantId: world.tenantId, conversationId: conv.id, category: "csat" },
    });
    expect(outbox).toBeTruthy();
    expect(outbox?.templateKey).toBe("crm.csat_survey");
    expect(outbox?.status).toBe("enviado");

    const publicPayload = await getPublicCsat(updated.csatToken!);
    expect(publicPayload.already_submitted).toBe(false);
    const submitted = await submitPublicCsat(updated.csatToken!, {
      rating: 5,
      feedback_message: "Ótimo",
    });
    expect(submitted.rating).toBe(5);
    const row = await db.csatResponse.findUnique({ where: { conversationId: conv.id } });
    expect(row?.rating).toBe(5);
    expect((await catchApi(() => submitPublicCsat(updated.csatToken!, { rating: 4 })))?.code).toBe(
      "validacao",
    );
  });

  it("SSRF deny for bot/webhook private URLs", async () => {
    const admin = sessionOf(world, "admin");
    const bot = await catchApi(() =>
      createBot(admin, { name: "bad", outgoing_url: "http://169.254.169.254/latest" }),
    );
    expect(bot?.code === "validacao" || bot?.code === "forbidden").toBe(true);
    const wh = await catchApi(() =>
      createWebhook(admin, { url: "https://10.0.0.5/hook", subscriptions: ["message_created"] }),
    );
    expect(wh?.code === "validacao" || wh?.code === "forbidden").toBe(true);
  });

  it("round-robin assigns only online members", async () => {
    const admin = sessionOf(world, "admin");
    await patchInbox(admin, world.inboxId, { allow_auto_assign: true });
    await putPoliticaAtribuicao(admin, world.inboxId, { kind: "round_robin", enabled: true });

    await db.user.update({
      where: { id: world.users.admin },
      data: { availability: "offline" },
    });
    await db.user.update({
      where: { id: world.users.vendedor },
      data: { availability: "online" },
    });

    const conv = await simularInbound(admin, {
      phone_e164: "+5511977110003",
      body: "rr",
    });
    await jobEnqueuePort.enqueue({
      tenantId: world.tenantId,
      kind: "assignment.round_robin",
      payload: {
        tenant_id: world.tenantId,
        conversation_id: conv.id,
        inbox_id: world.inboxId,
      },
    });
    await jobWorkerPort.tick(20);

    const updated = await db.conversation.findUniqueOrThrow({ where: { id: conv.id } });
    expect(updated.assigneeUserId).toBe(world.users.vendedor);

    // busy/offline skipped — only online
    await db.user.update({
      where: { id: world.users.vendedor },
      data: { availability: "busy" },
    });
    await db.user.update({
      where: { id: world.users.admin },
      data: { availability: "offline" },
    });
    const conv2 = await simularInbound(admin, {
      phone_e164: "+5511977110004",
      body: "rr2",
    });
    await jobEnqueuePort.enqueue({
      tenantId: world.tenantId,
      kind: "assignment.round_robin",
      payload: {
        tenant_id: world.tenantId,
        conversation_id: conv2.id,
        inbox_id: world.inboxId,
      },
    });
    await jobWorkerPort.tick(20);
    const updated2 = await db.conversation.findUniqueOrThrow({ where: { id: conv2.id } });
    expect(updated2.assigneeUserId).toBeNull();
  });

  it("contact merge preserves cliente_id on survivor", async () => {
    const admin = sessionOf(world, "admin");
    const survivor = await createContato(admin, {
      nome: "Survivor",
      phone_e164: "+5511977110010",
    });
    const loser = await createContato(admin, {
      nome: "Loser",
      phone_e164: "+5511977110011",
    });
    await db.contact.update({
      where: { id: loser.id },
      data: { clienteId: world.clienteId },
    });
    const merged = await mesclarContatos(admin, {
      survivor_id: survivor.id,
      loser_id: loser.id,
    });
    expect(merged.cliente_id).toBe(world.clienteId);
    const loserRow = await db.contact.findUniqueOrThrow({ where: { id: loser.id } });
    expect(loserRow.mergedIntoId).toBe(survivor.id);
    expect(loserRow.clienteId).toBeNull();
  });

  it("job tick runs automation/webhook/csat kinds without Meta", async () => {
    const kinds = [
      "automation.run",
      "webhook.deliver",
      "bot.deliver",
      "csat.deliver",
      "contact.import_csv",
      "assignment.round_robin",
      "notification.email_stub",
    ] as const;
    const ids: string[] = [];
    for (const kind of kinds) {
      const { id } = await jobEnqueuePort.enqueue({
        tenantId: world.tenantId,
        kind,
        payload: {
          tenant_id: world.tenantId,
          rule_id: "missing",
          webhook_id: "missing",
          conversation_id: "missing",
          batch_id: "missing",
        },
      });
      ids.push(id);
    }
    const n = await jobWorkerPort.tick(20);
    expect(n).toBeGreaterThanOrEqual(kinds.length);
    const rows = await db.backgroundJob.findMany({ where: { id: { in: ids } } });
    // Missing entities → no-op conclude, or webhook.deliver may fail/retry without Meta
    for (const row of rows) {
      expect(["concluido", "pendente", "morto", "falha"]).toContain(row.status);
      if (row.lastError) {
        expect(row.lastError.toLowerCase()).not.toContain("graph.facebook");
        expect(row.lastError.toLowerCase()).not.toContain("meta");
      }
    }
  });

  it("mentions create AgentNotification; signature appended on outgoing", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");
    await db.user.update({
      where: { id: world.users.vendedor },
      data: { signature: "-- Equipe Vendas" },
    });
    const conv = await simularInbound(admin, {
      phone_e164: "+5511977110020",
      body: "mention me",
    });
    const msg = await postMensagem(ven, conv.id, {
      content: `Olá @[user_id:${world.users.admin}]`,
    });
    expect(msg.content).toContain("-- Equipe Vendas");
    const ntf = await db.agentNotification.findFirst({
      where: {
        tenantId: world.tenantId,
        userId: world.users.admin,
        conversationId: conv.id,
        type: "mention",
      },
    });
    expect(ntf).toBeTruthy();
  });

  it("vendedor can patch contact attributes when defined", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");
    await createAtributo(admin, {
      attribute_model: "contact",
      attribute_display_type: "text",
      attribute_key: "canal",
      attribute_display_name: "Canal",
    }).catch(() => undefined);
    const c = await createContato(ven, { nome: "Attr", phone_e164: "+5511977110030" });
    const patched = await patchContatoAtributos(ven, c.id, { canal: "whatsapp" });
    expect(patched.custom_attributes.canal).toBe("whatsapp");
  });
});
