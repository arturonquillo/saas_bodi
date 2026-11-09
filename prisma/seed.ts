import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Demo@1234";
const TENANT = "tenant_casa_dos_frios";

// Valid CNPJ checksum fixtures (documented for QA):
// Tenant: 27865757000102
// Cliente: 11222333000181
// Prospecto cadastro: 34028316000103
const TENANT_CNPJ = "27865757000102";
const CLIENTE_CNPJ = "11222333000181";
const PROSPECTO_CNPJ = "34028316000103";

const ids = {
  admin: "usr_admin",
  vendedor: "usr_vendedor",
  cliente: "usr_cliente",
  prospecto: "usr_prospecto",
  skuPicanha: "sku_picanha",
  skuLinguica: "sku_linguica",
  skuOculto: "sku_oculto",
  skuEsgotado: "sku_esgotado",
  clienteRow: "cli_mercado",
  cadastroPendente: "cad_prospecto",
  orcEnviado: "orc_enviado",
  orcRascunho: "orc_rascunho",
  pedido: "ped_separacao",
  threadCadastro: "wath_cadastro",
  threadOrcamento: "wath_orcamento",
  threadInfo: "wath_info",
} as const;

async function main() {
  // Wipe in FK-safe order
  await prisma.whatsappMessage.deleteMany();
  await prisma.whatsappThread.deleteMany();
  await prisma.notificationOutbox.deleteMany();
  await prisma.vendaStatusHistory.deleteMany();
  await prisma.vendaFaturamento.deleteMany();
  await prisma.pedidoStatusHistory.deleteMany();
  await prisma.pedidoLine.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.pedidoVenda.deleteMany();
  await prisma.orcamentoStatusHistory.deleteMany();
  await prisma.orcamentoLine.deleteMany();
  await prisma.orcamento.deleteMany();
  await prisma.cadastroRequest.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.sku.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.createMany({
    data: [
      {
        id: ids.admin,
        email: "admin@casadosfrios.local",
        passwordHash,
        nome: "Admin Casa dos Frios",
        whatsapp: "+5511988877700",
        ativo: true,
      },
      {
        id: ids.vendedor,
        email: "vendedor@casadosfrios.local",
        passwordHash,
        nome: "Vendedor Casa dos Frios",
        whatsapp: "+5511988877766",
        ativo: true,
      },
      {
        id: ids.cliente,
        email: "cliente@mercadoexemplo.local",
        passwordHash,
        nome: "Contato Mercado Exemplo",
        whatsapp: "+5511911112222",
        ativo: true,
      },
      {
        id: ids.prospecto,
        email: "prospecto@novaloja.local",
        passwordHash,
        nome: "Prospecto Nova Loja",
        whatsapp: "+5511933334444",
        ativo: true,
      },
    ],
  });

  await prisma.tenant.create({
    data: {
      id: TENANT,
      slug: "casa-dos-frios",
      razaoSocial: "Casa dos Frios Distribuidora LTDA",
      nomeFantasia: "Casa dos Frios",
      cnpjDigits: TENANT_CNPJ,
      cnpjLast4: TENANT_CNPJ.slice(-4),
      whatsappComercial: "+5511988877766",
      canaisAviso: "whatsapp",
      lojaModo: "pedido_direto",
      defaultVendedorUserId: ids.vendedor,
    },
  });

  // Design tokens win (docs/design/tokens.md)
  await prisma.theme.create({
    data: {
      tenantId: TENANT,
      marca: "Casa dos Frios",
      primary: "#7A1F1F",
      accent: "#1F5C6B",
      background: "#EEF2F4",
      logoUrl: null,
    },
  });

  await prisma.membership.createMany({
    data: [
      {
        id: "mem_admin",
        tenantId: TENANT,
        userId: ids.admin,
        saasRole: "admin",
        isCustomer: false,
      },
      {
        id: "mem_vendedor",
        tenantId: TENANT,
        userId: ids.vendedor,
        saasRole: "vendedor",
        isCustomer: false,
      },
      {
        id: "mem_cliente",
        tenantId: TENANT,
        userId: ids.cliente,
        saasRole: null,
        isCustomer: true,
      },
      {
        id: "mem_prospecto",
        tenantId: TENANT,
        userId: ids.prospecto,
        saasRole: null,
        isCustomer: true,
      },
    ],
  });

  await prisma.cliente.create({
    data: {
      id: ids.clienteRow,
      tenantId: TENANT,
      userId: ids.cliente,
      cnpjDigits: CLIENTE_CNPJ,
      cnpjLast4: CLIENTE_CNPJ.slice(-4),
      cnpjRegistroPendente: false,
      razaoSocial: "Mercado Exemplo LTDA",
      contatoNome: "Contato Mercado Exemplo",
      email: "cliente@mercadoexemplo.local",
      whatsapp: "+5511911112222",
      status: "aprovado",
    },
  });

  await prisma.cadastroRequest.create({
    data: {
      id: ids.cadastroPendente,
      tenantId: TENANT,
      cnpjDigits: PROSPECTO_CNPJ,
      cnpjLast4: PROSPECTO_CNPJ.slice(-4),
      cnpjRegistroPendente: true,
      razaoSocial: "Nova Loja Comércio LTDA",
      contatoNome: "Prospecto Nova Loja",
      email: "prospecto@novaloja.local",
      whatsapp: "+5511933334444",
      status: "pendente",
      source: "loja",
    },
  });

  await prisma.sku.createMany({
    data: [
      {
        id: ids.skuPicanha,
        tenantId: TENANT,
        codigo: "PICANHA-KG",
        nome: "Picanha resfriada (kg)",
        precoAtacadoCentavos: 8990,
        qtdMinAtacado: 1,
        visivelLoja: true,
      },
      {
        id: ids.skuLinguica,
        tenantId: TENANT,
        codigo: "LINGUICA-CX",
        nome: "Linguiça Toscana (caixa)",
        precoAtacadoCentavos: 12900,
        qtdMinAtacado: 5,
        visivelLoja: true,
      },
      {
        id: ids.skuOculto,
        tenantId: TENANT,
        codigo: "OCULTO-INTERNO",
        nome: "Corte interno (não vitrine)",
        precoAtacadoCentavos: 4500,
        qtdMinAtacado: 1,
        visivelLoja: false,
      },
      {
        id: ids.skuEsgotado,
        tenantId: TENANT,
        codigo: "ESGOTADO-VITRINE",
        nome: "Fraldinha (esgotada)",
        precoAtacadoCentavos: 6990,
        qtdMinAtacado: 1,
        visivelLoja: true,
      },
    ],
  });

  // reserved must match open Pedidos in confirmado/em_separacao
  // Seed pedido uses 5kg PICANHA → reserved 5 on PICANHA; ESGOTADO reserved=3 with on_hand=3
  await prisma.inventoryBalance.createMany({
    data: [
      { skuId: ids.skuPicanha, tenantId: TENANT, onHand: 40, reserved: 5 },
      { skuId: ids.skuLinguica, tenantId: TENANT, onHand: 30, reserved: 0 },
      { skuId: ids.skuOculto, tenantId: TENANT, onHand: 10, reserved: 0 },
      { skuId: ids.skuEsgotado, tenantId: TENANT, onHand: 3, reserved: 3 },
    ],
  });

  const validoAte = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.orcamento.create({
    data: {
      id: ids.orcEnviado,
      tenantId: TENANT,
      clienteId: ids.clienteRow,
      vendedorUserId: ids.vendedor,
      status: "enviado",
      validoAte,
      channel: "saas",
      lines: {
        create: [
          {
            id: "oln_enviado_1",
            tenantId: TENANT,
            skuId: ids.skuLinguica,
            codigoSnapshot: "LINGUICA-CX",
            nomeSnapshot: "Linguiça Toscana (caixa)",
            qty: 5,
            unitPriceCentavos: 12900,
          },
        ],
      },
      history: {
        create: [
          {
            id: "ohs_enviado_1",
            tenantId: TENANT,
            fromStatus: null,
            toStatus: "rascunho",
            actorUserId: ids.vendedor,
          },
          {
            id: "ohs_enviado_2",
            tenantId: TENANT,
            fromStatus: "rascunho",
            toStatus: "enviado",
            actorUserId: ids.vendedor,
          },
        ],
      },
    },
  });

  await prisma.orcamento.create({
    data: {
      id: ids.orcRascunho,
      tenantId: TENANT,
      cadastroRequestId: ids.cadastroPendente,
      vendedorUserId: ids.vendedor,
      status: "rascunho",
      channel: "whatsapp",
      lines: {
        create: [
          {
            id: "oln_rasc_1",
            tenantId: TENANT,
            skuId: ids.skuPicanha,
            codigoSnapshot: "PICANHA-KG",
            nomeSnapshot: "Picanha resfriada (kg)",
            qty: 2,
            unitPriceCentavos: 8990,
          },
        ],
      },
      history: {
        create: {
          id: "ohs_rasc_1",
          tenantId: TENANT,
          fromStatus: null,
          toStatus: "rascunho",
          actorUserId: ids.vendedor,
        },
      },
    },
  });

  await prisma.pedidoVenda.create({
    data: {
      id: ids.pedido,
      tenantId: TENANT,
      clienteId: ids.clienteRow,
      vendedorUserId: ids.vendedor,
      channel: "saas",
      status: "em_separacao",
      lines: {
        create: [
          {
            id: "pln_1",
            tenantId: TENANT,
            skuId: ids.skuPicanha,
            codigoSnapshot: "PICANHA-KG",
            nomeSnapshot: "Picanha resfriada (kg)",
            qty: 5,
            unitPriceCentavos: 8990,
          },
        ],
      },
      history: {
        create: [
          {
            id: "phs_1",
            tenantId: TENANT,
            fromStatus: null,
            toStatus: "confirmado",
            actorUserId: ids.vendedor,
          },
          {
            id: "phs_2",
            tenantId: TENANT,
            fromStatus: "confirmado",
            toStatus: "em_separacao",
            actorUserId: ids.vendedor,
          },
        ],
      },
    },
  });

  await prisma.inventoryMovement.createMany({
    data: [
      {
        id: "mov_reserve_picanha",
        tenantId: TENANT,
        skuId: ids.skuPicanha,
        pedidoId: ids.pedido,
        type: "reserve",
        deltaOnHand: 0,
        deltaReserved: 5,
        actorUserId: ids.vendedor,
      },
      {
        id: "mov_esgotado",
        tenantId: TENANT,
        skuId: ids.skuEsgotado,
        type: "reserve",
        deltaOnHand: 0,
        deltaReserved: 3,
        reason: "seed demo esgotado",
        actorUserId: ids.admin,
      },
    ],
  });

  // Inbox threads — one per intent
  await prisma.whatsappThread.create({
    data: {
      id: ids.threadCadastro,
      tenantId: TENANT,
      phoneE164: "+5511933334444",
      intent: "cadastro",
      cadastroRequestId: ids.cadastroPendente,
      status: "aberta",
      messages: {
        create: {
          id: "wmsg_cad_1",
          tenantId: TENANT,
          direction: "inbound",
          body: "Olá, quero me cadastrar como atacadista.",
          simulated: true,
        },
      },
    },
  });
  await prisma.whatsappThread.create({
    data: {
      id: ids.threadOrcamento,
      tenantId: TENANT,
      phoneE164: "+5511911112222",
      intent: "orcamento",
      clienteId: ids.clienteRow,
      orcamentoId: ids.orcEnviado,
      status: "aberta",
      messages: {
        create: {
          id: "wmsg_orc_1",
          tenantId: TENANT,
          direction: "inbound",
          body: "Preciso de preço de linguiça caixa.",
          simulated: true,
        },
      },
    },
  });
  await prisma.whatsappThread.create({
    data: {
      id: ids.threadInfo,
      tenantId: TENANT,
      phoneE164: "+5511955556666",
      intent: "info_empresa",
      status: "aberta",
      messages: {
        create: {
          id: "wmsg_info_1",
          tenantId: TENANT,
          direction: "inbound",
          body: "Qual o horário de entrega na zona sul?",
          simulated: true,
        },
      },
    },
  });

  await prisma.notificationOutbox.create({
    data: {
      id: "out_orc_enviado",
      tenantId: TENANT,
      channel: "whatsapp",
      recipientRole: "customer",
      recipient: "+5511911112222",
      templateKey: "orcamento.status",
      payloadJson: JSON.stringify({
        orcamento_id: ids.orcEnviado,
        status: "enviado",
        cnpj_last4: CLIENTE_CNPJ.slice(-4),
      }),
      status: "enviado",
      orcamentoId: ids.orcEnviado,
    },
  });

  console.log("Seed OK — tenant casa-dos-frios (password Demo@1234)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
