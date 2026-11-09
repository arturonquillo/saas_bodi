import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { urlEgressGuard } from "../ports/egress";
import { appendDomainEvent } from "./events";
import { assertConversationVisible } from "./visibility";

export function dashboardAppDto(row: {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  inboxIdsJson: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  let inbox_ids: string[] | null = null;
  if (row.inboxIdsJson) {
    try {
      const parsed = JSON.parse(row.inboxIdsJson) as unknown;
      if (Array.isArray(parsed)) {
        inbox_ids = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      inbox_ids = null;
    }
  }
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    enabled: row.enabled,
    inbox_ids,
    position: row.position,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listAppsPainel(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.dashboardApp.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ position: "asc" }, { title: "asc" }],
  });
  return { items: rows.map(dashboardAppDto) };
}

export async function createAppPainel(
  session: SessionContext,
  input: {
    title: string;
    url: string;
    enabled?: boolean;
    inbox_ids?: string[] | null;
    position?: number;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.title?.trim()) throw new ApiError("validacao", "Título obrigatório.");
  if (!input.url?.trim()) throw new ApiError("validacao", "URL obrigatória.");
  const safe = await urlEgressGuard.assertSafeHttpsUrl(input.url.trim());
  const id = newId("dap");
  await db.dashboardApp.create({
    data: {
      id,
      tenantId: session.tenantId,
      title: input.title.trim(),
      url: safe.href,
      enabled: input.enabled !== false,
      inboxIdsJson:
        input.inbox_ids === undefined || input.inbox_ids === null
          ? null
          : JSON.stringify(input.inbox_ids),
      position: input.position ?? 0,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "dashboard_app.updated",
    aggregateType: "dashboard_app",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { dashboard_app_id: id, created: true },
  });
  return getAppPainel(session, id);
}

export async function getAppPainel(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.dashboardApp.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return dashboardAppDto(row);
}

export async function patchAppPainel(
  session: SessionContext,
  id: string,
  input: {
    title?: string;
    url?: string;
    enabled?: boolean;
    inbox_ids?: string[] | null;
    position?: number;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.dashboardApp.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  let url = input.url;
  if (url !== undefined) {
    const safe = await urlEgressGuard.assertSafeHttpsUrl(url.trim());
    url = safe.href;
  }
  await db.dashboardApp.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      url,
      enabled: input.enabled,
      position: input.position,
      inboxIdsJson:
        input.inbox_ids === undefined
          ? undefined
          : input.inbox_ids === null
            ? null
            : JSON.stringify(input.inbox_ids),
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "dashboard_app.updated",
    aggregateType: "dashboard_app",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { dashboard_app_id: id },
  });
  return getAppPainel(session, id);
}

export async function deleteAppPainel(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.dashboardApp.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.dashboardApp.delete({ where: { id } });
  return { ok: true };
}

export async function listAppsPainelForConversation(
  session: SessionContext,
  conversationId: string,
) {
  assertSaasRole(session, "admin", "vendedor");
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
  });
  if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, conv);
  const rows = await db.dashboardApp.findMany({
    where: { tenantId: session.tenantId, enabled: true },
    orderBy: [{ position: "asc" }, { title: "asc" }],
  });
  const items = rows
    .map(dashboardAppDto)
    .filter((app) => !app.inbox_ids || app.inbox_ids.includes(conv.inboxId));
  return { items };
}
