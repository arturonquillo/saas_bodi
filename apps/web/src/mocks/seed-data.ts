import { SEED_THEME, availableQty, maskCnpj, type ThemeTokens } from "@saas-frota/shared";
import type {
  CadastroDto,
  EstoqueItemDto,
  InboxThreadDetailDto,
  OrcamentoDto,
  OutboxDto,
  PedidoDto,
  SaasConfigDto,
  UserDto,
  VendaDto,
} from "@saas-frota/shared";

export const TENANT_ID = "tenant_casa_dos_frios";
export const TENANT_SLUG = "casa-dos-frios";
export const DEMO_PASSWORD = "Demo@1234";

export const USERS: UserDto[] = [
  {
    id: "user_admin",
    email: "admin@casadosfrios.local",
    nome: "Admin Casa",
    saas_role: "admin",
    ativo: true,
  },
  {
    id: "user_vendedor",
    email: "vendedor@casadosfrios.local",
    nome: "Vendedor Demo",
    saas_role: "vendedor",
    ativo: true,
  },
  {
    id: "user_cliente",
    email: "cliente@mercadoexemplo.local",
    nome: "Maria Mercado",
    saas_role: "vendedor", // membership null on loja session; placeholder for UserDto
    ativo: true,
  },
  {
    id: "user_prospecto",
    email: "prospecto@novaloja.local",
    nome: "Pedro Prospecto",
    saas_role: "vendedor",
    ativo: true,
  },
];

/** Workers shown on /saas/usuarios */
export const LOJA_ONLY_EMAILS = new Set([
  "cliente@mercadoexemplo.local",
  "prospecto@novaloja.local",
]);


export function initialTheme(): ThemeTokens {
  return { ...SEED_THEME };
}

export function initialConfig(): SaasConfigDto {
  return {
    razao_social: "Casa dos Frios Distribuidora LTDA",
    nome_fantasia: "Casa dos Frios",
    cnpj_masked: maskCnpj("12345678000195"),
    whatsapp_comercial: "+5511988877766",
    canais_aviso: "whatsapp",
    loja_modo: "pedido_direto",
    default_vendedor_user_id: "user_vendedor",
  };
}

export function initialSkus(): EstoqueItemDto[] {
  const rows: Array<Omit<EstoqueItemDto, "available"> & { on_hand: number; reserved: number }> = [
    {
      id: "sku_picanha",
      sku: "PICANHA-KG",
      nome: "Picanha resfriada (kg)",
      on_hand: 40,
      reserved: 5,
      visivel_loja: true,
      preco_atacado_centavos: 8990,
      qtd_min_atacado: 1,
    },
    {
      id: "sku_linguica",
      sku: "LINGUICA-CX",
      nome: "Linguiça toscana (caixa)",
      on_hand: 30,
      reserved: 0,
      visivel_loja: true,
      preco_atacado_centavos: 12990,
      qtd_min_atacado: 5,
    },
    {
      id: "sku_oculto",
      sku: "OCULTO-INTERNO",
      nome: "Item interno (oculto)",
      on_hand: 10,
      reserved: 0,
      visivel_loja: false,
      preco_atacado_centavos: 1000,
      qtd_min_atacado: 1,
    },
    {
      id: "sku_esgotado",
      sku: "ESGOTADO-VITRINE",
      nome: "Costela bovina (esgotada)",
      on_hand: 3,
      reserved: 3,
      visivel_loja: true,
      preco_atacado_centavos: 5490,
      qtd_min_atacado: 1,
    },
  ];
  return rows.map((r) => ({ ...r, available: availableQty(r.on_hand, r.reserved) }));
}

export function initialCadastros(): CadastroDto[] {
  const now = new Date().toISOString();
  return [
    {
      id: "cad_pendente",
      status: "pendente",
      cnpj_masked: maskCnpj("34028316000103"),
      cnpj_registro_pendente: true,
      razao_social: "Nova Loja Alimentos LTDA",
      contato_nome: "Pedro Prospecto",
      email: "prospecto@novaloja.local",
      whatsapp: "+5511999990000",
      source: "loja",
      motivo_recusa: null,
      cliente_id: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "cad_aprovado",
      status: "aprovado",
      cnpj_masked: maskCnpj("11222333000181"),
      cnpj_registro_pendente: false,
      razao_social: "Mercado Exemplo LTDA",
      contato_nome: "Maria Mercado",
      email: "cliente@mercadoexemplo.local",
      whatsapp: "+5511911112222",
      source: "loja",
      motivo_recusa: null,
      cliente_id: "cli_mercado",
      created_at: now,
      updated_at: now,
    },
  ];
}

export const CLIENTES = [
  {
    id: "cli_mercado",
    user_id: "user_cliente",
    razao_social: "Mercado Exemplo LTDA",
    cnpj_masked: maskCnpj("11222333000181"),
    cnpj_digits: "11222333000181",
    whatsapp: "+5511911112222",
    status: "aprovado" as const,
    email: "cliente@mercadoexemplo.local",
  },
];

export function initialInbox(): InboxThreadDetailDto[] {
  const now = new Date().toISOString();
  return [
    {
      id: "th_cadastro",
      phone_e164: "+5511999990000",
      intent: "cadastro",
      preview: "Quero me cadastrar como atacadista",
      unread: true,
      updated_at: now,
      cadastro_request_id: "cad_pendente",
      orcamento_id: null,
      cliente_id: null,
      messages: [
        {
          id: "msg1",
          direction: "inbound",
          body: "Olá! Quero me cadastrar como atacadista. CNPJ 34.028.316/0001-03",
          simulated: true,
          created_at: now,
        },
      ],
    },
    {
      id: "th_orcamento",
      phone_e164: "+5511911112222",
      intent: "orcamento",
      preview: "Preciso de orçamento de picanha",
      unread: false,
      updated_at: now,
      cadastro_request_id: null,
      orcamento_id: "orc_enviado",
      cliente_id: "cli_mercado",
      messages: [
        {
          id: "msg2",
          direction: "inbound",
          body: "Bom dia, preciso de orçamento de picanha para sexta.",
          simulated: true,
          created_at: now,
        },
        {
          id: "msg3",
          direction: "outbound_note",
          body: "Registrado no outbox (stub).",
          simulated: false,
          created_at: now,
        },
      ],
    },
    {
      id: "th_info",
      phone_e164: "+5511977776666",
      intent: "info_empresa",
      preview: "Qual o horário de atendimento?",
      unread: true,
      updated_at: now,
      cadastro_request_id: null,
      orcamento_id: null,
      cliente_id: null,
      messages: [
        {
          id: "msg4",
          direction: "inbound",
          body: "Qual o horário de atendimento e área de entrega?",
          simulated: true,
          created_at: now,
        },
      ],
    },
  ];
}

export function initialOrcamentos(): OrcamentoDto[] {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  return [
    {
      id: "orc_enviado",
      numero: "ORC-1001",
      status: "enviado",
      valido_ate: future,
      cliente: {
        id: "cli_mercado",
        razao_social: "Mercado Exemplo LTDA",
        cnpj_masked: maskCnpj("11222333000181"),
        whatsapp: "+5511911112222",
        status: "aprovado",
      },
      prospect_phone: null,
      linhas: [
        {
          id: "ol1",
          sku_id: "sku_picanha",
          codigo_snapshot: "PICANHA-KG",
          nome_snapshot: "Picanha resfriada (kg)",
          qty: 10,
          unit_price_centavos: 8990,
        },
      ],
      history: [
        { from_status: null, to_status: "rascunho", created_at: now },
        { from_status: "rascunho", to_status: "enviado", created_at: now },
      ],
      total_centavos: 89900,
      pedido_id: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "orc_rascunho",
      numero: "ORC-1002",
      status: "rascunho",
      valido_ate: null,
      cliente: {
        id: "cli_mercado",
        razao_social: "Mercado Exemplo LTDA",
        cnpj_masked: maskCnpj("11222333000181"),
        whatsapp: "+5511911112222",
        status: "aprovado",
      },
      prospect_phone: null,
      linhas: [
        {
          id: "ol2",
          sku_id: "sku_linguica",
          codigo_snapshot: "LINGUICA-CX",
          nome_snapshot: "Linguiça toscana (caixa)",
          qty: 5,
          unit_price_centavos: 12990,
        },
      ],
      history: [{ from_status: null, to_status: "rascunho", created_at: now }],
      total_centavos: 64950,
      pedido_id: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

export function initialPedidos(): PedidoDto[] {
  const now = new Date().toISOString();
  return [
    {
      id: "ped_sep",
      numero: "PED-2001",
      status: "em_separacao",
      channel: "saas",
      cliente: {
        id: "cli_mercado",
        razao_social: "Mercado Exemplo LTDA",
        cnpj_masked: maskCnpj("11222333000181"),
        whatsapp: "+5511911112222",
        status: "aprovado",
      },
      linhas: [
        {
          id: "pl1",
          sku_id: "sku_picanha",
          codigo_snapshot: "PICANHA-KG",
          nome_snapshot: "Picanha resfriada (kg)",
          qty: 5,
          unit_price_centavos: 8990,
        },
      ],
      history: [
        { from_status: null, to_status: "confirmado", created_at: now },
        { from_status: "confirmado", to_status: "em_separacao", created_at: now },
      ],
      total_centavos: 44950,
      orcamento_id: null,
      venda_id: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

export function initialVendas(): VendaDto[] {
  return [];
}

export function initialOutbox(): OutboxDto[] {
  const now = new Date().toISOString();
  return [
    {
      id: "out_1",
      created_at: now,
      channel: "whatsapp",
      recipient_role: "customer",
      recipient: "+5511911112222",
      template_key: "orcamento.status",
      status: "enviado",
      orcamento_id: "orc_enviado",
      pedido_id: null,
      venda_id: null,
      cadastro_request_id: null,
    },
  ];
}
