import {
  LEGAL_ORCAMENTO,
  LEGAL_PEDIDO,
  LEGAL_VENDA,
  availableQty,
  isValidCnpj,
  maskCnpj,
  onlyDigits,
  type CadastroStatus,
  type OrcamentoStatus,
  type PedidoStatus,
  type SessionDto,
  type ThemeTokens,
  type VendaStatus,
  type WhatsappIntent,
} from "@saas-frota/shared";
import {
  CLIENTES,
  DEMO_PASSWORD,
  TENANT_ID,
  TENANT_SLUG,
  USERS,
  initialCadastros,
  initialConfig,
  initialInbox,
  initialOrcamentos,
  initialOutbox,
  initialPedidos,
  initialSkus,
  initialTheme,
  initialVendas,
} from "./seed-data";

type MockSession = {
  token: string;
  surface: "loja" | "saas";
  user_id: string;
};

type Store = {
  theme: ThemeTokens;
  config: ReturnType<typeof initialConfig>;
  skus: ReturnType<typeof initialSkus>;
  cadastros: ReturnType<typeof initialCadastros>;
  clientes: typeof CLIENTES;
  inbox: ReturnType<typeof initialInbox>;
  orcamentos: ReturnType<typeof initialOrcamentos>;
  pedidos: ReturnType<typeof initialPedidos>;
  vendas: ReturnType<typeof initialVendas>;
  outbox: ReturnType<typeof initialOutbox>;
  users: typeof USERS;
  sessions: MockSession[];
  seq: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __cdfMockStore: Store | undefined;
}

function createStore(): Store {
  return {
    theme: initialTheme(),
    config: initialConfig(),
    skus: initialSkus(),
    cadastros: initialCadastros(),
    clientes: [...CLIENTES],
    inbox: initialInbox(),
    orcamentos: initialOrcamentos(),
    pedidos: initialPedidos(),
    vendas: initialVendas(),
    outbox: initialOutbox(),
    users: USERS.map((u) => ({ ...u })),
    sessions: [],
    seq: 100,
  };
}

export function store(): Store {
  if (!globalThis.__cdfMockStore) globalThis.__cdfMockStore = createStore();
  return globalThis.__cdfMockStore;
}

export function resetStore() {
  globalThis.__cdfMockStore = createStore();
}

function nid(prefix: string) {
  const s = store();
  s.seq += 1;
  return `${prefix}_${s.seq}`;
}

function now() {
  return new Date().toISOString();
}

export function refreshSkuAvailable() {
  for (const sku of store().skus) {
    sku.available = availableQty(sku.on_hand, sku.reserved);
  }
}

export function sessionDto(sess: MockSession): SessionDto {
  const s = store();
  const user = s.users.find((u) => u.id === sess.user_id)!;
  if (sess.surface === "saas") {
    return {
      user_id: user.id,
      tenant_id: TENANT_ID,
      tenant_slug: TENANT_SLUG,
      surface: "saas",
      saas_role: user.saas_role,
      is_customer: false,
      nome: user.nome,
      email: user.email,
    };
  }
  const cliente = s.clientes.find((c) => c.user_id === user.id);
  const cadastro = s.cadastros.find((c) => c.email === user.email);
  const status: CadastroStatus | null = cliente
    ? "aprovado"
    : cadastro
      ? cadastro.status
      : null;
  return {
    user_id: user.id,
    tenant_id: TENANT_ID,
    tenant_slug: TENANT_SLUG,
    surface: "loja",
    saas_role: null,
    is_customer: true,
    cliente_status: status,
    cnpj_last4: cliente?.cnpj_digits.slice(-4) ?? cadastro?.cnpj_masked.slice(-2),
    nome: user.nome,
    email: user.email,
  };
}

export function findSession(token: string | undefined, surface: "loja" | "saas") {
  if (!token) return null;
  return store().sessions.find((s) => s.token === token && s.surface === surface) ?? null;
}

export function login(surface: "loja" | "saas", email: string, password: string) {
  if (password !== DEMO_PASSWORD) return { error: "login" as const };
  const user = store().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.ativo) return { error: user && !user.ativo ? ("disabled" as const) : ("login" as const) };

  if (surface === "saas") {
    if (user.id !== "user_admin" && user.id !== "user_vendedor") return { error: "login" as const };
  } else {
    if (user.id !== "user_cliente" && user.id !== "user_prospecto") return { error: "login" as const };
  }

  const token = `tok_${surface}_${user.id}_${Date.now()}`;
  store().sessions.push({ token, surface, user_id: user.id });
  return { token, dto: sessionDto({ token, surface, user_id: user.id }) };
}

export function logout(token: string | undefined, surface: "loja" | "saas") {
  const s = store();
  s.sessions = s.sessions.filter((x) => !(x.token === token && x.surface === surface));
}

type OutboxInput = {
  channel: "email" | "whatsapp";
  recipient_role: "customer" | "vendedor";
  recipient: string;
  template_key: string;
  orcamento_id?: string | null;
  pedido_id?: string | null;
  venda_id?: string | null;
  cadastro_request_id?: string | null;
  status?: "pendente" | "enviado" | "falha";
};

export function enqueueOutbox(partial: OutboxInput) {
  const row = {
    id: nid("out"),
    created_at: now(),
    channel: partial.channel,
    recipient_role: partial.recipient_role,
    recipient: partial.recipient,
    template_key: partial.template_key,
    status: partial.status ?? ("enviado" as const),
    orcamento_id: partial.orcamento_id ?? null,
    pedido_id: partial.pedido_id ?? null,
    venda_id: partial.venda_id ?? null,
    cadastro_request_id: partial.cadastro_request_id ?? null,
  };
  store().outbox.unshift(row);
  return row;
}

export function transitionOrcamento(
  id: string,
  para: OrcamentoStatus,
  opts?: { actor?: string; allowProspectAccept?: boolean },
) {
  const orc = store().orcamentos.find((o) => o.id === id);
  if (!orc) return { code: "nao_encontrado" as const };
  if (!LEGAL_ORCAMENTO[orc.status].includes(para)) return { code: "transicao_ilegal" as const };

  if (para === "aceito") {
    const approved = orc.cliente?.status === "aprovado";
    if (!approved && !opts?.allowProspectAccept) return { code: "cadastro_nao_aprovado" as const };
    // create pedido
    const pedId = nid("ped");
    for (const line of orc.linhas) {
      const sku = store().skus.find((x) => x.id === line.sku_id);
      if (!sku || sku.available < line.qty) return { code: "estoque_insuficiente" as const };
    }
    for (const line of orc.linhas) {
      const sku = store().skus.find((x) => x.id === line.sku_id)!;
      sku.reserved += line.qty;
    }
    refreshSkuAvailable();
    const pedido = {
      id: pedId,
      numero: `PED-${store().seq}`,
      status: "confirmado" as PedidoStatus,
      channel: "orcamento" as const,
      cliente: orc.cliente!,
      linhas: orc.linhas.map((l) => ({ ...l, id: nid("pl") })),
      history: [{ from_status: null, to_status: "confirmado", created_at: now(), actor_user_id: opts?.actor }],
      total_centavos: orc.total_centavos,
      orcamento_id: orc.id,
      venda_id: null,
      created_at: now(),
      updated_at: now(),
    };
    store().pedidos.unshift(pedido);
    orc.pedido_id = pedId;
    enqueueOutbox({
      channel: "whatsapp",
      recipient_role: "customer",
      recipient: orc.cliente?.whatsapp ?? "",
      template_key: "pedido.status",
      pedido_id: pedId,
      orcamento_id: orc.id,
      venda_id: null,
      cadastro_request_id: null,
    });
  }

  orc.history.push({
    from_status: orc.status,
    to_status: para,
    created_at: now(),
    actor_user_id: opts?.actor,
  });
  orc.status = para;
  orc.updated_at = now();
  enqueueOutbox({
    channel: "whatsapp",
    recipient_role: "customer",
    recipient: orc.cliente?.whatsapp ?? orc.prospect_phone ?? "",
    template_key: "orcamento.status",
    orcamento_id: orc.id,
    pedido_id: orc.pedido_id ?? null,
    venda_id: null,
    cadastro_request_id: null,
  });
  return { orc };
}

export function transitionPedido(id: string, para: PedidoStatus, actor?: string) {
  const ped = store().pedidos.find((p) => p.id === id);
  if (!ped) return { code: "nao_encontrado" as const };
  if (!LEGAL_PEDIDO[ped.status].includes(para)) return { code: "transicao_ilegal" as const };

  if (para === "cancelado" && (ped.status === "confirmado" || ped.status === "em_separacao")) {
    for (const line of ped.linhas) {
      const sku = store().skus.find((x) => x.id === line.sku_id);
      if (sku) sku.reserved = Math.max(0, sku.reserved - line.qty);
    }
    refreshSkuAvailable();
  }
  if (ped.status === "em_separacao" && para === "despachado") {
    for (const line of ped.linhas) {
      const sku = store().skus.find((x) => x.id === line.sku_id);
      if (sku) {
        sku.reserved = Math.max(0, sku.reserved - line.qty);
        sku.on_hand = Math.max(0, sku.on_hand - line.qty);
      }
    }
    refreshSkuAvailable();
  }

  ped.history.push({
    from_status: ped.status,
    to_status: para,
    created_at: now(),
    actor_user_id: actor,
  });
  ped.status = para;
  ped.updated_at = now();
  enqueueOutbox({
    channel: "whatsapp",
    recipient_role: "customer",
    recipient: ped.cliente.whatsapp ?? "",
    template_key: "pedido.status",
    pedido_id: ped.id,
    orcamento_id: ped.orcamento_id ?? null,
    venda_id: ped.venda_id ?? null,
    cadastro_request_id: null,
  });
  return { ped };
}

export function faturarPedido(id: string, actor?: string) {
  const ped = store().pedidos.find((p) => p.id === id);
  if (!ped) return { code: "nao_encontrado" as const };
  if (ped.status === "cancelado") return { code: "transicao_ilegal" as const };
  if (store().vendas.some((v) => v.pedido_id === id && v.status !== "cancelado")) {
    return { code: "conflito" as const };
  }
  const venda = {
    id: nid("ven"),
    status: "rascunho" as VendaStatus,
    pedido_id: ped.id,
    cliente: ped.cliente,
    created_at: now(),
    updated_at: now(),
    history: [{ from_status: null, to_status: "rascunho", created_at: now(), actor_user_id: actor }],
  };
  store().vendas.unshift(venda);
  ped.venda_id = venda.id;
  return { venda };
}

export function transitionVenda(id: string, para: VendaStatus, actor?: string) {
  const venda = store().vendas.find((v) => v.id === id);
  if (!venda) return { code: "nao_encontrado" as const };
  if (!LEGAL_VENDA[venda.status].includes(para)) return { code: "transicao_ilegal" as const };
  venda.history.push({
    from_status: venda.status,
    to_status: para,
    created_at: now(),
    actor_user_id: actor,
  });
  venda.status = para;
  venda.updated_at = now();
  if (para === "faturado") {
    enqueueOutbox({
      channel: "whatsapp",
      recipient_role: "customer",
      recipient: venda.cliente?.whatsapp ?? "",
      template_key: "venda.faturado",
      venda_id: venda.id,
      pedido_id: venda.pedido_id,
      orcamento_id: null,
      cadastro_request_id: null,
    });
  }
  return { venda };
}

export function transitionCadastro(
  id: string,
  para: "aprovado" | "recusado",
  motivo?: string,
  actor?: string,
) {
  const cad = store().cadastros.find((c) => c.id === id);
  if (!cad) return { code: "nao_encontrado" as const };
  if (cad.status !== "pendente") return { code: "transicao_ilegal" as const };
  if (para === "recusado" && !motivo?.trim()) return { code: "validacao" as const, message: "Informe o motivo da recusa." };

  if (para === "aprovado") {
    const cliId = nid("cli");
    store().clientes.push({
      id: cliId,
      user_id: store().users.find((u) => u.email === cad.email)?.id ?? nid("user"),
      razao_social: cad.razao_social,
      cnpj_masked: cad.cnpj_masked,
      cnpj_digits: onlyDigits(cad.cnpj_masked.replace(/\*/g, "0")) || "00000000000000",
      whatsapp: cad.whatsapp,
      status: "aprovado",
      email: cad.email,
    });
    cad.cliente_id = cliId;
  }

  cad.status = para;
  cad.motivo_recusa = para === "recusado" ? motivo ?? null : null;
  cad.updated_at = now();
  enqueueOutbox({
    channel: "whatsapp",
    recipient_role: "customer",
    recipient: cad.whatsapp,
    template_key: para === "aprovado" ? "cadastro.aprovado" : "cadastro.recusado",
    cadastro_request_id: cad.id,
    orcamento_id: null,
    pedido_id: null,
    venda_id: null,
  });
  void actor;
  return { cad };
}

export function createLojaPedido(userId: string, linhas: { sku_id: string; qty: number }[]) {
  const cliente = store().clientes.find((c) => c.user_id === userId);
  if (!cliente || cliente.status !== "aprovado") return { code: "cadastro_nao_aprovado" as const };
  if (store().config.loja_modo !== "pedido_direto") return { code: "forbidden" as const };

  const built = [];
  for (const line of linhas) {
    const sku = store().skus.find((x) => x.id === line.sku_id);
    if (!sku || !sku.visivel_loja) return { code: "nao_encontrado" as const };
    if (line.qty < sku.qtd_min_atacado) return { code: "moq_atacado" as const };
    if (sku.available < line.qty) return { code: "estoque_insuficiente" as const };
    built.push({
      id: nid("pl"),
      sku_id: sku.id,
      codigo_snapshot: sku.sku,
      nome_snapshot: sku.nome,
      qty: line.qty,
      unit_price_centavos: sku.preco_atacado_centavos,
    });
  }
  for (const line of built) {
    const sku = store().skus.find((x) => x.id === line.sku_id)!;
    sku.reserved += line.qty;
  }
  refreshSkuAvailable();
  const ped = {
    id: nid("ped"),
    numero: `PED-${store().seq}`,
    status: "confirmado" as PedidoStatus,
    channel: "loja" as const,
    cliente: {
      id: cliente.id,
      razao_social: cliente.razao_social,
      cnpj_masked: cliente.cnpj_masked,
      whatsapp: cliente.whatsapp,
      status: "aprovado" as const,
    },
    linhas: built,
    history: [{ from_status: null, to_status: "confirmado", created_at: now() }],
    total_centavos: built.reduce((s, l) => s + l.qty * l.unit_price_centavos, 0),
    orcamento_id: null,
    venda_id: null,
    created_at: now(),
    updated_at: now(),
  };
  store().pedidos.unshift(ped);
  enqueueOutbox({
    channel: "whatsapp",
    recipient_role: "customer",
    recipient: cliente.whatsapp,
    template_key: "pedido.status",
    pedido_id: ped.id,
    orcamento_id: null,
    venda_id: null,
    cadastro_request_id: null,
  });
  return { ped };
}

export function createCadastro(body: {
  email: string;
  password: string;
  contato_nome: string;
  cnpj: string;
  whatsapp: string;
  razao_social?: string;
  cnpj_registro_pendente?: boolean;
}) {
  const digits = onlyDigits(body.cnpj);
  if (!isValidCnpj(digits)) return { code: "checksum_invalido" as const };
  if (store().cadastros.some((c) => c.email === body.email && c.status !== "recusado")) {
    return { code: "conflito" as const };
  }
  const userId = nid("user");
  store().users.push({
    id: userId,
    email: body.email,
    nome: body.contato_nome,
    saas_role: "vendedor",
    ativo: true,
  });
  const cad = {
    id: nid("cad"),
    status: "pendente" as const,
    cnpj_masked: maskCnpj(digits),
    cnpj_registro_pendente: !!body.cnpj_registro_pendente,
    razao_social: body.razao_social?.trim() || "Empresa sem razão social",
    contato_nome: body.contato_nome,
    email: body.email,
    whatsapp: body.whatsapp,
    source: "loja" as const,
    motivo_recusa: null,
    cliente_id: null,
    created_at: now(),
    updated_at: now(),
  };
  store().cadastros.unshift(cad);
  void body.password;
  return { cad };
}

export function simulateInbox(phone: string, body: string, intent?: WhatsappIntent | null) {
  const s = store();
  let thread = s.inbox.find((t) => t.phone_e164 === phone);
  const ts = now();
  const msg = {
    id: nid("msg"),
    direction: "inbound" as const,
    body,
    simulated: true,
    created_at: ts,
  };
  if (!thread) {
    thread = {
      id: nid("th"),
      phone_e164: phone,
      intent: intent ?? null,
      preview: body.slice(0, 80),
      unread: true,
      updated_at: ts,
      cadastro_request_id: null,
      orcamento_id: null,
      cliente_id: null,
      messages: [msg],
    };
    s.inbox.unshift(thread);
  } else {
    thread.messages.push(msg);
    thread.preview = body.slice(0, 80);
    thread.unread = true;
    thread.updated_at = ts;
    if (intent) thread.intent = intent;
  }
  return thread;
}

export { nid, now, DEMO_PASSWORD, TENANT_SLUG };
