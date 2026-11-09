import bcrypt from "bcryptjs";
import { isValidCnpj, onlyDigits } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { env } from "../env";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { lookupCnpj } from "../identity/cnpj-lookup";
import { deliverOutboxIds, enqueueNotifications } from "../notifications/outbox-enqueue";

function cadastroDto(row: {
  id: string;
  cnpjLast4: string;
  cnpjRegistroPendente: boolean;
  razaoSocial: string;
  contatoNome: string;
  email: string;
  whatsapp: string;
  status: string;
  motivoRecusa: string | null;
  source: string;
  clienteId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    cnpj_last4: row.cnpjLast4,
    cnpj_registro_pendente: row.cnpjRegistroPendente,
    razao_social: row.razaoSocial,
    contato_nome: row.contatoNome,
    email: row.email,
    whatsapp: row.whatsapp,
    status: row.status,
    motivo_recusa: row.motivoRecusa,
    source: row.source,
    cliente_id: row.clienteId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function submitLojaCadastro(input: {
  tenantSlug?: string;
  cnpj: string;
  contato_nome: string;
  email: string;
  whatsapp: string;
  senha: string;
  razao_social?: string;
}) {
  const slug = input.tenantSlug || env.defaultTenantSlug;
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new ApiError("nao_encontrado", "Tenant não encontrado.");

  const digits = onlyDigits(input.cnpj);
  if (!isValidCnpj(digits)) throw new ApiError("checksum_invalido", "CNPJ inválido.");
  if (!input.contato_nome.trim() || !input.email.trim() || !input.whatsapp.trim()) {
    throw new ApiError("validacao", "Preencha nome, e-mail e WhatsApp.");
  }
  if (input.senha.length < 8) throw new ApiError("validacao", "Senha deve ter ao menos 8 caracteres.");

  const lookup = await lookupCnpj(digits);
  const razao = lookup.razao_social || input.razao_social?.trim();
  if (!razao) throw new ApiError("validacao", "Informe a razão social (registro indisponível).");

  const email = input.email.trim().toLowerCase();
  const existingActive = await db.cadastroRequest.findFirst({
    where: {
      tenantId: tenant.id,
      cnpjDigits: digits,
      status: { in: ["pendente", "aprovado"] },
    },
  });
  if (existingActive) throw new ApiError("conflito", "Já existe cadastro ativo para este CNPJ.");

  const existingCliente = await db.cliente.findUnique({
    where: { tenantId_cnpjDigits: { tenantId: tenant.id, cnpjDigits: digits } },
  });
  if (existingCliente) throw new ApiError("conflito", "Cliente já cadastrado.");

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) throw new ApiError("conflito", "E-mail já em uso.");

  const passwordHash = await bcrypt.hash(input.senha, 10);
  const userId = newId("usr");
  const cadastroId = newId("cad");

  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email,
        passwordHash,
        nome: input.contato_nome.trim(),
        whatsapp: input.whatsapp.trim(),
        ativo: true,
      },
    });
    await tx.membership.create({
      data: {
        id: newId("mem"),
        tenantId: tenant.id,
        userId,
        saasRole: null,
        isCustomer: true,
      },
    });
    await tx.cadastroRequest.create({
      data: {
        id: cadastroId,
        tenantId: tenant.id,
        cnpjDigits: digits,
        cnpjLast4: digits.slice(-4),
        cnpjRegistroPendente: lookup.cnpj_registro_pendente,
        razaoSocial: razao,
        contatoNome: input.contato_nome.trim(),
        email,
        whatsapp: input.whatsapp.trim(),
        status: "pendente",
        source: "loja",
      },
    });
  });

  const row = await db.cadastroRequest.findUniqueOrThrow({ where: { id: cadastroId } });
  return cadastroDto(row);
}

export async function listCadastros(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const status = url.searchParams.get("status") || undefined;
  const decoded = decodeCursor(cursor);
  const rows = await db.cadastroRequest.findMany({
    where: {
      tenantId: session.tenantId,
      ...(status ? { status: status as "pendente" | "aprovado" | "recusado" } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(cadastroDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getCadastro(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.cadastroRequest.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return cadastroDto(row);
}

export async function getMeCadastro(session: SessionContext) {
  if (session.clienteId) {
    const cliente = await db.cliente.findFirst({
      where: { id: session.clienteId, tenantId: session.tenantId },
    });
    if (!cliente) throw new ApiError("nao_encontrado", "Não encontrado.");
    return {
      tipo: "cliente" as const,
      status: "aprovado" as const,
      cnpj_last4: cliente.cnpjLast4,
      razao_social: cliente.razaoSocial,
      cnpj_registro_pendente: cliente.cnpjRegistroPendente,
    };
  }
  if (session.cadastroRequestId) {
    const row = await db.cadastroRequest.findFirst({
      where: { id: session.cadastroRequestId, tenantId: session.tenantId },
    });
    if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
    return {
      tipo: "cadastro" as const,
      ...cadastroDto(row),
    };
  }
  throw new ApiError("nao_encontrado", "Não encontrado.");
}

export async function transitionCadastro(
  session: SessionContext,
  id: string,
  para: "aprovado" | "recusado",
  motivoRecusa?: string,
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.cadastroRequest.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "pendente") {
    throw new ApiError("transicao_ilegal", "Só cadastros pendentes podem ser revisados.");
  }
  if (para === "recusado" && !motivoRecusa?.trim()) {
    throw new ApiError("validacao", "Informe o motivo da recusa.");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const vendedor = tenant.defaultVendedorUserId
    ? await db.user.findUnique({ where: { id: tenant.defaultVendedorUserId } })
    : null;

  let outboxIds: string[] = [];
  await db.$transaction(async (tx) => {
    if (para === "aprovado") {
      const clienteId = newId("cli");
      const user = await tx.user.findUnique({ where: { email: row.email } });
      await tx.cliente.create({
        data: {
          id: clienteId,
          tenantId: session.tenantId,
          userId: user?.id,
          cnpjDigits: row.cnpjDigits,
          cnpjLast4: row.cnpjLast4,
          cnpjRegistroPendente: row.cnpjRegistroPendente,
          razaoSocial: row.razaoSocial,
          contatoNome: row.contatoNome,
          email: row.email,
          whatsapp: row.whatsapp,
          status: "aprovado",
          cadastroRequestId: row.id,
        },
      });
      await tx.cadastroRequest.update({
        where: { id: row.id },
        data: {
          status: "aprovado",
          clienteId,
          reviewedByUserId: session.userId,
        },
      });
      outboxIds = await enqueueNotifications(tx, {
        tenantId: session.tenantId,
        canaisAviso: tenant.canaisAviso,
        customerRecipient: row.whatsapp || row.email,
        vendedorRecipient: vendedor?.whatsapp || vendedor?.email || null,
        templateKey: "cadastro.aprovado",
        payload: { cadastro_request_id: row.id, status: "aprovado", cnpj_last4: row.cnpjLast4 },
        cadastroRequestId: row.id,
      });
    } else {
      await tx.cadastroRequest.update({
        where: { id: row.id },
        data: {
          status: "recusado",
          motivoRecusa: motivoRecusa!.trim(),
          reviewedByUserId: session.userId,
        },
      });
      outboxIds = await enqueueNotifications(tx, {
        tenantId: session.tenantId,
        canaisAviso: tenant.canaisAviso,
        customerRecipient: row.whatsapp || row.email,
        vendedorRecipient: vendedor?.whatsapp || vendedor?.email || null,
        templateKey: "cadastro.recusado",
        payload: {
          cadastro_request_id: row.id,
          status: "recusado",
          cnpj_last4: row.cnpjLast4,
        },
        cadastroRequestId: row.id,
      });
    }
  });

  await deliverOutboxIds(outboxIds);
  return getCadastro(session, id);
}
