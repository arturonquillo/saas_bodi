import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { ApiError } from "./http/respond";
import { simulateInbound } from "./inbox/service";
import { transitionCadastro } from "./cadastro/service";
import { putSaasTheme } from "./theme/service";
import { createUsuario, listUsuarios, patchUsuario } from "./users/service";
import { createLojaPedido, createSaasPedido, transitionPedido } from "./sales/pedido";
import { createOrcamento, transitionOrcamento } from "./sales/orcamento";
import { faturarPedido, transitionVenda } from "./sales/venda";
import { putSaasConfig } from "./config/service";
import { catchApi, createWorld, destroyWorld, sessionOf, type TestWorld } from "./test/world";

let world: TestWorld;

beforeAll(async () => {
  world = await createWorld("qa");
});

afterAll(async () => {
  if (world) await destroyWorld(world);
});

describe("RBAC admin vs vendedor", () => {
  it("vendedor cannot list users, write theme/config, or simulate inbox", async () => {
    const ven = sessionOf(world, "vendedor");
    const url = new URL("http://localhost/?limit=20");
    expect((await catchApi(() => listUsuarios(ven, url)))?.code).toBe("forbidden");
    expect(
      (
        await catchApi(() =>
          putSaasTheme(ven, {
            marca: "Hack",
            primary: "#111111",
            accent: "#222222",
            background: "#333333",
            logo_url: null,
          }),
        )
      )?.code,
    ).toBe("forbidden");
    expect(
      (await catchApi(() => putSaasConfig(ven, { canais_aviso: "email", loja_modo: "pedido_direto" })))
        ?.code,
    ).toBe("forbidden");
    expect(
      (
        await catchApi(() =>
          simulateInbound(ven, { phone_e164: "+5511999887766", body: "oi", intent_hint: "cadastro" }),
        )
      )?.code,
    ).toBe("forbidden");
  });

  it("admin can simulate inbound with phone + body and tag intent", async () => {
    const thread = await simulateInbound(sessionOf(world, "admin"), {
      phone_e164: "+5511987654321",
      body: "Quero cadastro B2B",
      intent_hint: "cadastro",
    });
    expect(thread.phone_e164).toBe("+5511987654321");
    expect(thread.intent).toBe("cadastro");
    expect(thread.messages?.some((m) => m.body.includes("cadastro") && m.simulated)).toBe(true);
  });
});

describe("cadastro gate + outbox", () => {
  it("approve creates Cliente and outbox for customer + vendedor; refuse needs reason", async () => {
    const refuse = await catchApi(() =>
      transitionCadastro(sessionOf(world, "vendedor"), world.cadastroPendenteId, "recusado"),
    );
    expect(refuse?.code).toBe("validacao");

    const cadId = world.cadastroPendenteId;
    const approved = await transitionCadastro(sessionOf(world, "admin"), cadId, "aprovado");
    expect(approved.status).toBe("aprovado");
    expect(approved.cliente_id).toBeTruthy();

    const outbox = await db.notificationOutbox.findMany({
      where: { tenantId: world.tenantId, cadastroRequestId: cadId },
    });
    expect(outbox.length).toBeGreaterThanOrEqual(2);
    expect(outbox.map((o) => o.recipientRole).sort()).toEqual(
      expect.arrayContaining(["customer", "vendedor"]),
    );
    expect(outbox.every((o) => o.status === "enviado")).toBe(true);
    for (const row of outbox) {
      expect(row.payloadJson).toContain("cnpj_last4");
      expect(row.payloadJson).not.toMatch(/\d{14}/);
    }
  });

  it("prospect cannot create loja pedido", async () => {
    // recreate a fresh pendente cadastro world state via new prospect session without cliente
    const err = await catchApi(() =>
      createLojaPedido(sessionOf(world, "prospect"), [{ sku_id: world.skus.visivel, qty: 1 }]),
    );
    expect(err?.code).toBe("cadastro_nao_aprovado");
  });
});

describe("pipeline orçamento → pedido → venda", () => {
  it("recusado orçamento does not create pedido; illegal transition is 403/409-class", async () => {
    const orc = await createOrcamento(sessionOf(world, "vendedor"), {
      cliente_id: world.clienteId,
      linhas: [{ sku_id: world.skus.visivel, qty: 1 }],
    });
    await transitionOrcamento(sessionOf(world, "vendedor"), orc.id, "enviado");
    const refused = await transitionOrcamento(sessionOf(world, "vendedor"), orc.id, "recusado");
    expect(refused.status).toBe("recusado");
    expect(refused.pedido_id).toBeFalsy();

    const pedido = await createSaasPedido(sessionOf(world, "admin"), {
      cliente_id: world.clienteId,
      linhas: [{ sku_id: world.skus.visivel, qty: 1 }],
    });
    const illegal = await catchApi(() =>
      transitionPedido(sessionOf(world, "admin"), pedido.id, "entregue"),
    );
    expect(illegal).toBeInstanceOf(ApiError);
    expect(["transicao_ilegal", "forbidden"]).toContain(illegal?.code);
  });

  it("faturar creates venda; second active venda rejected; faturado enqueues outbox", async () => {
    const pedido = await createSaasPedido(sessionOf(world, "vendedor"), {
      cliente_id: world.clienteId,
      linhas: [{ sku_id: world.skus.visivel, qty: 1 }],
    });
    const venda = await faturarPedido(sessionOf(world, "vendedor"), pedido.id);
    expect(venda.status).toBe("rascunho");
    const dup = await catchApi(() => faturarPedido(sessionOf(world, "admin"), pedido.id));
    expect(dup?.code).toBe("conflito");

    const fat = await transitionVenda(sessionOf(world, "vendedor"), venda.id, "faturado");
    expect(fat.status).toBe("faturado");
    const outbox = await db.notificationOutbox.findMany({
      where: { tenantId: world.tenantId, vendaId: venda.id, templateKey: "venda.faturado" },
    });
    expect(outbox.length).toBeGreaterThanOrEqual(2);
    expect(outbox.every((o) => o.status === "enviado")).toBe(true);
  });
});

describe("admin user deactivate", () => {
  it("admin can create and deactivate a vendedor (ativo=false)", async () => {
    const created = await createUsuario(sessionOf(world, "admin"), {
      email: `qa.ven.${world.slug}@test.local`,
      nome: "QA Ven",
      senha: "Demo@1234",
      saas_role: "vendedor",
    });
    expect(created.saas_role).toBe("vendedor");
    expect(created.ativo).toBe(true);
    const patched = await patchUsuario(sessionOf(world, "admin"), created.id, { ativo: false });
    expect(patched.ativo).toBe(false);
    const user = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(user.ativo).toBe(false);
  });
});
