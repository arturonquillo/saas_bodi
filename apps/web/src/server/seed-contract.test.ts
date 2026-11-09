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
    expect(byCode["LINGUICA-CX"]?.qtdMinAtacado).toBe(5);
    expect(byCode["OCULTO-INTERNO"]?.visivelLoja).toBe(false);
    expect(byCode["ESGOTADO-VITRINE"]?.visivelLoja).toBe(true);

    const balPicanha = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: byCode["PICANHA-KG"]!.id },
    });
    const balEsg = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: byCode["ESGOTADO-VITRINE"]!.id },
    });
    expect(balPicanha.onHand).toBe(40);
    expect(balPicanha.reserved).toBe(5);
    expect(availableQty(balEsg.onHand, balEsg.reserved)).toBe(0);

    const intents = await db.whatsappThread.findMany({ where: { tenantId: tenant.id } });
    expect(intents.map((t) => t.intent)).toEqual(
      expect.arrayContaining(["cadastro", "orcamento", "info_empresa"]),
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
