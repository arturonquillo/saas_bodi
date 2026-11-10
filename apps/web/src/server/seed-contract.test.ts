import { describe, expect, it } from "vitest";
import { availableQty } from "@saas-frota/shared";
import { db } from "./db";

describe("seed contract casa-dos-frios", () => {
  it("matches docs/architecture/seed.md + design tokens when tenant exists", async () => {
    const tenant = await db.tenant.findUnique({
      where: { slug: "casa-dos-frios" },
      include: { theme: true },
    });
    if (!tenant) return;

    expect(tenant.nomeFantasia).toBe("Casa dos Frios");
    expect(tenant.canaisAviso).toBe("whatsapp");
    expect(tenant.lojaModo).toBe("pedido_direto");
    expect(tenant.theme?.marca).toBe("Casa dos Frios");
    expect(tenant.theme?.primary).toBe("#7A1F1F");
    expect(tenant.theme?.accent).toBe("#1F5C6B");
    expect(tenant.theme?.background).toBe("#EEF2F4");

    for (const email of [
      "admin@casadosfrios.local",
      "vendedor@casadosfrios.local",
      "cliente@mercadoexemplo.local",
      "prospecto@novaloja.local",
    ]) {
      expect(await db.user.findUnique({ where: { email } })).toBeTruthy();
    }

    const skus = await db.sku.findMany({ where: { tenantId: tenant.id } });
    const byCode = Object.fromEntries(skus.map((s) => [s.codigo, s]));
    expect(byCode["PICANHA-KG"]).toBeTruthy();
    expect(byCode["PICANHA-KG"]?.descontoMaxPct).toBe(10);
    expect(byCode["PICANHA-KG"]?.unidade).toBe("kg");
    expect(byCode["LINGUICA-CX"]?.qtdMinAtacado).toBe(5);
    expect(byCode["LINGUICA-CX"]?.unidade).toBe("cx");
    expect(byCode["OCULTO-INTERNO"]?.visivelLoja).toBe(false);
    expect(byCode["ESGOTADO-VITRINE"]?.visivelLoja).toBe(true);
    expect(byCode["INATIVO-DEMO"]?.ativo).toBe(false);

    const balPicanha = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: byCode["PICANHA-KG"]!.id },
    });
    const balEsg = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: byCode["ESGOTADO-VITRINE"]!.id },
    });
    expect(balPicanha.onHand).toBe(40);
    expect(balPicanha.reserved).toBe(5);
    expect(availableQty(balEsg.onHand, balEsg.reserved)).toBe(0);

    const opening = await db.inventoryMovement.findFirst({
      where: {
        tenantId: tenant.id,
        skuId: byCode["PICANHA-KG"]!.id,
        type: "adjust",
        reason: "estoque_inicial",
      },
    });
    expect(opening).toBeTruthy();

    const inbox = await db.inbox.findFirst({
      where: { tenantId: tenant.id, channelType: "whatsapp" },
      include: { channelWhatsapp: true },
    });
    expect(inbox).toBeTruthy();
    expect(inbox?.channelWhatsapp?.connectionStatus).toMatch(/ready_stub|credentials_saved/);
    expect(inbox?.channelWhatsapp?.secretsCiphertext).toBeTruthy();

    const labels = await db.label.findMany({ where: { tenantId: tenant.id, system: true } });
    expect(labels.map((l) => l.title)).toEqual(
      expect.arrayContaining([
        "intent:cadastro",
        "intent:orcamento",
        "intent:info_empresa",
        "intent:outro",
      ]),
    );

    const conversations = await db.conversation.findMany({
      where: { tenantId: tenant.id },
      include: { labels: { include: { label: true } } },
    });
    const intentTitles = conversations.flatMap((c) => c.labels.map((l) => l.label.title));
    expect(intentTitles).toEqual(
      expect.arrayContaining(["intent:cadastro", "intent:orcamento", "intent:info_empresa"]),
    );
    expect(await db.contact.count({ where: { tenantId: tenant.id } })).toBeGreaterThanOrEqual(3);
    expect(await db.company.count({ where: { tenantId: tenant.id } })).toBeGreaterThanOrEqual(1);
    expect(await db.cannedResponse.count({ where: { tenantId: tenant.id } })).toBeGreaterThanOrEqual(
      1,
    );

    const orc = await db.orcamento.findFirst({
      where: { tenantId: tenant.id, status: "enviado" },
    });
    expect(orc?.validoAte).toBeTruthy();

    const pedido = await db.pedidoVenda.findFirst({
      where: { tenantId: tenant.id, status: "em_separacao" },
    });
    expect(pedido).toBeTruthy();

    const outbox = await db.notificationOutbox.findFirst({
      where: { tenantId: tenant.id, status: "enviado", channel: "whatsapp" },
    });
    expect(outbox).toBeTruthy();
    expect(outbox?.payloadJson).not.toMatch(/11222333000181/);
  });
});
