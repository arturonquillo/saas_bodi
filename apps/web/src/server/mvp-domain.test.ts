import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availableQty } from "@saas-frota/shared";
import { db } from "./db";
import { ApiError } from "./http/respond";
import { lookupCnpj } from "./identity/cnpj-lookup";
import { setCnpjRegistryPortForTests } from "./ports/cnpj-registry";
import { createSaasPedido, getSaasPedido, transitionPedido } from "./sales/pedido";
import { createOrcamento, transitionOrcamento } from "./sales/orcamento";
import { getStoreCatalog, getStoreProduct } from "./catalog/projection";
import { adjustOnHand, toggleVisibilidade } from "./inventory/service";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "./test/world";

let a: TestWorld;
let b: TestWorld;

beforeAll(async () => {
  a = await createWorld("a");
  b = await createWorld("b");
});

afterAll(async () => {
  setCnpjRegistryPortForTests(null);
  if (a) await destroyWorld(a);
  if (b) await destroyWorld(b);
});

describe("store projection", () => {
  it("hides SKUs with visivel_loja=false and computes available from the single ledger", async () => {
    const page = await getStoreCatalog(a.slug, new URL("http://localhost/?limit=50"));
    const codes = page.items.map((i) => i.sku);
    expect(codes).toContain("VIS-a");
    expect(codes).not.toContain("HID-a");
    const vis = page.items.find((i) => i.id === a.skus.visivel)!;
    expect(vis.available).toBe(availableQty(40, 5));
    expect(vis.preco_atacado_centavos).toBe(3990);
    const out = page.items.find((i) => i.id === a.skus.esgotado)!;
    expect(out.available).toBe(0);
    expect(out.sem_estoque).toBe(true);
  });

  it("404s hidden PDP", async () => {
    const err = await catchApi(() => getStoreProduct(a.skus.oculto, a.slug));
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("nao_encontrado");
  });
});

describe("tenant isolation", () => {
  it("cannot read or transition the other tenant's pedido (same 404)", async () => {
    const pedido = await createSaasPedido(sessionOf(b, "vendedor"), {
      cliente_id: b.clienteId,
      linhas: [{ sku_id: b.skus.visivel, qty: 1 }],
    });
    const errGet = await catchApi(() => getSaasPedido(sessionOf(a, "admin"), pedido.id));
    expect(errGet?.code).toBe("nao_encontrado");
    const before = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: b.skus.visivel } });
    const errTx = await catchApi(() =>
      transitionPedido(sessionOf(a, "admin"), pedido.id, "em_separacao"),
    );
    expect(errTx?.code).toBe("nao_encontrado");
    const balance = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: b.skus.visivel } });
    expect(balance.reserved).toBe(before.reserved);
  });

  it("saas create cannot attach another tenant's cliente", async () => {
    const err = await catchApi(() =>
      createSaasPedido(sessionOf(a, "vendedor"), {
        cliente_id: b.clienteId,
        linhas: [{ sku_id: a.skus.visivel, qty: 1 }],
      }),
    );
    expect(err?.code).toBe("nao_encontrado");
  });
});

describe("pedido + stock machine", () => {
  it("freezes atacado price and reserves on create", async () => {
    const before = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    const pedido = await createSaasPedido(sessionOf(a, "vendedor"), {
      cliente_id: a.clienteId,
      linhas: [{ sku_id: a.skus.visivel, qty: 2 }],
    });
    expect(pedido.linhas[0]?.unit_price_centavos).toBe(3990);
    expect(pedido.status).toBe("confirmado");
    const after = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    expect(after.reserved).toBe(before.reserved + 2);
  });

  it("rejects MOQ and insufficient stock", async () => {
    const moq = await catchApi(() =>
      createSaasPedido(sessionOf(a, "vendedor"), {
        cliente_id: a.clienteId,
        linhas: [{ sku_id: a.skus.moq, qty: 2 }],
      }),
    );
    expect(moq?.code).toBe("moq_atacado");
    const stock = await catchApi(() =>
      createSaasPedido(sessionOf(a, "vendedor"), {
        cliente_id: a.clienteId,
        linhas: [{ sku_id: a.skus.esgotado, qty: 1 }],
      }),
    );
    expect(stock?.code).toBe("estoque_insuficiente");
  });

  it("consumes on despachado and releases on cancel", async () => {
    const pedido = await createSaasPedido(sessionOf(a, "admin"), {
      cliente_id: a.clienteId,
      linhas: [{ sku_id: a.skus.visivel, qty: 1 }],
    });
    await transitionPedido(sessionOf(a, "admin"), pedido.id, "em_separacao");
    const before = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    await transitionPedido(sessionOf(a, "admin"), pedido.id, "despachado");
    const after = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    expect(after.onHand).toBe(before.onHand - 1);
    expect(after.reserved).toBe(before.reserved - 1);

    const cancelable = await createSaasPedido(sessionOf(a, "admin"), {
      cliente_id: a.clienteId,
      linhas: [{ sku_id: a.skus.visivel, qty: 1 }],
    });
    const beforeCancel = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: a.skus.visivel },
    });
    await transitionPedido(sessionOf(a, "admin"), cancelable.id, "cancelado");
    const afterCancel = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: a.skus.visivel },
    });
    expect(afterCancel.reserved).toBe(beforeCancel.reserved - 1);
  });
});

describe("cadastro gate + orçamento", () => {
  it("blocks accept when cadastro not aprovado", async () => {
    const orc = await createOrcamento(sessionOf(a, "vendedor"), {
      cadastro_request_id: a.cadastroPendenteId,
      linhas: [{ sku_id: a.skus.visivel, qty: 1 }],
    });
    await transitionOrcamento(sessionOf(a, "vendedor"), orc.id, "enviado");
    const err = await catchApi(() =>
      transitionOrcamento(sessionOf(a, "vendedor"), orc.id, "aceito"),
    );
    expect(err?.code).toBe("cadastro_nao_aprovado");
  });

  it("accept creates pedido and reserves for aprovado cliente", async () => {
    const orc = await createOrcamento(sessionOf(a, "vendedor"), {
      cliente_id: a.clienteId,
      linhas: [{ sku_id: a.skus.visivel, qty: 1 }],
    });
    await transitionOrcamento(sessionOf(a, "vendedor"), orc.id, "enviado");
    const before = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    const accepted = await transitionOrcamento(sessionOf(a, "vendedor"), orc.id, "aceito");
    expect(accepted.status).toBe("aceito");
    expect(accepted.pedido_id).toBeTruthy();
    const after = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.visivel } });
    expect(after.reserved).toBe(before.reserved + 1);
  });
});

describe("CNPJ lookup degrade", () => {
  it("always checks checksum; degrades when registry unavailable", async () => {
    setCnpjRegistryPortForTests({
      async lookup() {
        return { ok: false, reason: "unavailable" };
      },
    });
    const bad = await catchApi(() => lookupCnpj("11111111111111"));
    expect(bad?.code).toBe("checksum_invalido");
    const ok = await lookupCnpj("11222333000181");
    expect(ok.cnpj_registro_pendente).toBe(true);
    expect(ok.registry).toBe("unavailable");
  });
});

describe("inventory admin", () => {
  it("adjust rejects on_hand < reserved; visibility does not touch ledger", async () => {
    const err = await catchApi(() =>
      adjustOnHand(sessionOf(a, "admin"), a.skus.esgotado, -1, "teste"),
    );
    expect(err?.code).toBe("estoque_insuficiente");
    const before = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.oculto } });
    await toggleVisibilidade(sessionOf(a, "admin"), a.skus.oculto, true);
    const after = await db.inventoryBalance.findUniqueOrThrow({ where: { skuId: a.skus.oculto } });
    expect(after.onHand).toBe(before.onHand);
    expect(after.reserved).toBe(before.reserved);
  });
});
