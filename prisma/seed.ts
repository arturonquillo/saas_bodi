import { createCipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function sealSecrets(secrets: Record<string, string>) {
  const key = Buffer.from(
    process.env.CREDENTIALS_ENCRYPTION_KEY ??
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "base64",
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

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
  inboxWa: "inx_wa_default",
  channelWa: "chw_wa_default",
  inboxWidget: "inx_widget_loja",
  channelWidget: "cww_widget_loja",
  inboxEmail: "inx_email_stub",
  channelEmail: "cem_email_stub",
  inboxApi: "inx_api_stub",
  channelApi: "cap_api_stub",
  inboxIg: "inx_ig_stub",
  channelIg: "cso_ig_stub",
  emailTemplate: "etpl_padrao",
  teamVendas: "team_vendas",
  companyMercado: "co_mercado",
  contactProspecto: "ct_prospecto",
  contactCliente: "ct_cliente",
  contactInfo: "ct_info",
  convCadastro: "cnv_cadastro",
  convOrcamento: "cnv_orcamento",
  convInfo: "cnv_info",
} as const;

async function main() {
  // Wipe in FK-safe order
  await prisma.csatResponse.deleteMany();
  await prisma.contactImportBatch.deleteMany();
  await prisma.customFilter.deleteMany();
  await prisma.assignmentPolicy.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.agentBotInbox.deleteMany();
  await prisma.agentBot.deleteMany();
  await prisma.customAttributeDefinition.deleteMany();
  await prisma.macro.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.article.deleteMany();
  await prisma.helpCategory.deleteMany();
  await prisma.portal.deleteMany();
  await prisma.campaignRecipient.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationDraft.deleteMany();
  await prisma.conversationLabel.deleteMany();
  await prisma.contactLabel.deleteMany();
  await prisma.agentPresence.deleteMany();
  await prisma.agentNotification.deleteMany();
  await prisma.agentNotificationSetting.deleteMany();
  await prisma.domainEvent.deleteMany();
  await prisma.backgroundJob.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contactInbox.deleteMany();
  await prisma.widgetSession.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.channelWebsiteWidget.deleteMany();
  await prisma.channelEmail.deleteMany();
  await prisma.channelSocial.deleteMany();
  await prisma.channelSms.deleteMany();
  await prisma.channelApi.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.channelWhatsapp.deleteMany();
  await prisma.inboxMember.deleteMany();
  await prisma.inbox.deleteMany();
  await prisma.cannedResponse.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.label.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
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
      webhookSigningSecret: randomBytes(32).toString("hex"),
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

  await prisma.company.create({
    data: {
      id: ids.companyMercado,
      tenantId: TENANT,
      cnpjDigits: CLIENTE_CNPJ,
      cnpjLast4: CLIENTE_CNPJ.slice(-4),
      cnpjRegistroPendente: false,
      razaoSocial: "Mercado Exemplo LTDA",
      nomeFantasia: "Mercado Exemplo",
    },
  });

  await prisma.cliente.create({
    data: {
      id: ids.clienteRow,
      tenantId: TENANT,
      userId: ids.cliente,
      companyId: ids.companyMercado,
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

  // CRM Phase A — default WA inbox + system labels + conversations
  const sealedSecrets = sealSecrets({
    api_token: "seed-token-not-for-production",
    api_secret: "seed-secret-not-for-production",
    webhook_verify_token: "seed-verify-not-for-production",
  });

  await prisma.inbox.create({
    data: {
      id: ids.inboxWa,
      tenantId: TENANT,
      name: "WhatsApp principal",
      channelType: "whatsapp",
      greeting: "Olá! Bem-vindo à Casa dos Frios.",
      oooMessage: "Estamos fora do horário. Retornamos em breve.",
      lockToSingleConversation: true,
      vendedorSeeAll: false,
      timezone: "America/Sao_Paulo",
    },
  });
  await prisma.channelWhatsapp.create({
    data: {
      id: ids.channelWa,
      tenantId: TENANT,
      inboxId: ids.inboxWa,
      provider: "whatsapp_cloud",
      phoneE164Display: "+5511988877766",
      phoneNumberId: "seed_phone_number_id",
      businessAccountId: "seed_waba_id",
      secretsCiphertext: sealedSecrets,
      connectionStatus: "ready_stub",
      messageTemplatesJson: JSON.stringify([
        { key: "greeting", body: "Olá {{contact.nome}}, somos a Casa dos Frios." },
        {
          key: "campaign.wa_one_off",
          body: "Olá {{contact.nome}}, promoção da Casa dos Frios (envio simulado).",
        },
      ]),
    },
  });
  await prisma.inboxMember.createMany({
    data: [
      { id: "inm_admin", tenantId: TENANT, inboxId: ids.inboxWa, userId: ids.admin },
      { id: "inm_vendedor", tenantId: TENANT, inboxId: ids.inboxWa, userId: ids.vendedor },
    ],
  });

  const systemLabels = [
    { id: "lbl_cadastro", title: "intent:cadastro", color: "#7A1F1F" },
    { id: "lbl_orcamento", title: "intent:orcamento", color: "#C4A35A" },
    { id: "lbl_info", title: "intent:info_empresa", color: "#1F5C6B" },
    { id: "lbl_outro", title: "intent:outro", color: "#6B7280" },
  ];
  await prisma.label.createMany({
    data: systemLabels.map((l) => ({
      id: l.id,
      tenantId: TENANT,
      title: l.title,
      color: l.color,
      showOnSidebar: true,
      system: true,
    })),
  });

  await prisma.customAttributeDefinition.createMany({
    data: [
      {
        id: "cad_conv_segmento",
        tenantId: TENANT,
        attributeModel: "conversation",
        attributeDisplayType: "list",
        attributeKey: "segmento",
        attributeDisplayName: "Segmento",
        attributeValuesJson: JSON.stringify(["atacado", "varejo", "horeca"]),
      },
      {
        id: "cad_ct_origem",
        tenantId: TENANT,
        attributeModel: "contact",
        attributeDisplayType: "text",
        attributeKey: "origem",
        attributeDisplayName: "Origem",
      },
    ],
  });

  await prisma.team.create({
    data: { id: ids.teamVendas, tenantId: TENANT, name: "Vendas" },
  });
  await prisma.teamMember.createMany({
    data: [
      { id: "tm_admin", tenantId: TENANT, teamId: ids.teamVendas, userId: ids.admin },
      { id: "tm_vendedor", tenantId: TENANT, teamId: ids.teamVendas, userId: ids.vendedor },
    ],
  });

  await prisma.cannedResponse.create({
    data: {
      id: "can_saudacao",
      tenantId: TENANT,
      shortCode: "saudacao",
      content: "Olá {{contact.nome}}! Sou da Casa dos Frios, como posso ajudar?",
    },
  });

  await prisma.agentNotificationSetting.createMany({
    data: [
      { id: "ans_admin", tenantId: TENANT, userId: ids.admin },
      { id: "ans_vendedor", tenantId: TENANT, userId: ids.vendedor },
    ],
  });

  await prisma.contact.createMany({
    data: [
      {
        id: ids.contactProspecto,
        tenantId: TENANT,
        nome: "Prospecto Nova Loja",
        email: "prospecto@novaloja.local",
        phoneE164: "+5511933334444",
        cadastroRequestId: ids.cadastroPendente,
      },
      {
        id: ids.contactCliente,
        tenantId: TENANT,
        nome: "Contato Mercado Exemplo",
        email: "cliente@mercadoexemplo.local",
        phoneE164: "+5511911112222",
        companyId: ids.companyMercado,
        clienteId: ids.clienteRow,
      },
      {
        id: ids.contactInfo,
        tenantId: TENANT,
        nome: "+5511955556666",
        phoneE164: "+5511955556666",
      },
    ],
  });

  await prisma.cliente.update({
    where: { id: ids.clienteRow },
    data: { primaryContactId: ids.contactCliente },
  });
  await prisma.cadastroRequest.update({
    where: { id: ids.cadastroPendente },
    data: { contactId: ids.contactProspecto },
  });

  await prisma.contactInbox.createMany({
    data: [
      {
        id: "ci_prospecto",
        tenantId: TENANT,
        contactId: ids.contactProspecto,
        inboxId: ids.inboxWa,
        sourceId: "+5511933334444",
      },
      {
        id: "ci_cliente",
        tenantId: TENANT,
        contactId: ids.contactCliente,
        inboxId: ids.inboxWa,
        sourceId: "+5511911112222",
      },
      {
        id: "ci_info",
        tenantId: TENANT,
        contactId: ids.contactInfo,
        inboxId: ids.inboxWa,
        sourceId: "+5511955556666",
      },
    ],
  });

  const now = new Date();
  await prisma.conversation.create({
    data: {
      id: ids.convCadastro,
      tenantId: TENANT,
      inboxId: ids.inboxWa,
      contactId: ids.contactProspecto,
      status: "open",
      cadastroRequestId: ids.cadastroPendente,
      lastActivityAt: now,
      messages: {
        create: {
          id: "msg_cad_1",
          tenantId: TENANT,
          messageType: "incoming",
          content: "Olá, quero me cadastrar como atacadista.",
          simulated: true,
          deliveryStatus: "delivered",
        },
      },
      labels: {
        create: {
          id: "clb_cad",
          tenantId: TENANT,
          labelId: "lbl_cadastro",
        },
      },
    },
  });
  await prisma.conversation.create({
    data: {
      id: ids.convOrcamento,
      tenantId: TENANT,
      inboxId: ids.inboxWa,
      contactId: ids.contactCliente,
      status: "open",
      clienteId: ids.clienteRow,
      orcamentoId: ids.orcEnviado,
      assigneeUserId: ids.vendedor,
      teamId: ids.teamVendas,
      lastActivityAt: now,
      messages: {
        create: {
          id: "msg_orc_1",
          tenantId: TENANT,
          messageType: "incoming",
          content: "Preciso de preço de linguiça caixa.",
          simulated: true,
          deliveryStatus: "delivered",
        },
      },
      labels: {
        create: {
          id: "clb_orc",
          tenantId: TENANT,
          labelId: "lbl_orcamento",
        },
      },
    },
  });
  await prisma.conversation.create({
    data: {
      id: ids.convInfo,
      tenantId: TENANT,
      inboxId: ids.inboxWa,
      contactId: ids.contactInfo,
      status: "resolved",
      lastActivityAt: now,
      messages: {
        create: {
          id: "msg_info_1",
          tenantId: TENANT,
          messageType: "incoming",
          content: "Qual o horário de entrega na zona sul?",
          simulated: true,
          deliveryStatus: "delivered",
        },
      },
      labels: {
        create: {
          id: "clb_info",
          tenantId: TENANT,
          labelId: "lbl_info",
        },
      },
    },
  });

  await prisma.cadastroRequest.update({
    where: { id: ids.cadastroPendente },
    data: { conversationId: ids.convCadastro },
  });

  await prisma.notificationOutbox.create({
    data: {
      id: "out_orc_enviado",
      tenantId: TENANT,
      channel: "whatsapp",
      recipientRole: "customer",
      recipient: "+5511911112222",
      templateKey: "orcamento.status",
      category: "commerce",
      payloadJson: JSON.stringify({
        orcamento_id: ids.orcEnviado,
        status: "enviado",
        cnpj_last4: CLIENTE_CNPJ.slice(-4),
      }),
      status: "enviado",
      orcamentoId: ids.orcEnviado,
    },
  });

  // Phase C — campaigns + help center (no auto-send)
  await prisma.contactLabel.create({
    data: {
      id: "ctl_cliente_info",
      tenantId: TENANT,
      contactId: ids.contactCliente,
      labelId: "lbl_info",
    },
  });
  await prisma.campaign.create({
    data: {
      id: "cmp_one_off_draft",
      tenantId: TENANT,
      title: "Promoção frios (rascunho)",
      description: "One-off stub — não enviar no boot",
      kind: "one_off",
      status: "draft",
      inboxId: ids.inboxWa,
      channel: "whatsapp",
      audienceLabelIdsJson: JSON.stringify(["lbl_info"]),
      templateKey: "campaign.wa_one_off",
      createdByUserId: ids.admin,
    },
  });
  await prisma.campaign.create({
    data: {
      id: "cmp_ongoing_draft",
      tenantId: TENANT,
      title: "Banner loja (widget)",
      kind: "ongoing",
      status: "draft",
      channel: "whatsapp",
      audienceLabelIdsJson: JSON.stringify([]),
      message: "Confira nossas ofertas no atacado.",
      displayStatus: "awaiting_widget",
      createdByUserId: ids.admin,
      // inbox linked after Phase D widget inbox is created below
    },
  });

  await prisma.portal.create({
    data: {
      id: "por_ajuda",
      tenantId: TENANT,
      name: "Central de Ajuda Casa dos Frios",
      slug: "casa-dos-frios-ajuda",
      headerText: "Como podemos ajudar?",
      homepageMd: "# Central de Ajuda\n\nArtigos em **português (Brasil)**.",
      locale: "pt-BR",
      enabled: true,
    },
  });
  await prisma.helpCategory.create({
    data: {
      id: "hcat_pedidos",
      tenantId: TENANT,
      portalId: "por_ajuda",
      name: "Pedidos",
      slug: "pedidos",
      description: "Dúvidas sobre pedidos e entrega",
      position: 0,
    },
  });
  await prisma.article.createMany({
    data: [
      {
        id: "art_como_pedir",
        tenantId: TENANT,
        portalId: "por_ajuda",
        categoryId: "hcat_pedidos",
        title: "Como fazer um pedido",
        slug: "como-fazer-um-pedido",
        contentMd: "## Passo a passo\n\n1. Acesse a loja\n2. Adicione itens\n3. Envie o pedido",
        contentHtml:
          "<h2>Passo a passo</h2>\n<p>1. Acesse a loja 2. Adicione itens 3. Envie o pedido</p>",
        status: "published",
        authorUserId: ids.admin,
        publishedAt: now,
        position: 0,
      },
      {
        id: "art_rascunho",
        tenantId: TENANT,
        portalId: "por_ajuda",
        categoryId: "hcat_pedidos",
        title: "Artigo interno (rascunho)",
        slug: "artigo-rascunho",
        contentMd: "Conteúdo ainda não publicado.",
        contentHtml: "<p>Conteúdo ainda não publicado.</p>",
        status: "draft",
        authorUserId: ids.admin,
        position: 1,
      },
    ],
  });

  // Phase D — Loja widget + stub channels + email template
  const widgetToken = "wt_casa_dos_frios_demo";
  const widgetHmac = sealSecrets({ hmac_secret: "seed-widget-hmac-not-for-production" });
  await prisma.inbox.create({
    data: {
      id: ids.inboxWidget,
      tenantId: TENANT,
      name: "Loja — chat",
      channelType: "web_widget",
      greeting: "Olá! Como podemos ajudar?",
      oooMessage: "Fora do horário — deixe sua mensagem.",
      lockToSingleConversation: true,
      timezone: "America/Sao_Paulo",
    },
  });
  await prisma.channelWebsiteWidget.create({
    data: {
      id: ids.channelWidget,
      tenantId: TENANT,
      inboxId: ids.inboxWidget,
      websiteToken: widgetToken,
      hmacSecretCiphertext: widgetHmac,
      allowedOriginsJson: JSON.stringify([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]),
      preChatFieldsJson: JSON.stringify([
        { name: "nome", type: "text", label_pt: "Nome", required: true },
        { name: "email", type: "email", label_pt: "E-mail", required: false },
        { name: "empresa", type: "text", label_pt: "Empresa", required: false },
      ]),
      welcomeTitle: "Casa dos Frios",
      widgetColor: "#7A1F1F",
      continuity: "session",
      connectionStatus: "ready_stub",
    },
  });
  await prisma.inboxMember.createMany({
    data: [
      { id: "inm_widget_admin", tenantId: TENANT, inboxId: ids.inboxWidget, userId: ids.admin },
      {
        id: "inm_widget_vendedor",
        tenantId: TENANT,
        inboxId: ids.inboxWidget,
        userId: ids.vendedor,
      },
    ],
  });

  await prisma.emailTemplate.create({
    data: {
      id: ids.emailTemplate,
      tenantId: TENANT,
      name: "Resposta padrão",
      slug: "resposta-padrao",
      subjectTemplate: "Re: {{contact.nome}} — Casa dos Frios",
      bodyHtmlTemplate:
        "<p>Olá {{contact.nome}},</p><p>{{message}}</p><p>Atenciosamente,<br/>Casa dos Frios</p>",
    },
  });

  await prisma.inbox.create({
    data: {
      id: ids.inboxEmail,
      tenantId: TENANT,
      name: "E-mail (stub)",
      channelType: "email",
    },
  });
  await prisma.channelEmail.create({
    data: {
      id: ids.channelEmail,
      tenantId: TENANT,
      inboxId: ids.inboxEmail,
      provider: "smtp_imap",
      fromEmailDisplay: "atendimento@casadosfrios.local",
      emailTemplateId: ids.emailTemplate,
      connectionStatus: "not_configured",
    },
  });
  await prisma.inboxMember.create({
    data: {
      id: "inm_email_admin",
      tenantId: TENANT,
      inboxId: ids.inboxEmail,
      userId: ids.admin,
    },
  });

  await prisma.inbox.create({
    data: {
      id: ids.inboxApi,
      tenantId: TENANT,
      name: "API client (stub)",
      channelType: "api",
    },
  });
  await prisma.channelApi.create({
    data: {
      id: ids.channelApi,
      tenantId: TENANT,
      inboxId: ids.inboxApi,
      connectionStatus: "not_configured",
    },
  });
  await prisma.inboxMember.create({
    data: {
      id: "inm_api_admin",
      tenantId: TENANT,
      inboxId: ids.inboxApi,
      userId: ids.admin,
    },
  });

  await prisma.inbox.create({
    data: {
      id: ids.inboxIg,
      tenantId: TENANT,
      name: "Instagram (stub)",
      channelType: "instagram",
    },
  });
  await prisma.channelSocial.create({
    data: {
      id: ids.channelIg,
      tenantId: TENANT,
      inboxId: ids.inboxIg,
      provider: "instagram",
      connectionStatus: "not_configured",
    },
  });
  await prisma.inboxMember.create({
    data: {
      id: "inm_ig_admin",
      tenantId: TENANT,
      inboxId: ids.inboxIg,
      userId: ids.admin,
    },
  });

  await prisma.campaign.update({
    where: { id: "cmp_ongoing_draft" },
    data: { inboxId: ids.inboxWidget },
  });

  console.log("Seed OK — tenant casa-dos-frios CRM Phase D (password Demo@1234)");
  console.log(`Widget website_token (demo): ${widgetToken}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
