import { isValidCnpj, onlyDigits } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelSimulateInboundPort, getDefaultWhatsappInbox } from "../ports/channel";
import { appendDomainEvent } from "./events";
import { companyDto, contactDto, conversationDto } from "./dto";

export async function listContatos(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const q = url.searchParams.get("q")?.trim();
  const rows = await db.contact.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
      ...(q
        ? {
            OR: [
              { nome: { contains: q } },
              { email: { contains: q } },
              { phoneE164: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(contactDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function createContato(
  session: SessionContext,
  input: {
    nome: string;
    email?: string | null;
    phone_e164?: string | null;
    company_id?: string | null;
    notas?: string | null;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.nome.trim()) throw new ApiError("validacao", "Nome é obrigatório.");
  if (input.company_id) {
    const c = await db.company.findFirst({
      where: { id: input.company_id, tenantId: session.tenantId },
    });
    if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  const id = newId("ct");
  await db.contact.create({
    data: {
      id,
      tenantId: session.tenantId,
      nome: input.nome.trim(),
      email: input.email?.trim() || null,
      phoneE164: input.phone_e164?.trim() || null,
      companyId: input.company_id ?? null,
      notas: input.notas ?? null,
    },
  });
  return getContato(session, id);
}

export async function getContato(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.contact.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return contactDto(row);
}

export async function patchContato(
  session: SessionContext,
  id: string,
  input: {
    nome?: string;
    email?: string | null;
    phone_e164?: string | null;
    company_id?: string | null;
    cliente_id?: string | null;
    notas?: string | null;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.contact.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.company_id) {
    const c = await db.company.findFirst({
      where: { id: input.company_id, tenantId: session.tenantId },
    });
    if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (input.cliente_id) {
    const c = await db.cliente.findFirst({
      where: { id: input.cliente_id, tenantId: session.tenantId },
    });
    if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  await db.contact.update({
    where: { id },
    data: {
      nome: input.nome?.trim(),
      email: input.email === undefined ? undefined : input.email,
      phoneE164: input.phone_e164 === undefined ? undefined : input.phone_e164,
      companyId: input.company_id === undefined ? undefined : input.company_id,
      clienteId: input.cliente_id === undefined ? undefined : input.cliente_id,
      notas: input.notas === undefined ? undefined : input.notas,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "contact.updated",
    aggregateType: "contact",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { contact_id: id },
  });
  return getContato(session, id);
}

export async function addContatoNota(session: SessionContext, id: string, nota: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.contact.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!nota.trim()) throw new ApiError("validacao", "Nota obrigatória.");
  const merged = [row.notas, nota.trim()].filter(Boolean).join("\n---\n");
  return patchContato(session, id, { notas: merged });
}

export async function startContatoConversa(
  session: SessionContext,
  contactId: string,
  input: { inbox_id?: string; body?: string },
) {
  assertSaasRole(session, "admin", "vendedor");
  const contact = await db.contact.findFirst({
    where: { id: contactId, tenantId: session.tenantId },
  });
  if (!contact) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!contact.phoneE164) {
    throw new ApiError("validacao", "Contato sem telefone E.164.");
  }
  const result = await channelSimulateInboundPort.ingestInbound({
    tenantId: session.tenantId,
    inboxId: input.inbox_id,
    phoneE164: contact.phoneE164,
    body: input.body?.trim() || "Conversa iniciada pelo agente.",
  });
  // Mark last message as outgoing agent stub if body provided by agent — keep simulated inbound for demo path.
  const conv = await db.conversation.findFirst({
    where: { id: result.conversationId, tenantId: session.tenantId },
    include: { contact: true, labels: { include: { label: true } } },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  return conversationDto(conv);
}

export async function listEmpresas(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const q = url.searchParams.get("q")?.trim();
  const rows = await db.company.findMany({
    where: {
      tenantId: session.tenantId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
      ...(q
        ? {
            OR: [{ razaoSocial: { contains: q } }, { nomeFantasia: { contains: q } }],
          }
        : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(companyDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function createEmpresa(
  session: SessionContext,
  input: {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string | null;
    cnpj_registro_pendente?: boolean;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const digits = onlyDigits(input.cnpj);
  if (!isValidCnpj(digits)) throw new ApiError("checksum_invalido", "CNPJ inválido.");
  if (!input.razao_social.trim()) throw new ApiError("validacao", "Razão social obrigatória.");
  const existing = await db.company.findUnique({
    where: { tenantId_cnpjDigits: { tenantId: session.tenantId, cnpjDigits: digits } },
  });
  if (existing) throw new ApiError("conflito", "Empresa já cadastrada.");
  const id = newId("co");
  await db.company.create({
    data: {
      id,
      tenantId: session.tenantId,
      cnpjDigits: digits,
      cnpjLast4: digits.slice(-4),
      cnpjRegistroPendente: Boolean(input.cnpj_registro_pendente),
      razaoSocial: input.razao_social.trim(),
      nomeFantasia: input.nome_fantasia?.trim() || null,
    },
  });
  return getEmpresa(session, id);
}

export async function getEmpresa(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.company.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return companyDto(row);
}

export async function patchEmpresa(
  session: SessionContext,
  id: string,
  input: {
    razao_social?: string;
    nome_fantasia?: string | null;
    cnpj_registro_pendente?: boolean;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.company.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.company.update({
    where: { id },
    data: {
      razaoSocial: input.razao_social?.trim(),
      nomeFantasia: input.nome_fantasia === undefined ? undefined : input.nome_fantasia,
      cnpjRegistroPendente: input.cnpj_registro_pendente,
    },
  });
  return getEmpresa(session, id);
}

/** Upsert Company + Contact links on cadastro approve. */
export async function linkCadastroApprove(input: {
  tenantId: string;
  clienteId: string;
  cadastroRequestId: string;
  cnpjDigits: string;
  cnpjLast4: string;
  cnpjRegistroPendente: boolean;
  razaoSocial: string;
  contatoNome: string;
  email: string;
  whatsapp: string;
}) {
  let company = await db.company.findUnique({
    where: {
      tenantId_cnpjDigits: { tenantId: input.tenantId, cnpjDigits: input.cnpjDigits },
    },
  });
  if (!company) {
    company = await db.company.create({
      data: {
        id: newId("co"),
        tenantId: input.tenantId,
        cnpjDigits: input.cnpjDigits,
        cnpjLast4: input.cnpjLast4,
        cnpjRegistroPendente: input.cnpjRegistroPendente,
        razaoSocial: input.razaoSocial,
      },
    });
  }

  let contact =
    (await db.contact.findFirst({
      where: { tenantId: input.tenantId, phoneE164: input.whatsapp },
    })) ??
    (await db.contact.findFirst({
      where: { tenantId: input.tenantId, email: input.email },
    }));

  if (!contact) {
    contact = await db.contact.create({
      data: {
        id: newId("ct"),
        tenantId: input.tenantId,
        nome: input.contatoNome,
        email: input.email,
        phoneE164: input.whatsapp,
        companyId: company.id,
        clienteId: input.clienteId,
        cadastroRequestId: input.cadastroRequestId,
      },
    });
  } else {
    contact = await db.contact.update({
      where: { id: contact.id },
      data: {
        nome: input.contatoNome,
        email: input.email,
        phoneE164: input.whatsapp,
        companyId: company.id,
        clienteId: input.clienteId,
        cadastroRequestId: input.cadastroRequestId,
      },
    });
  }

  await db.cliente.update({
    where: { id: input.clienteId },
    data: { companyId: company.id, primaryContactId: contact.id },
  });
  await db.cadastroRequest.update({
    where: { id: input.cadastroRequestId },
    data: { contactId: contact.id },
  });

  const inbox = await getDefaultWhatsappInbox(input.tenantId);
  if (inbox && input.whatsapp) {
    const ci = await db.contactInbox.findFirst({
      where: {
        tenantId: input.tenantId,
        inboxId: inbox.id,
        sourceId: input.whatsapp,
      },
    });
    if (!ci) {
      await db.contactInbox.create({
        data: {
          id: newId("ci"),
          tenantId: input.tenantId,
          contactId: contact.id,
          inboxId: inbox.id,
          sourceId: input.whatsapp,
        },
      });
    }
  }

  return { companyId: company.id, contactId: contact.id };
}
