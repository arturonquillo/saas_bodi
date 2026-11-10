import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availableQty, netUnitFromDesconto } from "@saas-frota/shared";
import { db } from "../db";
import { getStoreCatalog, getStoreProduct } from "../catalog/projection";
import {
  adjustOnHand,
  createSku,
  getEstoque,
  listEstoque,
  listMovimentos,
  patchSku,
} from "./service";
import { createOrcamento } from "../sales/orcamento";
import { createLojaPedido, createSaasPedido } from "../sales/pedido";
import { ApiError } from "../http/respond";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "../test/world";

let world: TestWorld;

beforeAll(async () => {
  world = await createWorld("inv");
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("discount math", () => {
  it("half-up to centavo", () => {
    expect(netUnitFromDesconto(1000, 10)).toBe(900);
    expect(netUnitFromDesconto(3990, 10)).toBe(3591);
    expect(netUnitFromDesconto(1, 50)).toBe(0);
  });
});

describe("estoque CRUD + RBAC", () => {
  it("admin creates SKU with opening adjust estoque_inicial", async () => {
    const created = await createSku(sessionOf(world, "admin"), {
      codigo: "  novo-kg ",
      nome: "Novo produto",
      descricao: "  ",
      unidade: "kg",
      preco_atacado_centavos: 5000,
      desconto_max_pct: 15,
      qtd_min_atacado: 2,
      on_hand: 12,
      visivel_loja: true,
    });
    expect(created.codigo).toBe("NOVO-KG");
    expect(created.descricao).toBeNull();
    expect(created.unidade).toBe("kg");
    expect(created.desconto_max_pct).toBe(15);
    expect(created.on_hand).toBe(12);
    expect(created.available).toBe(12);
    expect(created.ativo).toBe(true);
    const movs = await listMovimentos(
      sessionOf(world, "vendedor"),
      created.id,
      new URL("http://localhost/?limit=10"),
    );
    expect(movs.items[0]?.type).toBe("adjust");
    expect(movs.items[0]?.qty).toBe(12);
    expect(movs.items[0]?.motivo).toBe("estoque_inicial");
  });

  it("vendedor cannot create / patch / adjust", async () => {
    const createErr = await catchApi(() =>
      createSku(sessionOf(world, "vendedor"), {
        codigo: "X",
        nome: "X",
        preco_atacado_centavos: 1,
      }),
    );
    expect(createErr?.code).toBe("forbidden");
    const patchErr = await catchApi(() =>
      patchSku(sessionOf(world, "vendedor"), world.skus.visivel, { nome: "Nope" }),
    );
    expect(patchErr?.code).toBe("forbidden");
    const adjErr = await catchApi(() =>
      adjustOnHand(sessionOf(world, "vendedor"), world.skus.visivel, 1, "hack"),
    );
    expect(adjErr?.code).toBe("forbidden");
  });

  it("vendedor can read list/detail/movements; PATCH rejects on_hand", async () => {
    const page = await listEstoque(sessionOf(world, "vendedor"), new URL("http://localhost/?limit=50"));
    expect(page.items.some((i) => i.id === world.skus.visivel)).toBe(true);
    const detail = await getEstoque(sessionOf(world, "vendedor"), world.skus.visivel);
    expect(detail.desconto_max_pct).toBe(10);
    const bad = await catchApi(() =>
      patchSku(sessionOf(world, "admin"), world.skus.visivel, { on_hand: 999 }),
    );
    expect(bad?.code).toBe("validacao");
  });

  it("adjust rejects delta 0 and on_hand < reserved; visibility/ativo do not touch ledger", async () => {
    const zero = await catchApi(() =>
      adjustOnHand(sessionOf(world, "admin"), world.skus.visivel, 0, "noop"),
    );
    expect(zero?.code).toBe("validacao");
    const under = await catchApi(() =>
      adjustOnHand(sessionOf(world, "admin"), world.skus.esgotado, -1, "abaixo"),
    );
    expect(under?.code).toBe("estoque_insuficiente");
    const before = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: world.skus.oculto },
    });
    await patchSku(sessionOf(world, "admin"), world.skus.oculto, {
      visivel_loja: true,
      ativo: false,
    });
    const after = await db.inventoryBalance.findUniqueOrThrow({
      where: { skuId: world.skus.oculto },
    });
    expect(after.onHand).toBe(before.onHand);
    expect(after.reserved).toBe(before.reserved);
    // restore for other tests
    await patchSku(sessionOf(world, "admin"), world.skus.oculto, {
      visivel_loja: false,
      ativo: true,
    });
  });
});

describe("Loja projection + one ledger", () => {
  it("lists only ativo && visivel_loja; omits inactive; available from same ledger", async () => {
    const page = await getStoreCatalog(world.slug, new URL("http://localhost/?limit=50"));
    const ids = page.items.map((i) => i.id);
    expect(ids).toContain(world.skus.visivel);
    expect(ids).not.toContain(world.skus.oculto);
    expect(ids).not.toContain(world.skus.inativo);
    const item = page.items.find((i) => i.id === world.skus.visivel)!;
    expect(item.codigo).toBe(`VIS-inv`);
    expect(item.unidade).toBe("kg");
    expect(item.available).toBe(availableQty(40, 5));

    const before = item.available;
    await adjustOnHand(sessionOf(world, "admin"), world.skus.visivel, 3, "entrada loja sync");
    const after = await getStoreProduct(world.skus.visivel, world.slug);
    expect(after.available).toBe(before + 3);

    const inactive = await catchApi(() => getStoreProduct(world.skus.inativo, world.slug));
    expect(inactive?.code).toBe("nao_encontrado");
  });
});

describe("line desconto_pct cap", () => {
  it("vendedor above cap → 403; admin may exceed; Loja always list", async () => {
    const over = await catchApi(() =>
      createOrcamento(sessionOf(world, "vendedor"), {
        cliente_id: world.clienteId,
        linhas: [{ sku_id: world.skus.visivel, qty: 1, desconto_pct: 11 }],
      }),
    );
    expect(over?.code).toBe("forbidden");

    const okVendor = await createOrcamento(sessionOf(world, "vendedor"), {
      cliente_id: world.clienteId,
      linhas: [{ sku_id: world.skus.visivel, qty: 1, desconto_pct: 10 }],
    });
    expect(okVendor.linhas[0]?.desconto_pct).toBe(10);
    expect(okVendor.linhas[0]?.preco_lista_centavos).toBe(3990);
    expect(okVendor.linhas[0]?.preco_unitario_centavos).toBe(netUnitFromDesconto(3990, 10));
    expect(okVendor.linhas[0]?.unit_price_centavos).toBe(okVendor.linhas[0]?.preco_unitario_centavos);

    const adminOver = await createSaasPedido(sessionOf(world, "admin"), {
      cliente_id: world.clienteId,
      linhas: [{ sku_id: world.skus.visivel, qty: 1, desconto_pct: 25 }],
    });
    expect(adminOver.linhas[0]?.desconto_pct).toBe(25);
    expect(adminOver.linhas[0]?.preco_unitario_centavos).toBe(netUnitFromDesconto(3990, 25));

    const inactive = await catchApi(() =>
      createOrcamento(sessionOf(world, "vendedor"), {
        cliente_id: world.clienteId,
        linhas: [{ sku_id: world.skus.inativo, qty: 1 }],
      }),
    );
    expect(inactive?.code).toBe("validacao");
    expect(inactive).toBeInstanceOf(ApiError);
    expect((inactive as ApiError).details).toMatchObject({ code: "sku_inativo" });

    const loja = await createLojaPedido(sessionOf(world, "customer"), [
      { sku_id: world.skus.visivel, qty: 1, desconto_pct: 50 },
    ]);
    expect(loja.linhas[0]?.desconto_pct).toBe(0);
    expect(loja.linhas[0]?.preco_unitario_centavos).toBe(3990);
  });
});
