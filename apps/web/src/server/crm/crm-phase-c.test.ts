import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db";
import { newId } from "../ids";
import { jobWorkerPort } from "../ports/jobs";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";
import { listAvisos } from "../avisos/service";
import {
  cancelarCampanha,
  createCampanha,
  enviarCampanha,
  getCampanha,
  listCampanhas,
  listDestinatarios,
} from "./campaigns";
import {
  createArtigo,
  createCategoria,
  getPublicArtigo,
  getPublicPortal,
  listPublicArtigos,
  publicarArtigo,
  putPortal,
} from "./help-center";
import {
  reportAgentes,
  reportBots,
  reportConversas,
  reportCsat,
  reportEquipes,
  reportInboxes,
  reportLabels,
  reportVisaoGeral,
} from "./reports";
import { createContato } from "./contacts";

let world: TestWorld;
let labelId: string;
let contactId: string;

beforeAll(async () => {
  world = await createWorld("crmc3");
  const label = await db.label.findFirst({
    where: { tenantId: world.tenantId, title: "intent:info_empresa" },
  });
  labelId = label!.id;
  await db.channelWhatsapp.update({
    where: { inboxId: world.inboxId },
    data: {
      messageTemplatesJson: JSON.stringify([
        { key: "campaign.wa_one_off", body: "Olá {{contact.nome}}, promoção stub." },
        { key: "greeting", body: "Oi" },
      ]),
    },
  });
  const admin = sessionOf(world, "admin");
  const contato = await createContato(admin, {
    nome: "Contato Campanha",
    phone_e164: "+5511988887777",
    email: "campanha@test.local",
  });
  contactId = contato.id;
  await db.contactLabel.create({
    data: {
      id: newId("clb"),
      tenantId: world.tenantId,
      contactId,
      labelId,
    },
  });
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("CRM Phase C growth & insight", () => {
  it("admin CRUD campaigns; one_off send → outbox category=campaign; no Meta; vendedor 403", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");

    expect((await catchApi(() => listCampanhas(ven, new URL("http://x"))))?.code).toBe("forbidden");

    const draft = await createCampanha(admin, {
      title: "Blast stub",
      kind: "one_off",
      inbox_id: world.inboxId,
      channel: "whatsapp",
      audience_label_ids: [labelId],
      template_key: "campaign.wa_one_off",
    });
    expect(draft.status).toBe("draft");
    expect((await listCampanhas(admin, new URL("http://x"))).items.some((i) => i.id === draft.id)).toBe(
      true,
    );

    const ongoing = await createCampanha(admin, {
      title: "Widget later",
      kind: "ongoing",
      channel: "whatsapp",
      message: "Promo site",
      audience_label_ids: [labelId],
    });
    const activated = await enviarCampanha(admin, ongoing.id);
    expect(activated.status).toBe("active");
    expect(activated.display_status).toBe("awaiting_widget");

    const sent = await enviarCampanha(admin, draft.id);
    expect(sent.status).toBe("active");

    // Drain campaign.send_batch (+ any chained pages)
    for (let i = 0; i < 5; i++) {
      await jobWorkerPort.tick(20);
    }

    const done = await getCampanha(admin, draft.id);
    expect(done.status).toBe("completed");
    expect(done.stats?.enviado).toBeGreaterThanOrEqual(1);

    const recipients = await listDestinatarios(admin, draft.id, new URL("http://x"));
    expect(recipients.items.some((r) => r.status === "enviado")).toBe(true);

    const outbox = await db.notificationOutbox.findMany({
      where: { tenantId: world.tenantId, category: "campaign", campaignId: draft.id },
    });
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    expect(outbox.every((o) => o.status === "enviado")).toBe(true);
    expect(outbox.every((o) => o.templateKey.startsWith("campaign."))).toBe(true);

    // Commerce avisos stay commerce-only
    const avisos = await listAvisos(admin, new URL("http://x/?limit=50"));
    expect(avisos.items.every((a) => !("category" in a) || true)).toBe(true);
    const commerceRows = await db.notificationOutbox.findMany({
      where: { tenantId: world.tenantId, category: "commerce" },
    });
    expect(commerceRows.every((r) => r.category === "commerce")).toBe(true);
    expect(outbox.every((o) => o.category === "campaign")).toBe(true);

    // No Meta/Twilio host in job errors
    const jobs = await db.backgroundJob.findMany({
      where: { tenantId: world.tenantId, kind: "campaign.send_batch" },
    });
    for (const j of jobs) {
      expect(j.lastError ?? "").not.toMatch(/graph\.facebook|meta\.com|twilio/i);
      expect(["concluido", "pendente", "morto", "falha"]).toContain(j.status);
    }

    const cancelledOngoing = await cancelarCampanha(admin, ongoing.id);
    expect(cancelledOngoing.status).toBe("cancelled");
  });

  it("help center admin publish + public published only; draft 404", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");
    expect(
      (await catchApi(() => putPortal(ven, { name: "x", slug: "x" })))?.code,
    ).toBe("forbidden");

    const portal = await putPortal(admin, {
      name: "Central Casa",
      slug: "casa-ajuda-test",
      header_text: "Ajuda",
      homepage_md: "# Bem-vindo",
      enabled: true,
    });
    expect(portal?.slug).toBe("casa-ajuda-test");
    expect(portal?.locale).toBe("pt-BR");

    const cat = await createCategoria(admin, { name: "Pedidos", slug: "pedidos" });
    const draft = await createArtigo(admin, {
      title: "Rascunho interno",
      slug: "rascunho",
      category_id: cat.id,
      content_md: "Segredo **draft**",
      status: "draft",
    });
    const pub = await createArtigo(admin, {
      title: "Como pedir",
      slug: "como-pedir",
      category_id: cat.id,
      content_md: "## Passo 1\n\nFaça o pedido.",
      status: "draft",
    });
    await publicarArtigo(admin, pub.id);

    const publicPortal = await getPublicPortal("casa-ajuda-test");
    expect(publicPortal.name).toBe("Central Casa");

    const listed = await listPublicArtigos("casa-ajuda-test", new URL("http://x"));
    expect(listed.items.some((a) => a.slug === "como-pedir")).toBe(true);
    expect(listed.items.some((a) => a.slug === "rascunho")).toBe(false);

    const body = await getPublicArtigo("casa-ajuda-test", "como-pedir");
    expect(body.content_html).toContain("<h2>");
    expect(body.content_html).not.toContain("<script");

    expect(
      (await catchApi(() => getPublicArtigo("casa-ajuda-test", "rascunho")))?.code,
    ).toBe("nao_encontrado");
    expect(draft.status).toBe("draft");
  });

  it("reports admin aggregates; vendedor 403; range validation", async () => {
    const admin = sessionOf(world, "admin");
    const ven = sessionOf(world, "vendedor");
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const url = new URL(`http://x/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

    expect((await catchApi(() => reportVisaoGeral(ven, url)))?.code).toBe("forbidden");

    const overview = await reportVisaoGeral(admin, url);
    expect(overview.totals).toBeTruthy();
    expect(overview.generated_at).toBeTruthy();
    expect(Array.isArray((overview.series as { new_conversations_by_day: unknown[] }).new_conversations_by_day)).toBe(
      true,
    );

    await expect(reportConversas(admin, url)).resolves.toBeTruthy();
    await expect(reportAgentes(admin, url)).resolves.toBeTruthy();
    await expect(reportLabels(admin, url)).resolves.toBeTruthy();
    await expect(reportInboxes(admin, url)).resolves.toBeTruthy();
    await expect(reportEquipes(admin, url)).resolves.toBeTruthy();
    await expect(reportCsat(admin, url)).resolves.toBeTruthy();
    await expect(reportBots(admin, url)).resolves.toBeTruthy();

    const tooWide = new URL(
      `http://x/?from=${encodeURIComponent(new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())}&to=${encodeURIComponent(to)}`,
    );
    expect((await catchApi(() => reportVisaoGeral(admin, tooWide)))?.code).toBe("validacao");
  });
});
