import bcrypt from "bcryptjs";
import type { SaasRole } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { db } from "../db";
import { newId } from "../ids";

const PASSWORD = "Demo@1234";
let passwordHash: string | null = null;

async function hash() {
  passwordHash ??= await bcrypt.hash(PASSWORD, 8);
  return passwordHash;
}

export type TestWorld = {
  tenantId: string;
  slug: string;
  users: {
    admin: string;
    vendedor: string;
    customer: string;
    prospect: string;
  };
  clienteId: string;
  cadastroPendenteId: string;
  inboxId: string;
  skus: {
    visivel: string;
    oculto: string;
    esgotado: string;
    moq: string;
  };
};

export function sessionOf(
  world: TestWorld,
  role: SaasRole | "customer" | "prospect",
  extras: Partial<SessionContext> = {},
): SessionContext {
  if (role === "customer") {
    return {
      userId: world.users.customer,
      tenantId: world.tenantId,
      tenantSlug: world.slug,
      surface: "loja",
      saasRole: null,
      isCustomer: true,
      clienteStatus: "aprovado",
      clienteId: world.clienteId,
      cnpjLast4: "0161",
      ...extras,
    };
  }
  if (role === "prospect") {
    return {
      userId: world.users.prospect,
      tenantId: world.tenantId,
      tenantSlug: world.slug,
      surface: "loja",
      saasRole: null,
      isCustomer: true,
      clienteStatus: "pendente",
      cadastroRequestId: world.cadastroPendenteId,
      cnpjLast4: "0103",
      ...extras,
    };
  }
  return {
    userId: role === "admin" ? world.users.admin : world.users.vendedor,
    tenantId: world.tenantId,
    tenantSlug: world.slug,
    surface: "saas",
    saasRole: role,
    isCustomer: false,
    clienteStatus: null,
    ...extras,
  };
}

export async function createWorld(label: string): Promise<TestWorld> {
  const passwordHash = await hash();
  const tenantId = newId(`t_${label}`);
  const slug = `iso-${label}-${tenantId.slice(-6)}`;
  const users = {
    admin: newId("u"),
    vendedor: newId("u"),
    customer: newId("u"),
    prospect: newId("u"),
  };
  const skus = {
    visivel: newId("sku"),
    oculto: newId("sku"),
    esgotado: newId("sku"),
    moq: newId("sku"),
  };
  const clienteId = newId("cli");
  const cadastroPendenteId = newId("cad");

  // Distinct valid CNPJs per world
  const clienteCnpj = label === "a" ? "11444777000161" : "60746948000112";
  const prospectCnpj = label === "a" ? "34028316000103" : "00000000000191";
  const tenantCnpj = label === "a" ? "27865757000102" : "11222333000181";

  await db.user.createMany({
    data: [
      { id: users.admin, email: `adm.${slug}@test.local`, passwordHash, nome: "Admin", ativo: true },
      {
        id: users.vendedor,
        email: `ven.${slug}@test.local`,
        passwordHash,
        nome: "Ven",
        whatsapp: "+5511999000002",
        ativo: true,
      },
      {
        id: users.customer,
        email: `cli.${slug}@test.local`,
        passwordHash,
        nome: "Cliente",
        whatsapp: "+5511999000001",
        ativo: true,
      },
      {
        id: users.prospect,
        email: `pro.${slug}@test.local`,
        passwordHash,
        nome: "Prospect",
        whatsapp: "+5511999000003",
        ativo: true,
      },
    ],
  });

  await db.tenant.create({
    data: {
      id: tenantId,
      slug,
      razaoSocial: `Tenant ${label} LTDA`,
      nomeFantasia: `Tenant ${label}`,
      cnpjDigits: tenantCnpj,
      cnpjLast4: tenantCnpj.slice(-4),
      whatsappComercial: "+5511988877766",
      canaisAviso: "whatsapp",
      lojaModo: "pedido_direto",
      defaultVendedorUserId: users.vendedor,
    },
  });
  await db.theme.create({
    data: {
      tenantId,
      marca: "Teste",
      primary: "#7A1F1F",
      accent: "#1F5C6B",
      background: "#EEF2F4",
      logoUrl: null,
    },
  });
  await db.membership.createMany({
    data: [
      { id: newId("m"), tenantId, userId: users.admin, saasRole: "admin", isCustomer: false },
      { id: newId("m"), tenantId, userId: users.vendedor, saasRole: "vendedor", isCustomer: false },
      { id: newId("m"), tenantId, userId: users.customer, saasRole: null, isCustomer: true },
      { id: newId("m"), tenantId, userId: users.prospect, saasRole: null, isCustomer: true },
    ],
  });
  await db.cliente.create({
    data: {
      id: clienteId,
      tenantId,
      userId: users.customer,
      cnpjDigits: clienteCnpj,
      cnpjLast4: clienteCnpj.slice(-4),
      cnpjRegistroPendente: false,
      razaoSocial: `Cliente ${label}`,
      contatoNome: "Cliente",
      email: `cli.${slug}@test.local`,
      whatsapp: "+5511999000001",
      status: "aprovado",
    },
  });
  await db.cadastroRequest.create({
    data: {
      id: cadastroPendenteId,
      tenantId,
      cnpjDigits: prospectCnpj,
      cnpjLast4: prospectCnpj.slice(-4),
      cnpjRegistroPendente: true,
      razaoSocial: `Prospect ${label}`,
      contatoNome: "Prospect",
      email: `pro.${slug}@test.local`,
      whatsapp: "+5511999000003",
      status: "pendente",
      source: "loja",
    },
  });
  await db.sku.createMany({
    data: [
      {
        id: skus.visivel,
        tenantId,
        codigo: `VIS-${label}`,
        nome: "Visivel",
        precoAtacadoCentavos: 3990,
        qtdMinAtacado: 1,
        visivelLoja: true,
      },
      {
        id: skus.oculto,
        tenantId,
        codigo: `HID-${label}`,
        nome: "Oculto",
        precoAtacadoCentavos: 800,
        qtdMinAtacado: 1,
        visivelLoja: false,
      },
      {
        id: skus.esgotado,
        tenantId,
        codigo: `OUT-${label}`,
        nome: "Esgotado",
        precoAtacadoCentavos: 7000,
        qtdMinAtacado: 1,
        visivelLoja: true,
      },
      {
        id: skus.moq,
        tenantId,
        codigo: `MOQ-${label}`,
        nome: "Atacado MOQ",
        precoAtacadoCentavos: 14900,
        qtdMinAtacado: 10,
        visivelLoja: true,
      },
    ],
  });
  await db.inventoryBalance.createMany({
    data: [
      { skuId: skus.visivel, tenantId, onHand: 40, reserved: 5 },
      { skuId: skus.oculto, tenantId, onHand: 20, reserved: 0 },
      { skuId: skus.esgotado, tenantId, onHand: 2, reserved: 2 },
      { skuId: skus.moq, tenantId, onHand: 80, reserved: 0 },
    ],
  });

  // Minimal CRM desk for simulate/visibility tests
  const inboxId = newId("inx");
  await db.inbox.create({
    data: {
      id: inboxId,
      tenantId,
      name: "WhatsApp",
      channelType: "whatsapp",
    },
  });
  await db.channelWhatsapp.create({
    data: {
      id: newId("chw"),
      tenantId,
      inboxId,
      connectionStatus: "ready_stub",
      messageTemplatesJson: "[]",
    },
  });
  await db.inboxMember.createMany({
    data: [
      { id: newId("inm"), tenantId, inboxId, userId: users.admin },
      { id: newId("inm"), tenantId, inboxId, userId: users.vendedor },
    ],
  });
  for (const title of [
    "intent:cadastro",
    "intent:orcamento",
    "intent:info_empresa",
    "intent:outro",
  ]) {
    await db.label.create({
      data: {
        id: newId("lbl"),
        tenantId,
        title,
        color: "#1F5C6B",
        system: true,
      },
    });
  }
  await db.agentNotificationSetting.createMany({
    data: [
      { id: newId("ans"), tenantId, userId: users.admin },
      { id: newId("ans"), tenantId, userId: users.vendedor },
    ],
  });

  return { tenantId, slug, users, clienteId, cadastroPendenteId, skus, inboxId };
}

export async function destroyWorld(world: TestWorld) {
  // Tenant cascades operational rows; users are global so delete after.
  await db.tenant.delete({ where: { id: world.tenantId } }).catch(() => undefined);
  await db.user
    .deleteMany({
      where: {
        OR: [
          { id: { in: Object.values(world.users) } },
          { email: { endsWith: `${world.slug}@test.local` } },
        ],
      },
    })
    .catch(() => undefined);
}

export async function catchApi(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err as { code?: string; message?: string };
  }
}
