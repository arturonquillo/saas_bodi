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
  skuInativo: "sku_inativo",
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
  inboxVoice: "inx_voice_stub",
  channelVoice: "cvo_voice_stub",
  slaPadrao: "sla_padrao",
  captainCopilot: "cpa_copilot",
  customRoleReports: "rol_relatorios",
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
  await prisma.captainSuggestion.deleteMany();
  await prisma.captainAssistant.deleteMany();
  await prisma.conversationSla.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.agentCapacity.deleteMany();
  await prisma.integrationInstall.deleteMany();
  await prisma.dashboardApp.deleteMany();
  await prisma.mfaDevice.deleteMany();
  await prisma.samlConfig.deleteMany();
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
  await prisma.channelVoice.deleteMany();
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
  await prisma.customRole.deleteMany();
  await prisma.slaPolicy.deleteMany();
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
        descricao: "Picanha resfriada por kg — demo desconto.",
        unidade: "kg",
        precoAtacadoCentavos: 8990,
        descontoMaxPct: 10,
        qtdMinAtacado: 1,
        visivelLoja: true,
        ativo: true,
      },
      {
        id: ids.skuLinguica,
        tenantId: TENANT,
        codigo: "LINGUICA-CX",
        nome: "Linguiça Toscana (caixa)",
        unidade: "cx",
        precoAtacadoCentavos: 12900,
        descontoMaxPct: 0,
        qtdMinAtacado: 5,
        visivelLoja: true,
        ativo: true,
      },
      {
        id: ids.skuOculto,
        tenantId: TENANT,
        codigo: "OCULTO-INTERNO",
        nome: "Corte interno (não vitrine)",
        unidade: "un",
        precoAtacadoCentavos: 4500,
        descontoMaxPct: 0,
        qtdMinAtacado: 1,
        visivelLoja: false,
        ativo: true,
      },
      {
        id: ids.skuEsgotado,
        tenantId: TENANT,
        codigo: "ESGOTADO-VITRINE",
        nome: "Fraldinha (esgotada)",
        unidade: "un",
        precoAtacadoCentavos: 6990,
        descontoMaxPct: 0,
        qtdMinAtacado: 1,
        visivelLoja: true,
        ativo: true,
      },
      {
        id: ids.skuInativo,
        tenantId: TENANT,
        codigo: "INATIVO-DEMO",
        nome: "SKU inativo (demo)",
        unidade: "un",
        precoAtacadoCentavos: 1990,
        descontoMaxPct: 0,
        qtdMinAtacado: 1,
        visivelLoja: true,
        ativo: false,
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
      { skuId: ids.skuInativo, tenantId: TENANT, onHand: 5, reserved: 0 },
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
            unidadeSnapshot: "cx",
            qty: 5,
            precoListaCentavos: 12900,
            descontoPct: 0,
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
            unidadeSnapshot: "kg",
            qty: 2,
            precoListaCentavos: 8990,
            descontoPct: 0,
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
            unidadeSnapshot: "kg",
            qty: 5,
            precoListaCentavos: 8990,
            descontoPct: 0,
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
        id: "mov_inicial_picanha",
        tenantId: TENANT,
        skuId: ids.skuPicanha,
        type: "adjust",
        deltaOnHand: 40,
        deltaReserved: 0,
        reason: "estoque_inicial",
        actorUserId: ids.admin,
      },
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
      headerText: "Guia do usuário — operadores e clientes",
      homepageMd:
        "# Bem-vindo\n\nArtigos em **português (Brasil)** para quem usa o SaaS (admin/vendedor) e a Loja (cliente CNPJ).\n\nNo SaaS, abra **Guia** no menu. Na Loja, use **Ajuda**. A autoria fica em **Central de ajuda** (admin).",
      locale: "pt-BR",
      enabled: true,
    },
  });

  await prisma.helpCategory.createMany({
    data: [
      {
        id: "hcat_operador",
        tenantId: TENANT,
        portalId: "por_ajuda",
        name: "Operador SaaS",
        slug: "operador-saas",
        description: "Login, conversas, cadastros, orçamentos e pedidos",
        position: 0,
      },
      {
        id: "hcat_estoque",
        tenantId: TENANT,
        portalId: "por_ajuda",
        name: "Estoque",
        slug: "estoque",
        description: "Produtos, preço, desconto e ajustes",
        position: 1,
      },
      {
        id: "hcat_campanhas_tema",
        tenantId: TENANT,
        portalId: "por_ajuda",
        name: "Campanhas e aparência",
        slug: "campanhas-tema",
        description: "Campanhas stub e tema da marca",
        position: 2,
      },
      {
        id: "hcat_loja",
        tenantId: TENANT,
        portalId: "por_ajuda",
        name: "Loja (clientes)",
        slug: "loja",
        description: "Cadastro CNPJ, pedidos e WhatsApp",
        position: 3,
      },
    ],
  });

  function helpArticle(input: {
    id: string;
    categoryId: string;
    title: string;
    slug: string;
    md: string;
    html: string;
    status?: "published" | "draft";
    position: number;
  }) {
    const published = (input.status ?? "published") === "published";
    return {
      id: input.id,
      tenantId: TENANT,
      portalId: "por_ajuda",
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      contentMd: input.md,
      contentHtml: input.html,
      status: input.status ?? "published",
      authorUserId: ids.admin,
      publishedAt: published ? now : null,
      position: input.position,
    };
  }

  await prisma.article.createMany({
    data: [
      helpArticle({
        id: "art_entrar_saas",
        categoryId: "hcat_operador",
        title: "Entrar no SaaS",
        slug: "entrar-no-saas",
        position: 0,
        md: `## Como entrar

1. Abra **/saas/entrar**.
2. Use o e-mail da membership do tenant Casa dos Frios e a senha.
3. Em sucesso, a sessão fica no cookie HttpOnly e o destino padrão é **Conversas**.

## Papéis

- **admin** — configuração CRM, estoque completo, campanhas, tema, usuários.
- **vendedor** — conversas, comércio e leitura de estoque; desconto até o teto do SKU.

A UI esconde ações; a API reforça o papel.

## Contas de demo

Senha compartilhada: **Demo@1234**.

- admin@casadosfrios.local
- vendedor@casadosfrios.local

Sair: menu do avatar no canto superior → **Sair**.`,
        html: `<h2>Como entrar</h2>
<ol>
<li>Abra <strong>/saas/entrar</strong>.</li>
<li>Use o e-mail da membership do tenant Casa dos Frios e a senha.</li>
<li>Em sucesso, a sessão fica no cookie HttpOnly e o destino padrão é <strong>Conversas</strong>.</li>
</ol>
<h2>Papéis</h2>
<ul>
<li><strong>admin</strong> — configuração CRM, estoque completo, campanhas, tema, usuários.</li>
<li><strong>vendedor</strong> — conversas, comércio e leitura de estoque; desconto até o teto do SKU.</li>
</ul>
<p>A UI esconde ações; a API reforça o papel.</p>
<h2>Contas de demo</h2>
<p>Senha compartilhada: <strong>Demo@1234</strong>.</p>
<ul>
<li>admin@casadosfrios.local</li>
<li>vendedor@casadosfrios.local</li>
</ul>
<p>Sair: menu do avatar no canto superior → <strong>Sair</strong>.</p>`,
      }),
      helpArticle({
        id: "art_conversas",
        categoryId: "hcat_operador",
        title: "Conversas (CRM)",
        slug: "conversas-crm",
        position: 1,
        md: `## Mesa de atendimento

Home pós-login: **/saas/conversas**. Lista + thread + painel de contato/comércio.

## Fluxo diário

1. Filtre por status (aberta / pendente / adiada / resolvida), responsável e labels.
2. Responda na thread — se o canal WhatsApp estiver **live**, a entrega usa Meta Cloud API; em stub, a entrega é simulada.
3. Use notas privadas, labels e respostas rápidas.
4. Acompanhe cadastro/orçamento pelos atalhos do contato.

Admin pode **Simular mensagem** na caixa WhatsApp para demo, ou conectar Meta (ver artigo **Conectar WhatsApp**).

O widget da Loja cai na **mesma** mesa de Conversas.`,
        html: `<h2>Mesa de atendimento</h2>
<p>Home pós-login: <strong>/saas/conversas</strong>. Lista + thread + painel de contato/comércio.</p>
<h2>Fluxo diário</h2>
<ol>
<li>Filtre por status (aberta / pendente / adiada / resolvida), responsável e labels.</li>
<li>Responda na thread — se o canal WhatsApp estiver <strong>live</strong>, a entrega usa Meta Cloud API; em stub, a entrega é simulada.</li>
<li>Use notas privadas, labels e respostas rápidas.</li>
<li>Acompanhe cadastro/orçamento pelos atalhos do contato.</li>
</ol>
<p>Admin pode <strong>Simular mensagem</strong> na caixa WhatsApp para demo, ou conectar Meta (ver artigo <strong>Conectar WhatsApp</strong>).</p>
<p>O widget da Loja cai na <strong>mesma</strong> mesa de Conversas.</p>`,
      }),
      helpArticle({
        id: "art_conectar_whatsapp",
        categoryId: "hcat_operador",
        title: "Conectar WhatsApp",
        slug: "conectar-whatsapp",
        position: 2,
        md: `## Objetivo

Ligar a caixa WhatsApp do CRM à **Meta Cloud API** (envio e recebimento reais).

## Valores que você cola do Meta Business

1. **Phone Number ID**
2. **WhatsApp Business Account ID (WABA)**
3. **Access Token permanente** (não use o token de 24h em produção)
4. **App Secret** (assinatura do webhook)
5. **Verify Token** (você escolhe; igual no Meta e no CRM)

## Passos no SaaS

1. Abra **CRM → Caixas → WhatsApp → Canal**.
2. Preencha telefone E.164, Phone Number ID, WABA e os três segredos → **Salvar**.
3. Copie a **URL do webhook** exibida (ex.: \`/api/webhooks/whatsapp/inx_wa_default\`).
4. No Meta Developer → WhatsApp → Configuration: cole a URL + Verify Token → Verify and Save.
5. Assine o campo **messages**.
6. No CRM clique **Conectar Meta (live)**.
7. Teste: mensagem do celular → aparece em **/saas/conversas**; resposta do agente sai pela Cloud API.

**Simular mensagem** continua útil sem Meta. Outros canais (e-mail, SMS, redes) seguem em stub.

## Segurança

Tokens nunca são mostrados de novo em texto claro. O webhook valida \`X-Hub-Signature-256\` com o App Secret.`,
        html: `<h2>Objetivo</h2>
<p>Ligar a caixa WhatsApp do CRM à <strong>Meta Cloud API</strong> (envio e recebimento reais).</p>
<h2>Valores que você cola do Meta Business</h2>
<ol>
<li><strong>Phone Number ID</strong></li>
<li><strong>WhatsApp Business Account ID (WABA)</strong></li>
<li><strong>Access Token permanente</strong> (não use o token de 24h em produção)</li>
<li><strong>App Secret</strong> (assinatura do webhook)</li>
<li><strong>Verify Token</strong> (você escolhe; igual no Meta e no CRM)</li>
</ol>
<h2>Passos no SaaS</h2>
<ol>
<li>Abra <strong>CRM → Caixas → WhatsApp → Canal</strong>.</li>
<li>Preencha telefone E.164, Phone Number ID, WABA e os três segredos → <strong>Salvar</strong>.</li>
<li>Copie a <strong>URL do webhook</strong> exibida (ex.: <code>/api/webhooks/whatsapp/inx_wa_default</code>).</li>
<li>No Meta Developer → WhatsApp → Configuration: cole a URL + Verify Token → Verify and Save.</li>
<li>Assine o campo <strong>messages</strong>.</li>
<li>No CRM clique <strong>Conectar Meta (live)</strong>.</li>
<li>Teste: mensagem do celular → aparece em <strong>/saas/conversas</strong>; resposta do agente sai pela Cloud API.</li>
</ol>
<p><strong>Simular mensagem</strong> continua útil sem Meta. Outros canais (e-mail, SMS, redes) seguem em stub.</p>
<h2>Segurança</h2>
<p>Tokens nunca são mostrados de novo em texto claro. O webhook valida <code>X-Hub-Signature-256</code> com o App Secret.</p>`,
      }),
      helpArticle({
        id: "art_cadastros",
        categoryId: "hcat_operador",
        title: "Cadastros CNPJ",
        slug: "cadastros-cnpj",
        position: 3,
        md: `## Onde fica

**/saas/cadastros** — fila de solicitações da Loja.

## Aprovar ou recusar

1. Abra o cadastro pendente.
2. Confira CNPJ, razão social e contato.
3. **Aprovar** libera checkout na Loja; **Recusar** pede motivo.

Somente cliente **aprovado** compra. Prospecto pode entrar na Loja, mas o checkout fica bloqueado.`,
        html: `<h2>Onde fica</h2>
<p><strong>/saas/cadastros</strong> — fila de solicitações da Loja.</p>
<h2>Aprovar ou recusar</h2>
<ol>
<li>Abra o cadastro pendente.</li>
<li>Confira CNPJ, razão social e contato.</li>
<li><strong>Aprovar</strong> libera checkout na Loja; <strong>Recusar</strong> pede motivo.</li>
</ol>
<p>Somente cliente <strong>aprovado</strong> compra. Prospecto pode entrar na Loja, mas o checkout fica bloqueado.</p>`,
      }),
      helpArticle({
        id: "art_orcamentos_pedidos",
        categoryId: "hcat_operador",
        title: "Orçamentos e pedidos",
        slug: "orcamentos-e-pedidos",
        position: 3,
        md: `## Orçamentos

Cada lista do pipeline (Orçamentos, Pedidos, Vendas) mostra uma linha curta sob o título — o Guia abaixo é o detalhe.

1. **/saas/orcamentos** → **Novo orçamento**.
2. Escolha cliente aprovado e SKUs ativos.
3. Informe quantidade e, se permitido, **desconto (%)**.
4. Envie o orçamento — o cliente vê em **Meus documentos** na Loja.

## Pedidos

1. **/saas/pedidos** → **Novo pedido**, ou a partir de orçamento aceito / Loja.
2. Pedido **confirmado** reserva estoque no ledger único.
3. Avance: em separação → despachado (baixa estoque) → entregue.
4. Faturamento interno (stub) fica em **Vendas** — sem NF-e.`,
        html: `<p>Cada lista do pipeline (Orçamentos, Pedidos, Vendas) mostra uma linha curta sob o título — o Guia abaixo é o detalhe.</p>
<h2>Orçamentos</h2>
<ol>
<li><strong>/saas/orcamentos</strong> → <strong>Novo orçamento</strong>.</li>
<li>Escolha cliente aprovado e SKUs ativos.</li>
<li>Informe quantidade e, se permitido, <strong>desconto (%)</strong>.</li>
<li>Envie o orçamento — o cliente vê em <strong>Meus documentos</strong> na Loja.</li>
</ol>
<h2>Pedidos</h2>
<ol>
<li><strong>/saas/pedidos</strong> → <strong>Novo pedido</strong>, ou a partir de orçamento aceito / Loja.</li>
<li>Pedido <strong>confirmado</strong> reserva estoque no ledger único.</li>
<li>Avance: em separação → despachado (baixa estoque) → entregue.</li>
<li>Faturamento interno (stub) fica em <strong>Vendas</strong> — sem NF-e.</li>
</ol>`,
      }),
      helpArticle({
        id: "art_estoque_produto",
        categoryId: "hcat_estoque",
        title: "Criar produto e preço",
        slug: "criar-produto-e-preco",
        position: 0,
        md: `## Quem pode

Só **admin** cria/edita produto. Vendedor lista e abre detalhe.

## Novo produto

1. **/saas/estoque** → **Novo produto**.
2. Preencha código (SKU), nome, unidade, **preço de venda**, desconto máx. %, MOQ, estoque inicial.
3. Marque **ativo** e **visível na loja** conforme a vitrine.

## Campos úteis

- **Preço de venda** — lista atacado (única nesta fase).
- **Desconto máx. (%)** — teto do vendedor nas linhas.
- **Ativo** — inativo some da Loja e dos pickers.
- **Visível na loja** — só afeta a projeção da Loja.

Um único ledger: disponível = em mão − reservado.`,
        html: `<h2>Quem pode</h2>
<p>Só <strong>admin</strong> cria/edita produto. Vendedor lista e abre detalhe.</p>
<h2>Novo produto</h2>
<ol>
<li><strong>/saas/estoque</strong> → <strong>Novo produto</strong>.</li>
<li>Preencha código (SKU), nome, unidade, <strong>preço de venda</strong>, desconto máx. %, MOQ, estoque inicial.</li>
<li>Marque <strong>ativo</strong> e <strong>visível na loja</strong> conforme a vitrine.</li>
</ol>
<h2>Campos úteis</h2>
<ul>
<li><strong>Preço de venda</strong> — lista atacado (única nesta fase).</li>
<li><strong>Desconto máx. (%)</strong> — teto do vendedor nas linhas.</li>
<li><strong>Ativo</strong> — inativo some da Loja e dos pickers.</li>
<li><strong>Visível na loja</strong> — só afeta a projeção da Loja.</li>
</ul>
<p>Um único ledger: disponível = em mão − reservado.</p>`,
      }),
      helpArticle({
        id: "art_desconto_linha",
        categoryId: "hcat_estoque",
        title: "Desconto de linha",
        slug: "desconto-de-linha",
        position: 1,
        md: `## Em orçamento ou pedido

1. Escolha um SKU ativo no picker (mostra lista e disponível).
2. Informe quantidade e **Desconto (%)**.
3. O preview mostra lista → líquido; o servidor congela os valores.

## Regras

- Vendedor não ultrapassa o **desconto máx.** do SKU.
- Admin pode exceder o teto.
- A Loja **não** tem desconto — sempre preço de lista.`,
        html: `<h2>Em orçamento ou pedido</h2>
<ol>
<li>Escolha um SKU ativo no picker (mostra lista e disponível).</li>
<li>Informe quantidade e <strong>Desconto (%)</strong>.</li>
<li>O preview mostra lista → líquido; o servidor congela os valores.</li>
</ol>
<h2>Regras</h2>
<ul>
<li>Vendedor não ultrapassa o <strong>desconto máx.</strong> do SKU.</li>
<li>Admin pode exceder o teto.</li>
<li>A Loja <strong>não</strong> tem desconto — sempre preço de lista.</li>
</ul>`,
      }),
      helpArticle({
        id: "art_ajuste_estoque",
        categoryId: "hcat_estoque",
        title: "Ajustar quantidade",
        slug: "ajustar-quantidade",
        position: 2,
        md: `## Ajuste manual (admin)

1. Abra **/saas/estoque/[produto]**.
2. Use **Ajustar quantidade** com delta ≠ 0 e **motivo**.
3. O movimento tipo ajuste atualiza em mão; o histórico lista Ajuste, Reserva, Liberação e Consumo.

Pedidos confirmados / cancelados / despachados movem o **mesmo** ledger automaticamente.`,
        html: `<h2>Ajuste manual (admin)</h2>
<ol>
<li>Abra <strong>/saas/estoque/[produto]</strong>.</li>
<li>Use <strong>Ajustar quantidade</strong> com delta ≠ 0 e <strong>motivo</strong>.</li>
<li>O movimento tipo ajuste atualiza em mão; o histórico lista Ajuste, Reserva, Liberação e Consumo.</li>
</ol>
<p>Pedidos confirmados / cancelados / despachados movem o <strong>mesmo</strong> ledger automaticamente.</p>`,
      }),
      helpArticle({
        id: "art_campanhas",
        categoryId: "hcat_campanhas_tema",
        title: "Campanhas",
        slug: "campanhas",
        position: 0,
        md: `## Onde

**/saas/crm/campanhas** (admin).

## O que esperar

- Campanhas **one-off** e **contínuas** são autoráveis.
- Envio é **simulado** (outbox stub) — sem Meta, Twilio ou SMS real.
- Contínuas podem ficar “aguardando widget” até o widget da Loja exibir o texto.

Não dispare envio em massa esperando entrega real nesta fase.`,
        html: `<h2>Onde</h2>
<p><strong>/saas/crm/campanhas</strong> (admin).</p>
<h2>O que esperar</h2>
<ul>
<li>Campanhas <strong>one-off</strong> e <strong>contínuas</strong> são autoráveis.</li>
<li>Envio é <strong>simulado</strong> (outbox stub) — sem Meta, Twilio ou SMS real.</li>
<li>Contínuas podem ficar “aguardando widget” até o widget da Loja exibir o texto.</li>
</ul>
<p>Não dispare envio em massa esperando entrega real nesta fase.</p>`,
      }),
      helpArticle({
        id: "art_tema",
        categoryId: "hcat_campanhas_tema",
        title: "Tema e aparência",
        slug: "tema-e-aparencia",
        position: 1,
        md: `## Marca do tenant

Admin: **/saas/tema** — cores e marca aplicadas na Loja e no chrome.

## Modo claro / escuro

Use o controle de **Aparência** no header (SaaS, Loja e Central de Ajuda). A escolha persiste no navegador.

Claro, escuro ou sistema — funciona junto com as cores da marca.`,
        html: `<h2>Marca do tenant</h2>
<p>Admin: <strong>/saas/tema</strong> — cores e marca aplicadas na Loja e no chrome.</p>
<h2>Modo claro / escuro</h2>
<p>Use o controle de <strong>Aparência</strong> no header (SaaS, Loja e Central de Ajuda). A escolha persiste no navegador.</p>
<p>Claro, escuro ou sistema — funciona junto com as cores da marca.</p>`,
      }),
      helpArticle({
        id: "art_loja_cadastro",
        categoryId: "hcat_loja",
        title: "Cadastro na Loja",
        slug: "cadastro-na-loja",
        position: 0,
        md: `## Solicitação CNPJ

1. Abra **/loja/cadastro**.
2. Informe CNPJ, razão social, contato, WhatsApp, e-mail e senha.
3. Status inicial: **pendente** — aguarde aprovação do operador em Cadastros.

CNPJ inválido bloqueia o envio. Conta demo aprovada: cliente@mercadoexemplo.local / **Demo@1234**.`,
        html: `<h2>Solicitação CNPJ</h2>
<ol>
<li>Abra <strong>/loja/cadastro</strong>.</li>
<li>Informe CNPJ, razão social, contato, WhatsApp, e-mail e senha.</li>
<li>Status inicial: <strong>pendente</strong> — aguarde aprovação do operador em Cadastros.</li>
</ol>
<p>CNPJ inválido bloqueia o envio. Conta demo aprovada: cliente@mercadoexemplo.local / <strong>Demo@1234</strong>.</p>`,
      }),
      helpArticle({
        id: "art_loja_pedidos",
        categoryId: "hcat_loja",
        title: "Pedidos na Loja",
        slug: "pedidos-na-loja",
        position: 1,
        md: `## Comprar (cliente aprovado)

1. Entre em **/loja/entrar**.
2. Navegue o catálogo (só SKUs ativos e visíveis com estoque).
3. Adicione ao carrinho respeitando quantidade mínima.
4. **Enviar pedido** confirma e reserva estoque.

## Documentos

**/loja/meus-docs** lista orçamentos e pedidos. Aceite ou recuse orçamentos enviados pelo SaaS.

Prospecto vê banner de cadastro pendente; checkout bloqueado.`,
        html: `<h2>Comprar (cliente aprovado)</h2>
<ol>
<li>Entre em <strong>/loja/entrar</strong>.</li>
<li>Navegue o catálogo (só SKUs ativos e visíveis com estoque).</li>
<li>Adicione ao carrinho respeitando quantidade mínima.</li>
<li><strong>Enviar pedido</strong> confirma e reserva estoque.</li>
</ol>
<h2>Documentos</h2>
<p><strong>/loja/meus-docs</strong> lista orçamentos e pedidos. Aceite ou recuse orçamentos enviados pelo SaaS.</p>
<p>Prospecto vê banner de cadastro pendente; checkout bloqueado.</p>`,
      }),
      helpArticle({
        id: "art_loja_whatsapp",
        categoryId: "hcat_loja",
        title: "WhatsApp e chat na Loja",
        slug: "whatsapp-e-chat-na-loja",
        position: 2,
        md: `## Botão WhatsApp

No header/rodapé da Loja, **WhatsApp** abre o número comercial do tenant (wa.me).

## Widget de chat

O chat embutido (quando ativo) fala com a mesa **/saas/conversas**. Mensagens entram na mesma Conversation dos operadores.

Não há Meta Cloud ao vivo nesta fase — canais ficam em “Pronto para conectar” / stub.`,
        html: `<h2>Botão WhatsApp</h2>
<p>No header/rodapé da Loja, <strong>WhatsApp</strong> abre o número comercial do tenant (wa.me).</p>
<h2>Widget de chat</h2>
<p>O chat embutido (quando ativo) fala com a mesa <strong>/saas/conversas</strong>. Mensagens entram na mesma Conversation dos operadores.</p>
<p>Não há Meta Cloud ao vivo nesta fase — canais ficam em “Pronto para conectar” / stub.</p>`,
      }),
      helpArticle({
        id: "art_como_pedir",
        categoryId: "hcat_loja",
        title: "Como fazer um pedido (resumo)",
        slug: "como-fazer-um-pedido",
        position: 3,
        md: `## Passo a passo

1. Cadastre-se com CNPJ e aguarde aprovação.
2. Entre na Loja e adicione itens ao carrinho.
3. Envie o pedido — ou peça orçamento pelo WhatsApp / chat.`,
        html: `<h2>Passo a passo</h2>
<ol>
<li>Cadastre-se com CNPJ e aguarde aprovação.</li>
<li>Entre na Loja e adicione itens ao carrinho.</li>
<li>Envie o pedido — ou peça orçamento pelo WhatsApp / chat.</li>
</ol>`,
      }),
      helpArticle({
        id: "art_rascunho",
        categoryId: "hcat_operador",
        title: "Artigo interno (rascunho)",
        slug: "artigo-rascunho",
        status: "draft",
        position: 99,
        md: "Conteúdo ainda não publicado.",
        html: "<p>Conteúdo ainda não publicado.</p>",
      }),
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


  // Phase E — SLA, Captain stub, capacity, custom role, voice, security stubs
  await prisma.slaPolicy.create({
    data: {
      id: ids.slaPadrao,
      tenantId: TENANT,
      name: "Padrão atendimento",
      frtSeconds: 900,
      nrtSeconds: 1800,
      rtSeconds: 86400,
      active: true,
      description: "FRT 15m / NRT 30m / RT 24h",
    },
  });
  await prisma.inbox.update({
    where: { id: ids.inboxWa },
    data: { defaultSlaPolicyId: ids.slaPadrao },
  });
  await prisma.agentCapacity.createMany({
    data: [
      {
        id: "acap_admin",
        tenantId: TENANT,
        userId: ids.admin,
        maxOpenConversations: 20,
      },
      {
        id: "acap_vendedor",
        tenantId: TENANT,
        userId: ids.vendedor,
        maxOpenConversations: 20,
      },
    ],
  });
  await prisma.captainAssistant.create({
    data: {
      id: ids.captainCopilot,
      tenantId: TENANT,
      name: "Copiloto stub",
      mode: "copilot",
      systemPromptStub: "Sugira respostas educadas em pt-BR.",
      active: true,
    },
  });
  await prisma.samlConfig.create({
    data: {
      id: "sml_casa",
      tenantId: TENANT,
      enabled: false,
      jitProvision: false,
      spEntityId: `urn:saas-frota:sp:${TENANT}`,
    },
  });
  await prisma.customRole.create({
    data: {
      id: ids.customRoleReports,
      tenantId: TENANT,
      name: "Analista de relatórios",
      description: "Somente report_manage — não atribuído no seed",
      permissionsJson: JSON.stringify(["report_manage"]),
    },
  });
  await prisma.dashboardApp.create({
    data: {
      id: "dap_exemplo",
      tenantId: TENANT,
      title: "App exemplo",
      url: "https://example.com/app",
      enabled: false,
      position: 0,
    },
  });
  await prisma.inbox.create({
    data: {
      id: ids.inboxVoice,
      tenantId: TENANT,
      name: "Voz (stub)",
      channelType: "voice",
    },
  });
  await prisma.channelVoice.create({
    data: {
      id: ids.channelVoice,
      tenantId: TENANT,
      inboxId: ids.inboxVoice,
      provider: "twilio_voice",
      connectionStatus: "not_configured",
    },
  });
  await prisma.inboxMember.create({
    data: {
      id: "inm_voice_admin",
      tenantId: TENANT,
      inboxId: ids.inboxVoice,
      userId: ids.admin,
    },
  });

  console.log("Seed OK — tenant casa-dos-frios CRM Phase E (password Demo@1234)");

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
