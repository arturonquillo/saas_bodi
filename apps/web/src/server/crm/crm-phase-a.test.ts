import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { channelCredentialsVault } from "../ports/credentials-vault";
import { jobEnqueuePort, jobWorkerPort } from "../ports/jobs";
import { urlEgressGuard } from "../ports/egress";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";
import {
  getConversa,
  listConversas,
  listMensagens,
  patchConversa,
  postMensagem,
  simularInbound,
} from "./conversations";
import { getChannel, listInboxes, putChannel } from "./inboxes";
import { createContato, listContatos } from "./contacts";
import { createLabel, listLabels, postPresence } from "./meta";
import { transitionCadastro } from "../cadastro/service";

let world: TestWorld;
let other: TestWorld;

beforeAll(async () => {
  world = await createWorld("crm");
  other = await createWorld("crmb");
});

afterAll(async () => {
  if (world) await destroyWorld(world);
  if (other) await destroyWorld(other);
});

describe("CRM Phase A core flows", () => {
  it("admin simulates inbound → contact + conversation + incoming message + intent label", async () => {
    const conv = await simularInbound(sessionOf(world, "admin"), {
      phone_e164: "+5511977001122",
      body: "Quero cadastro B2B",
      intent_label: "intent:cadastro",
    });
    expect(conv.status).toBe("open");
    expect(conv.contact?.phone_e164).toBe("+5511977001122");
    expect(conv.labels?.some((l) => l.title === "intent:cadastro")).toBe(true);

    const msgs = await listMensagens(
      sessionOf(world, "admin"),
      conv.id,
      new URL("http://localhost/?limit=20"),
    );
    expect(msgs.items.some((m) => m.message_type === "incoming" && m.simulated)).toBe(true);

    const events = await db.domainEvent.findMany({
      where: { tenantId: world.tenantId, aggregateId: conv.id },
    });
    expect(events.some((e) => e.type === "conversation.created" || e.type === "message.created")).toBe(
      true,
    );
  });

  it("vendedor cannot simulate; can list inboxes they belong to", async () => {
    const err = await catchApi(() =>
      simularInbound(sessionOf(world, "vendedor"), {
        phone_e164: "+5511977000000",
        body: "x",
      }),
    );
    expect(err?.code).toBe("forbidden");

    const inboxes = await listInboxes(sessionOf(world, "vendedor"));
    expect(inboxes.items.some((i) => i.id === world.inboxId)).toBe(true);
  });

  it("agent posts private note and outgoing stub without Meta", async () => {
    const conv = await simularInbound(sessionOf(world, "admin"), {
      phone_e164: "+5511977003344",
      body: "Oi",
    });
    const note = await postMensagem(sessionOf(world, "vendedor"), conv.id, {
      content: "Nota interna",
      private: true,
    });
    expect(note.private).toBe(true);
    expect(note.message_type).toBe("outgoing");
    expect(note.delivery_status).toBe("sent");

    const out = await postMensagem(sessionOf(world, "vendedor"), conv.id, {
      content: "Resposta ao cliente",
    });
    expect(out.private).toBe(false);
    expect(out.delivery_status).toBe("sent");
  });

  it("assign + patch status emits events and notification", async () => {
    const conv = await simularInbound(sessionOf(world, "admin"), {
      phone_e164: "+5511977005566",
      body: "assign me",
    });
    const updated = await patchConversa(sessionOf(world, "admin"), conv.id, {
      assignee_user_id: world.users.vendedor,
      status: "pending",
      priority: "high",
    });
    expect(updated.assignee_user_id).toBe(world.users.vendedor);
    expect(updated.status).toBe("pending");
    expect(updated.priority).toBe("high");

    const ntf = await db.agentNotification.findFirst({
      where: { tenantId: world.tenantId, userId: world.users.vendedor, conversationId: conv.id },
    });
    expect(ntf?.type).toBe("assigned");
  });

  it("tenant isolation: other tenant conversation is 404", async () => {
    const conv = await simularInbound(sessionOf(other, "admin"), {
      phone_e164: "+5511988001122",
      body: "secret",
    });
    const err = await catchApi(() => getConversa(sessionOf(world, "admin"), conv.id));
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("nao_encontrado");
  });

  it("WA channel secrets never returned plaintext; live rejected", async () => {
    const admin = sessionOf(world, "admin");
    await putChannel(admin, world.inboxId, {
      api_token: "super-secret-token",
      api_secret: "super-secret-secret",
      webhook_verify_token: "verify",
      connection_status: "ready_stub",
      phone_e164_display: "+5511988877766",
    });
    const ch = await getChannel(admin, world.inboxId);
    expect(ch.secrets_present).toBe(true);
    expect(ch.api_token).toBe("••••••••");
    expect(JSON.stringify(ch)).not.toContain("super-secret-token");

    const live = await catchApi(() =>
      putChannel(admin, world.inboxId, { connection_status: "live" }),
    );
    expect(live?.code).toBe("validacao");

    const row = await db.channelWhatsapp.findFirstOrThrow({
      where: { inboxId: world.inboxId },
    });
    const opened = await channelCredentialsVault.open(row.secretsCiphertext!);
    expect(opened.api_token).toBe("super-secret-token");
  });

  it("cadastro approve links Company + Contact + Cliente", async () => {
    const approved = await transitionCadastro(
      sessionOf(world, "admin"),
      world.cadastroPendenteId,
      "aprovado",
    );
    expect(approved.status).toBe("aprovado");
    expect(approved.cliente_id).toBeTruthy();

    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: approved.cliente_id! } });
    expect(cliente.companyId).toBeTruthy();
    expect(cliente.primaryContactId).toBeTruthy();

    const contact = await db.contact.findUniqueOrThrow({
      where: { id: cliente.primaryContactId! },
    });
    expect(contact.clienteId).toBe(cliente.id);
    expect(contact.companyId).toBe(cliente.companyId);
  });

  it("contacts + labels CRUD and presence heartbeat", async () => {
    const c = await createContato(sessionOf(world, "vendedor"), {
      nome: "Novo Contato",
      phone_e164: "+5511977112233",
    });
    expect(c.nome).toBe("Novo Contato");
    const page = await listContatos(
      sessionOf(world, "vendedor"),
      new URL("http://localhost/?q=Novo"),
    );
    expect(page.items.some((i) => i.id === c.id)).toBe(true);

    const label = await createLabel(sessionOf(world, "vendedor"), {
      title: `custom-${Date.now()}`,
      color: "#112233",
    });
    const labels = await listLabels(sessionOf(world, "admin"));
    expect(labels.items.some((l) => l.id === label.id)).toBe(true);

    const conv = await listConversas(
      sessionOf(world, "admin"),
      new URL("http://localhost/?limit=5"),
    );
    if (conv.items[0]) {
      await postPresence(sessionOf(world, "vendedor"), {
        conversation_id: conv.items[0].id,
        state: "viewing",
      });
      const presence = await db.agentPresence.findFirst({
        where: {
          tenantId: world.tenantId,
          userId: world.users.vendedor,
          conversationId: conv.items[0].id,
        },
      });
      expect(presence?.state).toBe("viewing");
    }
  });

  it("background job worker ticks Phase A kinds", async () => {
    const { id } = await jobEnqueuePort.enqueue({
      tenantId: world.tenantId,
      kind: "notification.email_stub",
      payload: { hello: true },
    });
    const n = await jobWorkerPort.tick(5);
    expect(n).toBeGreaterThanOrEqual(1);
    const job = await db.backgroundJob.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("concluido");
  });

  it("egress guard blocks private IPs", async () => {
    const err = await catchApi(() => urlEgressGuard.assertSafeHttpsUrl("https://127.0.0.1/hook"));
    expect(err?.code).toBe("forbidden");
    const errHttp = await catchApi(() =>
      urlEgressGuard.assertSafeHttpsUrl("http://example.com/hook"),
    );
    expect(errHttp?.code).toBe("validacao");
  });
});
