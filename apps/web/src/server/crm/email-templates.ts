import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function sanitizeHtml(html: string) {
  // Stub sanitizer — strip script tags; full HTML sanitizer is out of MVP.
  return html.replace(/<\/?script\b[^>]*>/gi, "");
}

function templateDto(row: {
  id: string;
  name: string;
  slug: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subject_template: row.subjectTemplate,
    body_html_template: row.bodyHtmlTemplate,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listEmailTemplates(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.emailTemplate.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });
  return { items: rows.map(templateDto) };
}

export async function createEmailTemplate(
  session: SessionContext,
  input: {
    name: string;
    slug?: string;
    subject_template: string;
    body_html_template: string;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name.trim() || !input.subject_template.trim() || !input.body_html_template.trim()) {
    throw new ApiError("validacao", "Nome, assunto e corpo são obrigatórios.");
  }
  const slug = (input.slug?.trim() || slugify(input.name)) || newId("tpl");
  const existing = await db.emailTemplate.findUnique({
    where: { tenantId_slug: { tenantId: session.tenantId, slug } },
  });
  if (existing) throw new ApiError("conflito", "Slug de modelo já existe.");
  const row = await db.emailTemplate.create({
    data: {
      id: newId("etpl"),
      tenantId: session.tenantId,
      name: input.name.trim(),
      slug,
      subjectTemplate: input.subject_template.trim(),
      bodyHtmlTemplate: sanitizeHtml(input.body_html_template),
    },
  });
  return templateDto(row);
}

export async function getEmailTemplate(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.emailTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return templateDto(row);
}

export async function patchEmailTemplate(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    slug?: string;
    subject_template?: string;
    body_html_template?: string;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.emailTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.slug && input.slug !== row.slug) {
    const clash = await db.emailTemplate.findUnique({
      where: { tenantId_slug: { tenantId: session.tenantId, slug: input.slug } },
    });
    if (clash) throw new ApiError("conflito", "Slug de modelo já existe.");
  }
  const updated = await db.emailTemplate.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      slug: input.slug?.trim(),
      subjectTemplate: input.subject_template?.trim(),
      bodyHtmlTemplate:
        input.body_html_template === undefined
          ? undefined
          : sanitizeHtml(input.body_html_template),
    },
  });
  return templateDto(updated);
}

export async function deleteEmailTemplate(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.emailTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.emailTemplate.delete({ where: { id } });
  return { id, deleted: true };
}
