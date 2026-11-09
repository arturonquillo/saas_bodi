import {
  HTTP_FOR_CODE,
  SEED_THEME,
  availableQty,
  isValidCnpj,
  maskCnpj,
  onlyDigits,
  type ApiErrorCode,
  type WhatsappIntent,
} from "@saas-frota/shared";
import {
  createCadastro,
  createLojaPedido,
  faturarPedido,
  findSession,
  login,
  logout,
  nid,
  now,
  refreshSkuAvailable,
  sessionDto,
  simulateInbox,
  store,
  transitionCadastro,
  transitionOrcamento,
  transitionPedido,
  transitionVenda,
  TENANT_SLUG,
} from "./store";

type Ctx = {
  method: string;
  path: string; // without /api prefix, e.g. saas/inbox
  search: URLSearchParams;
  body: unknown;
  cookies: { saas?: string; loja?: string };
};

function ok<T>(data: T, status = 200) {
  return Response.json({ data }, { status });
}

function err(code: ApiErrorCode, message: string, details?: unknown) {
  return Response.json(
    { error: { code, message, details } },
    { status: HTTP_FOR_CODE[code] },
  );
}

function page<T>(items: T[]) {
  return ok({ items, next_cursor: null });
}

function jsonBody(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function requireSaas(ctx: Ctx, adminOnly = false) {
  const sess = findSession(ctx.cookies.saas, "saas");
  if (!sess) return { error: err("unauthenticated", "Sua sessão expirou. Entre novamente.") };
  const dto = sessionDto(sess);
  if (adminOnly && dto.saas_role !== "admin") {
    return { error: err("forbidden", "Sem permissão.") };
  }
  return { sess, dto };
}

function requireLoja(ctx: Ctx) {
  const sess = findSession(ctx.cookies.loja, "loja");
  if (!sess) return { error: err("unauthenticated", "Sua sessão expirou. Entre novamente.") };
  return { sess, dto: sessionDto(sess) };
}

function setCookie(res: Response, name: string, value: string, clear = false) {
  const maxAge = clear ? 0 : 60 * 60 * 24 * 7;
  res.headers.append(
    "Set-Cookie",
    `${name}=${clear ? "" : value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
  return res;
}

export async function handleMockApi(ctx: Ctx): Promise<Response> {
  const { method, path } = ctx;
  const parts = path.split("/").filter(Boolean);
  const s = store();

  if (parts[0] === "health" && method === "GET") {
    return ok({ ok: true });
  }

  if (parts[0] === "identidade" && parts[1] === "cnpj" && method === "POST") {
    const cnpj = onlyDigits(String(jsonBody(ctx.body).cnpj ?? ""));
    if (!isValidCnpj(cnpj)) return err("checksum_invalido", "CNPJ inválido.");
    // simulate registry: known fixtures fill; others degrade
    if (cnpj === "11222333000181") {
      return ok({ razao_social: "Mercado Exemplo LTDA", cnpj_registro_pendente: false });
    }
    if (cnpj === "34028316000103") {
      return ok({ razao_social: "Nova Loja Alimentos LTDA", cnpj_registro_pendente: false });
    }
    return ok({
      razao_social: null,
      cnpj_registro_pendente: true,
      warning: "Não consultamos o CNPJ agora. Você pode continuar e completar os dados.",
    });
  }

  // ——— Loja public ———
  if (parts[0] === "loja" && parts[1] === "tema" && method === "GET") {
    return ok(s.theme);
  }
  if (parts[0] === "loja" && parts[1] === "config" && method === "GET") {
    const wa = s.config.whatsapp_comercial;
    return ok({
      loja_modo: s.config.loja_modo,
      whatsapp_comercial: wa,
      whatsapp_wa_link: wa
        ? `https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent("Olá, Casa dos Frios! Vim pela loja.")}`
        : null,
      marca: s.theme.marca || SEED_THEME.marca,
    });
  }
  if (parts[0] === "loja" && parts[1] === "catalogo" && method === "GET") {
    refreshSkuAvailable();
    const items = s.skus
      .filter((x) => x.visivel_loja)
      .map((x) => ({
        id: x.id,
        sku: x.sku,
        nome: x.nome,
        preco_atacado_centavos: x.preco_atacado_centavos,
        qtd_min_atacado: x.qtd_min_atacado,
        available: x.available,
        sem_estoque: x.available <= 0,
      }));
    return page(items);
  }
  if (parts[0] === "loja" && parts[1] === "produtos" && parts[2] && method === "GET") {
    refreshSkuAvailable();
    const x = s.skus.find((sku) => sku.id === parts[2] && sku.visivel_loja);
    if (!x) return err("nao_encontrado", "Não encontrado.");
    return ok({
      id: x.id,
      sku: x.sku,
      nome: x.nome,
      preco_atacado_centavos: x.preco_atacado_centavos,
      qtd_min_atacado: x.qtd_min_atacado,
      available: x.available,
      sem_estoque: x.available <= 0,
    });
  }
  if (parts[0] === "loja" && parts[1] === "cadastro" && method === "POST") {
    const b = jsonBody(ctx.body);
    const result = createCadastro({
      email: String(b.email ?? ""),
      password: String(b.password ?? ""),
      contato_nome: String(b.contato_nome ?? ""),
      cnpj: String(b.cnpj ?? ""),
      whatsapp: String(b.whatsapp ?? ""),
      razao_social: b.razao_social ? String(b.razao_social) : undefined,
      cnpj_registro_pendente: !!b.cnpj_registro_pendente,
    });
    if ("code" in result) {
      if (result.code === "checksum_invalido") return err("checksum_invalido", "CNPJ inválido.");
      return err(result.code, "Não foi possível concluir.");
    }
    return ok(result.cad, 201);
  }
  if (parts[0] === "loja" && parts[1] === "whatsapp-cta" && method === "POST") {
    const b = jsonBody(ctx.body);
    simulateInbox(
      String(b.phone_e164 ?? s.config.whatsapp_comercial ?? "+5511988877766"),
      String(b.body ?? "CTA WhatsApp da loja"),
      (b.intent_hint as WhatsappIntent) ?? "info_empresa",
    );
    return ok({ ok: true }, 201);
  }
  if (parts[0] === "loja" && parts[1] === "login" && method === "POST") {
    const b = jsonBody(ctx.body);
    const result = login("loja", String(b.email ?? ""), String(b.password ?? ""));
    if ("error" in result) {
      if (result.error === "disabled") return err("forbidden", "Conta desativada.");
      return err("unauthenticated", "E-mail ou senha inválidos.");
    }
    return setCookie(ok(result.dto), "cdf_sessao_loja", result.token);
  }
  if (parts[0] === "loja" && parts[1] === "logout" && method === "POST") {
    logout(ctx.cookies.loja, "loja");
    return setCookie(new Response(null, { status: 204 }), "cdf_sessao_loja", "", true);
  }
  if (parts[0] === "loja" && parts[1] === "sessao" && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    return ok(auth.dto);
  }
  if (parts[0] === "loja" && parts[1] === "me" && parts[2] === "cadastro" && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const cad = s.cadastros.find((c) => c.email === auth.dto.email);
    if (!cad) return err("nao_encontrado", "Não encontrado.");
    return ok(cad);
  }
  if (parts[0] === "loja" && parts[1] === "orcamentos" && !parts[2] && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const cli = s.clientes.find((c) => c.user_id === auth.sess.user_id);
    const items = s.orcamentos.filter((o) => o.cliente?.id === cli?.id);
    return page(items);
  }
  if (parts[0] === "loja" && parts[1] === "orcamentos" && parts[2] && parts[3] === "transicao" && method === "POST") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const para = String(jsonBody(ctx.body).para ?? "") as "aceito" | "recusado";
    const result = transitionOrcamento(parts[2], para);
    if ("code" in result) {
      if (result.code === "cadastro_nao_aprovado") {
        return err("cadastro_nao_aprovado", "Cliente sem cadastro aprovado.");
      }
      return err(result.code, "Não foi possível concluir.");
    }
    return ok(result.orc);
  }
  if (parts[0] === "loja" && parts[1] === "orcamentos" && parts[2] && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const orc = s.orcamentos.find((o) => o.id === parts[2]);
    if (!orc) return err("nao_encontrado", "Não encontrado.");
    return ok(orc);
  }
  if (parts[0] === "loja" && parts[1] === "pedidos" && !parts[2] && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const cli = s.clientes.find((c) => c.user_id === auth.sess.user_id);
    return page(s.pedidos.filter((p) => p.cliente.id === cli?.id));
  }
  if (parts[0] === "loja" && parts[1] === "pedidos" && !parts[2] && method === "POST") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const linhas = (jsonBody(ctx.body).linhas as { sku_id: string; qty: number }[]) ?? [];
    const result = createLojaPedido(auth.sess.user_id, linhas);
    if ("code" in result) {
      if (result.code === "cadastro_nao_aprovado") {
        return err("cadastro_nao_aprovado", "Seu cadastro ainda não foi aprovado.");
      }
      if (result.code === "moq_atacado") return err("moq_atacado", "Quantidade abaixo do mínimo.");
      if (result.code === "estoque_insuficiente") return err("estoque_insuficiente", "Estoque insuficiente.");
      return err(result.code, "Não foi possível concluir.");
    }
    return ok(result.ped, 201);
  }
  if (parts[0] === "loja" && parts[1] === "pedidos" && parts[2] && method === "GET") {
    const auth = requireLoja(ctx);
    if ("error" in auth) return auth.error;
    const ped = s.pedidos.find((p) => p.id === parts[2]);
    if (!ped) return err("nao_encontrado", "Não encontrado.");
    return ok(ped);
  }

  // ——— SaaS auth ———
  if (parts[0] === "saas" && parts[1] === "login" && method === "POST") {
    const b = jsonBody(ctx.body);
    const result = login("saas", String(b.email ?? ""), String(b.password ?? ""));
    if ("error" in result) {
      if (result.error === "disabled") return err("forbidden", "Conta desativada.");
      return err("unauthenticated", "E-mail ou senha inválidos.");
    }
    return setCookie(ok(result.dto), "cdf_sessao_saas", result.token);
  }
  if (parts[0] === "saas" && parts[1] === "logout" && method === "POST") {
    logout(ctx.cookies.saas, "saas");
    return setCookie(new Response(null, { status: 204 }), "cdf_sessao_saas", "", true);
  }
  if (parts[0] === "saas" && parts[1] === "sessao" && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return ok(auth.dto);
  }

  // usuarios
  if (parts[0] === "saas" && parts[1] === "usuarios" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const { LOJA_ONLY_EMAILS } = await import("./seed-data");
    return page(s.users.filter((u) => !LOJA_ONLY_EMAILS.has(u.email)));
  }
  if (parts[0] === "saas" && parts[1] === "usuarios" && !parts[2] && method === "POST") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const role = b.saas_role === "admin" ? "admin" : "vendedor";
    const user = {
      id: nid("user"),
      email: String(b.email ?? ""),
      nome: String(b.nome ?? ""),
      saas_role: role as "admin" | "vendedor",
      ativo: true,
    };
    s.users.push(user);
    return ok(user, 201);
  }
  if (parts[0] === "saas" && parts[1] === "usuarios" && parts[2] && method === "PATCH") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const user = s.users.find((u) => u.id === parts[2]);
    if (!user) return err("nao_encontrado", "Não encontrado.");
    const b = jsonBody(ctx.body);
    if (typeof b.ativo === "boolean") user.ativo = b.ativo;
    if (b.saas_role === "admin" || b.saas_role === "vendedor") user.saas_role = b.saas_role;
    return ok(user);
  }

  if (parts[0] === "saas" && parts[1] === "tema" && method === "GET") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    return ok(s.theme);
  }
  if (parts[0] === "saas" && parts[1] === "tema" && method === "PUT") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    s.theme = {
      marca: String(b.marca ?? s.theme.marca),
      primary: String(b.primary ?? s.theme.primary),
      accent: String(b.accent ?? s.theme.accent),
      background: String(b.background ?? s.theme.background),
      logo_url: b.logo_url === null || b.logo_url === "" ? null : String(b.logo_url ?? s.theme.logo_url),
    };
    return ok(s.theme);
  }

  if (parts[0] === "saas" && parts[1] === "config" && method === "GET") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    return ok(s.config);
  }
  if (parts[0] === "saas" && parts[1] === "config" && method === "PUT") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    s.config = {
      ...s.config,
      razao_social: String(b.razao_social ?? s.config.razao_social),
      nome_fantasia: String(b.nome_fantasia ?? s.config.nome_fantasia),
      whatsapp_comercial:
        b.whatsapp_comercial === undefined
          ? s.config.whatsapp_comercial
          : b.whatsapp_comercial
            ? String(b.whatsapp_comercial)
            : null,
      canais_aviso:
        b.canais_aviso === "email" || b.canais_aviso === "whatsapp" || b.canais_aviso === "ambos"
          ? b.canais_aviso
          : s.config.canais_aviso,
      loja_modo: b.loja_modo === "orcamento" ? "orcamento" : b.loja_modo === "pedido_direto" ? "pedido_direto" : s.config.loja_modo,
      default_vendedor_user_id:
        b.default_vendedor_user_id === undefined
          ? s.config.default_vendedor_user_id
          : b.default_vendedor_user_id
            ? String(b.default_vendedor_user_id)
            : null,
    };
    return ok(s.config);
  }

  if (parts[0] === "saas" && parts[1] === "avisos" && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(s.outbox);
  }

  // inbox
  if (parts[0] === "saas" && parts[1] === "inbox" && parts[2] === "simular" && method === "POST") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const thread = simulateInbox(
      String(b.phone_e164 ?? ""),
      String(b.body ?? ""),
      (b.intent_hint as WhatsappIntent) ?? null,
    );
    return ok(thread, 201);
  }
  if (parts[0] === "saas" && parts[1] === "inbox" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(
      s.inbox.map(({ messages: _m, ...t }) => t),
    );
  }
  if (parts[0] === "saas" && parts[1] === "inbox" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const thread = s.inbox.find((t) => t.id === parts[2]);
    if (!thread) return err("nao_encontrado", "Não encontrado.");
    thread.unread = false;
    return ok(thread);
  }
  if (parts[0] === "saas" && parts[1] === "inbox" && parts[2] && method === "PATCH") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const thread = s.inbox.find((t) => t.id === parts[2]);
    if (!thread) return err("nao_encontrado", "Não encontrado.");
    const b = jsonBody(ctx.body);
    if (b.intent === null || typeof b.intent === "string") {
      thread.intent = (b.intent as WhatsappIntent | null) ?? null;
    }
    if (b.cadastro_request_id !== undefined) thread.cadastro_request_id = b.cadastro_request_id as string | null;
    if (b.orcamento_id !== undefined) thread.orcamento_id = b.orcamento_id as string | null;
    if (typeof b.reply === "string" && b.reply.trim()) {
      thread.messages.push({
        id: nid("msg"),
        direction: "outbound_note",
        body: b.reply,
        simulated: false,
        created_at: now(),
      });
      thread.preview = `Outbox: ${b.reply.slice(0, 60)}`;
      thread.updated_at = now();
    }
    return ok(thread);
  }

  // cadastros
  if (parts[0] === "saas" && parts[1] === "cadastros" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(s.cadastros);
  }
  if (parts[0] === "saas" && parts[1] === "cadastros" && parts[2] && parts[3] === "transicao" && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const para = b.para === "recusado" ? "recusado" : "aprovado";
    const result = transitionCadastro(parts[2], para, b.motivo_recusa ? String(b.motivo_recusa) : undefined, auth.dto.user_id);
    if ("code" in result) {
      if (result.code === "validacao") return err("validacao", result.message ?? "Informe o motivo da recusa.");
      return err(result.code, "Não foi possível concluir.");
    }
    return ok(result.cad);
  }
  if (parts[0] === "saas" && parts[1] === "cadastros" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const cad = s.cadastros.find((c) => c.id === parts[2]);
    if (!cad) return err("nao_encontrado", "Não encontrado.");
    return ok(cad);
  }

  // orcamentos
  if (parts[0] === "saas" && parts[1] === "orcamentos" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(s.orcamentos);
  }
  if (parts[0] === "saas" && parts[1] === "orcamentos" && !parts[2] && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const cliente = s.clientes.find((c) => c.id === String(b.cliente_id ?? ""));
    const linhasIn = (b.linhas as { sku_id: string; qty: number }[]) ?? [];
    const linhas = [];
    for (const line of linhasIn) {
      const sku = s.skus.find((x) => x.id === line.sku_id);
      if (!sku) return err("nao_encontrado", "SKU não encontrado.");
      linhas.push({
        id: nid("ol"),
        sku_id: sku.id,
        codigo_snapshot: sku.sku,
        nome_snapshot: sku.nome,
        qty: line.qty,
        unit_price_centavos: sku.preco_atacado_centavos,
      });
    }
    const orc = {
      id: nid("orc"),
      numero: `ORC-${s.seq}`,
      status: "rascunho" as const,
      valido_ate: b.valido_ate ? String(b.valido_ate) : null,
      cliente: cliente
        ? {
            id: cliente.id,
            razao_social: cliente.razao_social,
            cnpj_masked: cliente.cnpj_masked,
            whatsapp: cliente.whatsapp,
            status: "aprovado" as const,
          }
        : null,
      prospect_phone: b.prospect_phone ? String(b.prospect_phone) : null,
      linhas,
      history: [{ from_status: null, to_status: "rascunho", created_at: now(), actor_user_id: auth.dto.user_id }],
      total_centavos: linhas.reduce((sum, l) => sum + l.qty * l.unit_price_centavos, 0),
      pedido_id: null,
      created_at: now(),
      updated_at: now(),
    };
    s.orcamentos.unshift(orc);
    return ok(orc, 201);
  }
  if (parts[0] === "saas" && parts[1] === "orcamentos" && parts[2] && parts[3] === "transicao" && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const para = String(jsonBody(ctx.body).para ?? "") as Parameters<typeof transitionOrcamento>[1];
    const result = transitionOrcamento(parts[2], para, { actor: auth.dto.user_id });
    if ("code" in result) {
      if (result.code === "cadastro_nao_aprovado") {
        return err("cadastro_nao_aprovado", "Cadastro não aprovado. Aprove o cadastro antes de continuar.");
      }
      return err(result.code, "Não foi possível concluir.");
    }
    return ok(result.orc);
  }
  if (parts[0] === "saas" && parts[1] === "orcamentos" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const orc = s.orcamentos.find((o) => o.id === parts[2]);
    if (!orc) return err("nao_encontrado", "Não encontrado.");
    return ok(orc);
  }

  // pedidos
  if (parts[0] === "saas" && parts[1] === "pedidos" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(s.pedidos);
  }
  if (parts[0] === "saas" && parts[1] === "pedidos" && !parts[2] && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const cliente = s.clientes.find((c) => c.id === String(b.cliente_id ?? ""));
    if (!cliente) return err("cadastro_nao_aprovado", "Cliente sem cadastro aprovado.");
    const result = createLojaPedido(cliente.user_id, (b.linhas as { sku_id: string; qty: number }[]) ?? []);
    if ("code" in result) {
      if (result.code === "cadastro_nao_aprovado") return err("cadastro_nao_aprovado", "Cliente sem cadastro aprovado.");
      return err(result.code, "Não foi possível concluir.");
    }
    result.ped.channel = "saas";
    return ok(result.ped, 201);
  }
  if (parts[0] === "saas" && parts[1] === "pedidos" && parts[2] && parts[3] === "transicao" && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const para = String(jsonBody(ctx.body).para ?? "") as Parameters<typeof transitionPedido>[1];
    const result = transitionPedido(parts[2], para, auth.dto.user_id);
    if ("code" in result) return err(result.code, "Não foi possível concluir.");
    return ok(result.ped);
  }
  if (parts[0] === "saas" && parts[1] === "pedidos" && parts[2] && parts[3] === "faturar" && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const result = faturarPedido(parts[2], auth.dto.user_id);
    if ("code" in result) return err(result.code, "Não foi possível concluir.");
    return ok(result.venda, 201);
  }
  if (parts[0] === "saas" && parts[1] === "pedidos" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const ped = s.pedidos.find((p) => p.id === parts[2]);
    if (!ped) return err("nao_encontrado", "Não encontrado.");
    return ok(ped);
  }

  // vendas
  if (parts[0] === "saas" && parts[1] === "vendas" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(s.vendas);
  }
  if (parts[0] === "saas" && parts[1] === "vendas" && parts[2] && parts[3] === "transicao" && method === "POST") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const para = String(jsonBody(ctx.body).para ?? "") as "faturado" | "cancelado";
    const result = transitionVenda(parts[2], para, auth.dto.user_id);
    if ("code" in result) return err(result.code, "Não foi possível concluir.");
    return ok(result.venda);
  }
  if (parts[0] === "saas" && parts[1] === "vendas" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const venda = s.vendas.find((v) => v.id === parts[2]);
    if (!venda) return err("nao_encontrado", "Não encontrado.");
    return ok(venda);
  }

  // estoque
  if (parts[0] === "saas" && parts[1] === "estoque" && !parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    refreshSkuAvailable();
    return page(s.skus);
  }
  if (parts[0] === "saas" && parts[1] === "estoque" && !parts[2] && method === "POST") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const b = jsonBody(ctx.body);
    const onHand = Number(b.on_hand ?? 0);
    const item = {
      id: nid("sku"),
      sku: String(b.sku ?? b.codigo ?? ""),
      nome: String(b.nome ?? ""),
      on_hand: onHand,
      reserved: 0,
      available: onHand,
      visivel_loja: !!b.visivel_loja,
      preco_atacado_centavos: Number(b.preco_atacado_centavos ?? 0),
      qtd_min_atacado: Number(b.qtd_min_atacado ?? 1),
    };
    s.skus.push(item);
    return ok(item, 201);
  }
  if (parts[0] === "saas" && parts[1] === "estoque" && parts[2] && parts[3] === "ajuste" && method === "POST") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const sku = s.skus.find((x) => x.id === parts[2]);
    if (!sku) return err("nao_encontrado", "Não encontrado.");
    const b = jsonBody(ctx.body);
    sku.on_hand = Math.max(0, sku.on_hand + Number(b.delta_on_hand ?? 0));
    refreshSkuAvailable();
    return ok(sku);
  }
  if (parts[0] === "saas" && parts[1] === "estoque" && parts[2] && parts[3] === "visibilidade" && method === "PATCH") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const sku = s.skus.find((x) => x.id === parts[2]);
    if (!sku) return err("nao_encontrado", "Não encontrado.");
    sku.visivel_loja = !!jsonBody(ctx.body).visivel_loja;
    return ok(sku);
  }
  if (parts[0] === "saas" && parts[1] === "estoque" && parts[2] && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    const sku = s.skus.find((x) => x.id === parts[2] || x.sku === parts[2]);
    if (!sku) return err("nao_encontrado", "Não encontrado.");
    refreshSkuAvailable();
    return ok(sku);
  }
  if (parts[0] === "saas" && parts[1] === "estoque" && parts[2] && method === "PATCH") {
    const auth = requireSaas(ctx, true);
    if ("error" in auth) return auth.error;
    const sku = s.skus.find((x) => x.id === parts[2]);
    if (!sku) return err("nao_encontrado", "Não encontrado.");
    const b = jsonBody(ctx.body);
    if (b.nome) sku.nome = String(b.nome);
    if (b.preco_atacado_centavos !== undefined) sku.preco_atacado_centavos = Number(b.preco_atacado_centavos);
    if (b.qtd_min_atacado !== undefined) sku.qtd_min_atacado = Number(b.qtd_min_atacado);
    return ok(sku);
  }

  // clientes pick list for forms
  if (parts[0] === "saas" && parts[1] === "clientes" && method === "GET") {
    const auth = requireSaas(ctx);
    if ("error" in auth) return auth.error;
    return page(
      s.clientes.map((c) => ({
        id: c.id,
        razao_social: c.razao_social,
        cnpj_masked: c.cnpj_masked,
        whatsapp: c.whatsapp,
        status: c.status,
      })),
    );
  }

  // legacy aliases used by old UI — keep harmless stubs
  if (parts[0] === "loja" && parts[1] === "registrar") {
    return err("nao_implementado", "Use /api/loja/cadastro");
  }
  if (parts[0] === "saas" && parts[1] === "importacoes") {
    return err("nao_implementado", "Importação AI fora do MVP Casa dos Frios.");
  }
  if (parts[0] === "conta") {
    return err("nao_implementado", "Account fora do MVP.");
  }

  return err("nao_encontrado", `Rota não encontrada: /api/${path}`);
}

export function parseCookies(header: string | null) {
  const out: { saas?: string; loja?: string } = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    const v = rest.join("=");
    if (k === "cdf_sessao_saas") out.saas = v;
    if (k === "cdf_sessao_loja") out.loja = v;
  }
  return out;
}

export { TENANT_SLUG, availableQty, maskCnpj };
