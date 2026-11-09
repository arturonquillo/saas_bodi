import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { jobWorkerPort } from "../ports/jobs";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";
import {
  applyConversationSla,
  createSlaPolicy,
  evaluateSla,
  getConversationSla,
  listSlaPolicies,
} from "./sla";
import { putCapacidade } from "./capacity";
import { pickBalancedAssignee, pickRoundRobinAssignee, putPoliticaAtribuicao } from "./assignment";
import { createInbox, patchInbox, putChannel, putRequiredAttributesOnResolve, simulateChannelInbound } from "./inboxes";
import { patchConversa, simularInbound } from "./conversations";
import { reportSla, reportVisaoGeral } from "./reports";
import { captainStatus, sugerirCaptain, aceitarSugestao } from "./captain";
import { listAudit, recordAudit } from "./audit";
import { createPapel } from "./custom-roles";
import { getIntegracao, putIntegracao, testIntegracao } from "./integrations";
import { createAppPainel } from "./dashboard-apps";
import {
  getSaml,
  putSaml,
  testSaml,
  iniciarMfa,
  confirmarMfa,
  getMfaStatus,
} from "./security";
import { patchCsat, submitPublicCsat, deliverCsat } from "./csat";
import { putPortal, putPortalDominio, verificarPortalDominio } from "./help-center";
import { patchUsuario } from "../users/service";
import { notImplemented } from "../http/respond";
import { newId } from "../ids";

let world: TestWorld;

beforeAll(async () => {
  world = await createWorld("crme1");
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("CRM Phase E enterprise & AI", () => {
  it("SLA CRUD/apply/report; vendedor without report_manage → 403", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");

    const policy = await createSlaPolicy(admin, {
      name: "SLA teste",
      frt_seconds: 60,
      nrt_seconds: 120,
      rt_seconds: 600,
      active: true,
    });
    expect(policy.frt_seconds).toBe(60);
    expect((await listSlaPolicies(admin)).items.some((p) => p.id === policy.id)).toBe(true);

    const sim = await simularInbound(admin, {
      phone_e164: "+5511999000011",
      body: "olá sla",
    });
    await applyConversationSla(admin, sim.id, policy.id);
    const timer = await getConversationSla(admin, sim.id);
    expect(timer.timer?.sla_policy_id).toBe(policy.id);
    expect(timer.timer?.frt_due_at).toBeTruthy();

    await evaluateSla({ tenant_id: world.tenantId, conversation_id: sim.id });

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 86400000).toISOString();
    const url = new URL(`http://local/r?from=${from}&to=${to}`);
    const report = await reportSla(admin, url);
    expect(report.totals).toBeTruthy();
    expect((report.totals as { applied: number }).applied).toBeGreaterThanOrEqual(1);

    const denied = await catchApi(() => reportSla(ven, url));
    expect(denied?.code).toBe("forbidden");
    const deniedOverview = await catchApi(() => reportVisaoGeral(ven, url));
    expect(deniedOverview?.code).toBe("forbidden");
  });

  it("balanced + capacity skips at-capacity; round-robin still works", async () => {
    const admin = sessionOf(world, "admin");
    const inbox = await createInbox(admin, {
      name: "Balanced desk",
      channel_type: "whatsapp",
    });
    await patchInbox(admin, inbox.id, { allow_auto_assign: true });
    await db.inboxMember.create({
      data: {
        id: newId("inm"),
        tenantId: world.tenantId,
        inboxId: inbox.id,
        userId: world.users.vendedor,
      },
    });
    await db.user.update({
      where: { id: world.users.admin },
      data: { availability: "online" },
    });
    await db.user.update({
      where: { id: world.users.vendedor },
      data: { availability: "online" },
    });

    await putCapacidade(admin, {
      items: [
        { user_id: world.users.admin, max_open_conversations: 1 },
        { user_id: world.users.vendedor, max_open_conversations: 1 },
      ],
    });

    // Fill admin capacity
    await db.conversation.create({
      data: {
        id: newId("cnv"),
        tenantId: world.tenantId,
        inboxId: inbox.id,
        contactId: (
          await db.contact.create({
            data: {
              id: newId("ct"),
              tenantId: world.tenantId,
              nome: "Cap fill",
              phoneE164: "+5511999000099",
            },
          })
        ).id,
        status: "open",
        assigneeUserId: world.users.admin,
      },
    });

    await putPoliticaAtribuicao(admin, inbox.id, { kind: "balanced", enabled: true });
    const balanced = await pickBalancedAssignee({
      tenantId: world.tenantId,
      inboxId: inbox.id,
    });
    expect(balanced).toBe(world.users.vendedor);

    // Fill vendedor too → null
    await db.conversation.create({
      data: {
        id: newId("cnv"),
        tenantId: world.tenantId,
        inboxId: inbox.id,
        contactId: (
          await db.contact.create({
            data: {
              id: newId("ct"),
              tenantId: world.tenantId,
              nome: "Cap fill 2",
              phoneE164: "+5511999000098",
            },
          })
        ).id,
        status: "open",
        assigneeUserId: world.users.vendedor,
      },
    });
    const none = await pickBalancedAssignee({
      tenantId: world.tenantId,
      inboxId: inbox.id,
    });
    expect(none).toBeNull();

    // RR still works on another inbox
    const rrBox = await createInbox(admin, { name: "RR desk", channel_type: "whatsapp" });
    await patchInbox(admin, rrBox.id, { allow_auto_assign: true });
    await db.inboxMember.create({
      data: {
        id: newId("inm"),
        tenantId: world.tenantId,
        inboxId: rrBox.id,
        userId: world.users.vendedor,
      },
    });
    await putPoliticaAtribuicao(admin, rrBox.id, { kind: "round_robin", enabled: true });
    const rr = await pickRoundRobinAssignee({
      tenantId: world.tenantId,
      inboxId: rrBox.id,
    });
    expect(rr).toBeTruthy();
  });

  it("required attrs 422 then resolve OK", async () => {
    const admin = sessionOf(world, "admin");
    await putRequiredAttributesOnResolve(admin, world.inboxId, { keys: ["pedido_ref"] });
    const sim = await simularInbound(admin, {
      phone_e164: "+5511999000022",
      body: "resolver?",
    });
    const missing = await catchApi(() =>
      patchConversa(admin, sim.id, { status: "resolved" }),
    );
    expect(missing?.code).toBe("validacao");

    await db.conversation.update({
      where: { id: sim.id },
      data: { customAttributesJson: JSON.stringify({ pedido_ref: "P-1" }) },
    });
    const ok = await patchConversa(admin, sim.id, { status: "resolved" });
    expect(ok.status).toBe("resolved");
    await putRequiredAttributesOnResolve(admin, world.inboxId, { keys: [] });
  });

  it("Captain stub suggest; no Meta", async () => {
    const admin = sessionOf(world, "admin");
    delete process.env.CAPTAIN_PROVIDER_ENABLED;
    delete process.env.CAPTAIN_PROVIDER_API_KEY;
    const status = await captainStatus(admin);
    expect(status.provider).toBe("stub");

    const sim = await simularInbound(admin, {
      phone_e164: "+5511999000033",
      body: "preciso de ajuda captain",
    });
    const suggestion = await sugerirCaptain(admin, {
      conversation_id: sim.id,
      mode: "copilot",
    });
    expect(suggestion.provider).toBe("stub");
    expect(JSON.stringify(suggestion)).not.toMatch(/graph\.facebook|meta\.com/i);
    const accepted = await aceitarSugestao(admin, suggestion.id);
    expect(accepted.status).toBe("accepted");
  });

  it("audit list; vendedor 403", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");
    await recordAudit({
      tenantId: world.tenantId,
      actorUserId: admin.userId,
      action: "sla.policy_created",
      aggregateType: "sla_policy",
      aggregateId: "x",
      payload: { name: "x" },
    });
    const list = await listAudit(admin, new URL("http://local/a"));
    expect(list.items.length).toBeGreaterThan(0);
    expect((await catchApi(() => listAudit(ven, new URL("http://local/a"))))?.code).toBe(
      "forbidden",
    );
  });

  it("SAML/MFA config stubs; password login still works", async () => {
    const admin = sessionOf(world, "admin");
    await putSaml(admin, {
      enabled: false,
      idp_entity_id: "urn:idp:fixture",
      idp_sso_url: "https://idp.example.com/sso",
    });
    const saml = await getSaml(admin);
    expect(saml.idp_entity_id).toBe("urn:idp:fixture");
    const tested = await testSaml(admin);
    expect(tested.ok).toBe(true);

    const started = await iniciarMfa(admin);
    expect(started.secret).toBeTruthy();
    const confirmed = await confirmarMfa(admin, { code: "000000" });
    expect(confirmed.ok).toBe(true);
    expect((await getMfaStatus(admin)).enrolled).toBe(true);

    // Vendedor has no MFA — password path remains available (no challenge required).
    const venDevice = await db.mfaDevice.findFirst({
      where: { tenantId: world.tenantId, userId: world.users.vendedor, enabled: true },
    });
    expect(venDevice).toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { id: world.users.vendedor } });
    expect(user.passwordHash).toBeTruthy();
  });

  it("custom role report_manage can read reports", async () => {
    const admin = sessionOf(world, "admin");
    const role = await createPapel(admin, {
      name: "Relatorios E",
      permissions: ["report_manage"],
    });
    await patchUsuario(admin, world.users.vendedor, { custom_role_id: role.id });
    const ven = sessionOf(world, "vendedor", {
      customRoleId: role.id,
      permissionBits: ["report_manage"],
    });
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 86400000).toISOString();
    const url = new URL(`http://local/r?from=${from}&to=${to}`);
    const report = await reportSla(ven, url);
    expect(report.generated_at).toBeTruthy();
  });

  it("integration connected_stub; live rejected", async () => {
    const admin = sessionOf(world, "admin");
    const put = await putIntegracao(admin, "slack", {
      connection_status: "connected_stub",
      metadata: { workspace: "demo" },
      secrets: { bot_token: "xoxb-stub" },
    });
    expect(put.connection_status).toBe("connected_stub");
    const live = await catchApi(() =>
      putIntegracao(admin, "slack", { connection_status: "live" }),
    );
    expect(live?.code).toBe("nao_implementado");
    const ping = await testIntegracao(admin, "slack");
    expect(ping.stub).toBe(true);
    expect(JSON.stringify(await getIntegracao(admin, "slack"))).not.toMatch(/slack\.com\/api/i);
  });

  it("dashboard app egress guard", async () => {
    const admin = sessionOf(world, "admin");
    const blocked = await catchApi(() =>
      createAppPainel(admin, {
        title: "Local",
        url: "https://127.0.0.1/app",
      }),
    );
    expect(blocked?.code).toBe("forbidden");
    const ok = await createAppPainel(admin, {
      title: "Exemplo",
      url: "https://example.com/app",
    });
    expect(ok.url).toContain("example.com");
  });

  it("CSAT review_note; HC domain verify stub; voice ≤ ready_stub + simulate", async () => {
    const admin = sessionOf(world, "admin");
    await patchInbox(admin, world.inboxId, { csat_enabled: true });
    const sim = await simularInbound(admin, {
      phone_e164: "+5511999000044",
      body: "csat path",
    });
    await patchConversa(admin, sim.id, { status: "resolved" });
    await deliverCsat({ tenant_id: world.tenantId, conversation_id: sim.id });
    const conv = await db.conversation.findUniqueOrThrow({ where: { id: sim.id } });
    expect(conv.csatToken).toBeTruthy();
    const submitted = await submitPublicCsat(conv.csatToken!, {
      rating: 5,
      feedback_message: "ótimo",
    });
    const reviewed = await patchCsat(admin, submitted.id, { review_note: "cliente VIP" });
    expect(reviewed.review_note).toBe("cliente VIP");

    await putPortal(admin, {
      name: "Ajuda E",
      slug: `ajuda-${world.slug}`,
      enabled: true,
    });
    await putPortalDominio(admin, { custom_domain: `ajuda-${world.slug}.example.com` });
    process.env.DNS_VERIFY_STUB_SUCCESS = "true";
    const verified = await verificarPortalDominio(admin);
    expect(verified.verified).toBe(true);
    delete process.env.DNS_VERIFY_STUB_SUCCESS;

    const voice = await createInbox(admin, { name: "Voz E", channel_type: "voice" });
    const live = await catchApi(() =>
      putChannel(admin, voice.id, { connection_status: "live" }),
    );
    expect(live?.code).toBe("nao_implementado");
    await putChannel(admin, voice.id, { connection_status: "ready_stub" });
    const simVoice = await simulateChannelInbound(admin, voice.id, {
      body: "chamada simulada",
      source_id: "call:1",
    });
    expect(simVoice.conversation_id).toBeTruthy();
  });

  it("platform 501", async () => {
    const res = notImplemented("platform");
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("nao_implementado");
  });
});
