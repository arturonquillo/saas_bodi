import { ARTICLE_STATUSES, type ArticleStatus } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent } from "./events";

/** Escape HTML then apply a tiny safe markdown subset (XSS-safe). */
export function renderMarkdownSafe(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const text = para.join(" ").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out.push(`<p>${text}</p>`);
    para = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      flush();
      const level = h[1]!.length;
      out.push(`<h${level}>${h[2]}</h${level}>`);
      continue;
    }
    para.push(trimmed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
  }
  flush();
  return out.join("\n");
}

function slugify(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function portalDto(row: {
  id: string;
  name: string;
  slug: string;
  headerText: string | null;
  homepageMd: string | null;
  locale: string;
  enabled: boolean;
  customDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    header_text: row.headerText,
    homepage_md: row.homepageMd,
    locale: row.locale,
    enabled: row.enabled,
    custom_domain: null, // Phase E — ignored in C
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function categoryDto(row: {
  id: string;
  portalId: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  parentCategoryId: string | null;
}) {
  return {
    id: row.id,
    portal_id: row.portalId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    position: row.position,
    parent_category_id: row.parentCategoryId,
  };
}

function articleDto(row: {
  id: string;
  portalId: string;
  categoryId: string;
  title: string;
  slug: string;
  contentMd: string;
  contentHtml: string | null;
  status: string;
  authorUserId: string;
  publishedAt: Date | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    portal_id: row.portalId,
    category_id: row.categoryId,
    title: row.title,
    slug: row.slug,
    content_md: row.contentMd,
    content_html: row.contentHtml,
    status: row.status,
    author_user_id: row.authorUserId,
    published_at: row.publishedAt?.toISOString() ?? null,
    position: row.position,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function requirePortal(tenantId: string) {
  const portal = await db.portal.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  if (!portal) throw new ApiError("nao_encontrado", "Portal não configurado.");
  return portal;
}

export async function getPortal(session: SessionContext) {
  assertSaasRole(session, "admin");
  const portal = await db.portal.findFirst({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });
  if (!portal) return null;
  return portalDto(portal);
}

export async function putPortal(
  session: SessionContext,
  input: {
    name: string;
    slug: string;
    header_text?: string | null;
    homepage_md?: string | null;
    enabled?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new ApiError("validacao", "slug inválido.");

  const existing = await db.portal.findFirst({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });

  const enabled = input.enabled !== false;
  if (enabled) {
    // Soft-disable others — only one enabled portal per tenant in C
    await db.portal.updateMany({
      where: {
        tenantId: session.tenantId,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      data: { enabled: false },
    });
  }

  let id = existing?.id;
  if (!existing) {
    id = newId("por");
    await db.portal.create({
      data: {
        id,
        tenantId: session.tenantId,
        name: input.name.trim(),
        slug,
        headerText: input.header_text ?? null,
        homepageMd: input.homepage_md ?? null,
        locale: "pt-BR",
        enabled,
        customDomain: null,
      },
    });
  } else {
    const clash = await db.portal.findFirst({
      where: { tenantId: session.tenantId, slug, id: { not: existing.id } },
    });
    if (clash) throw new ApiError("conflito", "slug já em uso.");
    await db.portal.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        slug,
        headerText: input.header_text === undefined ? undefined : input.header_text,
        homepageMd: input.homepage_md === undefined ? undefined : input.homepage_md,
        enabled,
        locale: "pt-BR",
        customDomain: null,
      },
    });
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "portal.updated",
    aggregateType: "portal",
    aggregateId: id!,
    payload: { portal_id: id, slug, enabled },
    actorUserId: session.userId,
  });
  return getPortal(session);
}

export async function listCategorias(session: SessionContext) {
  assertSaasRole(session, "admin");
  const portal = await requirePortal(session.tenantId);
  const rows = await db.helpCategory.findMany({
    where: { tenantId: session.tenantId, portalId: portal.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return { items: rows.map(categoryDto) };
}

export async function createCategoria(
  session: SessionContext,
  input: {
    name: string;
    slug?: string;
    description?: string | null;
    position?: number;
    parent_category_id?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const portal = await requirePortal(session.tenantId);
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new ApiError("validacao", "slug inválido.");
  const clash = await db.helpCategory.findFirst({
    where: { portalId: portal.id, slug },
  });
  if (clash) throw new ApiError("conflito", "slug já em uso.");
  if (input.parent_category_id) {
    const parent = await db.helpCategory.findFirst({
      where: { id: input.parent_category_id, portalId: portal.id },
    });
    if (!parent) throw new ApiError("validacao", "Categoria pai inválida.");
  }
  const id = newId("hcat");
  await db.helpCategory.create({
    data: {
      id,
      tenantId: session.tenantId,
      portalId: portal.id,
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      position: input.position ?? 0,
      parentCategoryId: input.parent_category_id ?? null,
    },
  });
  const row = await db.helpCategory.findUniqueOrThrow({ where: { id } });
  return categoryDto(row);
}

export async function getCategoria(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.helpCategory.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return categoryDto(row);
}

export async function patchCategoria(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    position?: number;
    parent_category_id?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.helpCategory.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  const slug = input.slug !== undefined ? slugify(input.slug) : undefined;
  if (slug !== undefined) {
    if (!slug) throw new ApiError("validacao", "slug inválido.");
    const clash = await db.helpCategory.findFirst({
      where: { portalId: row.portalId, slug, id: { not: id } },
    });
    if (clash) throw new ApiError("conflito", "slug já em uso.");
  }
  await db.helpCategory.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      slug,
      description: input.description === undefined ? undefined : input.description,
      position: input.position,
      parentCategoryId:
        input.parent_category_id === undefined ? undefined : input.parent_category_id,
    },
  });
  return getCategoria(session, id);
}

export async function deleteCategoria(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.helpCategory.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  const published = await db.article.count({
    where: { categoryId: id, status: "published" },
  });
  if (published > 0) {
    throw new ApiError("conflito", "Categoria tem artigos publicados.");
  }
  await db.helpCategory.delete({ where: { id } });
  return { id, deleted: true };
}

export async function listArtigos(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin");
  const portal = await requirePortal(session.tenantId);
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("category_id");
  if (status && !(ARTICLE_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError("validacao", "status inválido.");
  }
  const rows = await db.article.findMany({
    where: {
      tenantId: session.tenantId,
      portalId: portal.id,
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(articleDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function createArtigo(
  session: SessionContext,
  input: {
    title: string;
    slug?: string;
    category_id: string;
    content_md: string;
    status?: string;
    position?: number;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.title?.trim()) throw new ApiError("validacao", "Título obrigatório.");
  if (typeof input.content_md !== "string") {
    throw new ApiError("validacao", "content_md obrigatório.");
  }
  const portal = await requirePortal(session.tenantId);
  const cat = await db.helpCategory.findFirst({
    where: { id: input.category_id, tenantId: session.tenantId, portalId: portal.id },
  });
  if (!cat) throw new ApiError("validacao", "Categoria inválida.");
  const slug = slugify(input.slug || input.title);
  if (!slug) throw new ApiError("validacao", "slug inválido.");
  const clash = await db.article.findFirst({ where: { portalId: portal.id, slug } });
  if (clash) throw new ApiError("conflito", "slug já em uso.");
  let status: ArticleStatus = "draft";
  if (input.status) {
    if (!(ARTICLE_STATUSES as readonly string[]).includes(input.status)) {
      throw new ApiError("validacao", "status inválido.");
    }
    status = input.status as ArticleStatus;
  }
  const id = newId("art");
  const html = renderMarkdownSafe(input.content_md);
  await db.article.create({
    data: {
      id,
      tenantId: session.tenantId,
      portalId: portal.id,
      categoryId: cat.id,
      title: input.title.trim(),
      slug,
      contentMd: input.content_md,
      contentHtml: html,
      status,
      authorUserId: session.userId,
      publishedAt: status === "published" ? new Date() : null,
      position: input.position ?? 0,
    },
  });
  if (status === "published") {
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "article.published",
      aggregateType: "article",
      aggregateId: id,
      payload: { article_id: id, slug },
      actorUserId: session.userId,
    });
  }
  return getArtigo(session, id);
}

export async function getArtigo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.article.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return articleDto(row);
}

export async function patchArtigo(
  session: SessionContext,
  id: string,
  input: {
    title?: string;
    slug?: string;
    category_id?: string;
    content_md?: string;
    status?: string;
    position?: number;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.article.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.category_id) {
    const cat = await db.helpCategory.findFirst({
      where: { id: input.category_id, tenantId: session.tenantId, portalId: row.portalId },
    });
    if (!cat) throw new ApiError("validacao", "Categoria inválida.");
  }
  const slug = input.slug !== undefined ? slugify(input.slug) : undefined;
  if (slug !== undefined) {
    if (!slug) throw new ApiError("validacao", "slug inválido.");
    const clash = await db.article.findFirst({
      where: { portalId: row.portalId, slug, id: { not: id } },
    });
    if (clash) throw new ApiError("conflito", "slug já em uso.");
  }
  if (input.status && !(ARTICLE_STATUSES as readonly string[]).includes(input.status)) {
    throw new ApiError("validacao", "status inválido.");
  }
  const contentHtml =
    input.content_md !== undefined ? renderMarkdownSafe(input.content_md) : undefined;
  await db.article.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      slug,
      categoryId: input.category_id,
      contentMd: input.content_md,
      contentHtml,
      status: input.status,
      position: input.position,
      publishedAt:
        input.status === "published" && row.status !== "published"
          ? new Date()
          : input.status && input.status !== "published"
            ? null
            : undefined,
    },
  });
  return getArtigo(session, id);
}

export async function deleteArtigo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.article.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.article.delete({ where: { id } });
  return { id, deleted: true };
}

export async function publicarArtigo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.article.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.article.update({
    where: { id },
    data: { status: "published", publishedAt: row.publishedAt ?? new Date() },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "article.published",
    aggregateType: "article",
    aggregateId: id,
    payload: { article_id: id, slug: row.slug },
    actorUserId: session.userId,
  });
  return getArtigo(session, id);
}

export async function despublicarArtigo(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.article.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.article.update({
    where: { id },
    data: { status: "draft", publishedAt: null },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "article.unpublished",
    aggregateType: "article",
    aggregateId: id,
    payload: { article_id: id, slug: row.slug },
    actorUserId: session.userId,
  });
  return getArtigo(session, id);
}

async function publicPortalBySlug(portalSlug: string) {
  const portal = await db.portal.findFirst({
    where: { slug: portalSlug, enabled: true },
  });
  if (!portal) throw new ApiError("nao_encontrado", "Não encontrado.");
  return portal;
}

export async function getPublicPortal(portalSlug: string) {
  const portal = await publicPortalBySlug(portalSlug);
  return {
    name: portal.name,
    slug: portal.slug,
    header_text: portal.headerText,
    homepage_md: portal.homepageMd,
    locale: portal.locale,
  };
}

export async function listPublicCategorias(portalSlug: string) {
  const portal = await publicPortalBySlug(portalSlug);
  const cats = await db.helpCategory.findMany({
    where: { portalId: portal.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const items = [];
  for (const cat of cats) {
    const published_count = await db.article.count({
      where: { categoryId: cat.id, status: "published" },
    });
    items.push({ ...categoryDto(cat), published_count });
  }
  return { items };
}

export async function listPublicArtigos(portalSlug: string, url: URL) {
  const portal = await publicPortalBySlug(portalSlug);
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const categorySlug = url.searchParams.get("category_slug");
  const q = url.searchParams.get("q")?.trim();
  let categoryId: string | undefined;
  if (categorySlug) {
    const cat = await db.helpCategory.findFirst({
      where: { portalId: portal.id, slug: categorySlug },
    });
    if (!cat) return { items: [], next_cursor: null };
    categoryId = cat.id;
  }
  const rows = await db.article.findMany({
    where: {
      portalId: portal.id,
      status: "published",
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { contentMd: { contains: q } },
            ],
          }
        : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      category_id: r.categoryId,
      published_at: r.publishedAt?.toISOString() ?? null,
      position: r.position,
    })),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getPublicArtigo(portalSlug: string, articleSlug: string) {
  const portal = await publicPortalBySlug(portalSlug);
  const row = await db.article.findFirst({
    where: { portalId: portal.id, slug: articleSlug, status: "published" },
  });
  // draft/archived → 404 (do not leak via 403)
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category_id: row.categoryId,
    content_md: row.contentMd,
    content_html: row.contentHtml ?? renderMarkdownSafe(row.contentMd),
    published_at: row.publishedAt?.toISOString() ?? null,
  };
}
