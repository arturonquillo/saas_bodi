import type { AgentAvailability, PresenceState } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { appendDomainEvent, fanoutCrmEvent } from "./events";
import { companyDto, contactDto, conversationDto, labelDto } from "./dto";
import { conversationVisibilityFilter } from "./visibility";

export async function listLabels(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const rows = await db.label.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { title: "asc" },
  });
  return { items: rows.map(labelDto) };
}

export async function createLabel(
  session: SessionContext,
  input: { title: string; color?: string; show_on_sidebar?: boolean },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.title.trim()) throw new ApiError("validacao", "Título obrigatório.");
  const existing = await db.label.findUnique({
    where: { tenantId_title: { tenantId: session.tenantId, title: input.title.trim() } },
  });
  if (existing) throw new ApiError("conflito", "Label já existe.");
  const row = await db.label.create({
    data: {
      id: newId("lbl"),
      tenantId: session.tenantId,
      title: input.title.trim(),
      color: input.color ?? "#1F5C6B",
      showOnSidebar: input.show_on_sidebar ?? true,
      system: false,
    },
  });
  return labelDto(row);
}

export async function patchLabel(
  session: SessionContext,
  id: string,
  input: { title?: string; color?: string; show_on_sidebar?: boolean },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.label.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.system && input.title && input.title !== row.title) {
    throw new ApiError("validacao", "Não é permitido renomear label de sistema.");
  }
  const updated = await db.label.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      color: input.color,
      showOnSidebar: input.show_on_sidebar,
    },
  });
  return labelDto(updated);
}

export async function deleteLabel(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.label.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.system) throw new ApiError("validacao", "Não é permitido excluir label de sistema.");
  await db.label.delete({ where: { id } });
  return { ok: true };
}

export async function listTeams(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const rows = await db.team.findMany({
    where: { tenantId: session.tenantId },
    include: { members: true },
    orderBy: { name: "asc" },
  });
  return {
    items: rows.map((t) => ({
      id: t.id,
      name: t.name,
      member_ids: t.members.map((m) => m.userId),
      created_at: t.createdAt.toISOString(),
    })),
  };
}

export async function createTeam(session: SessionContext, name: string) {
  assertSaasRole(session, "admin");
  if (!name.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const row = await db.team.create({
    data: { id: newId("team"), tenantId: session.tenantId, name: name.trim() },
  });
  return { id: row.id, name: row.name, member_ids: [], created_at: row.createdAt.toISOString() };
}

export async function patchTeam(session: SessionContext, id: string, name: string) {
  assertSaasRole(session, "admin");
  const row = await db.team.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  const updated = await db.team.update({ where: { id }, data: { name: name.trim() } });
  const members = await db.teamMember.findMany({ where: { teamId: id } });
  return {
    id: updated.id,
    name: updated.name,
    member_ids: members.map((m) => m.userId),
    created_at: updated.createdAt.toISOString(),
  };
}

export async function getTeamMembers(session: SessionContext, teamId: string) {
  assertSaasRole(session, "admin");
  const team = await db.team.findFirst({ where: { id: teamId, tenantId: session.tenantId } });
  if (!team) throw new ApiError("nao_encontrado", "Não encontrado.");
  const members = await db.teamMember.findMany({
    where: { tenantId: session.tenantId, teamId },
  });
  return { user_ids: members.map((m) => m.userId) };
}

export async function putTeamMembers(session: SessionContext, teamId: string, userIds: string[]) {
  assertSaasRole(session, "admin");
  const team = await db.team.findFirst({ where: { id: teamId, tenantId: session.tenantId } });
  if (!team) throw new ApiError("nao_encontrado", "Não encontrado.");
  const unique = [...new Set(userIds)];
  for (const uid of unique) {
    const mem = await db.membership.findFirst({
      where: { tenantId: session.tenantId, userId: uid, saasRole: { not: null } },
    });
    if (!mem) throw new ApiError("validacao", "Membro inválido.");
  }
  await db.$transaction(async (tx) => {
    await tx.teamMember.deleteMany({ where: { tenantId: session.tenantId, teamId } });
    for (const uid of unique) {
      await tx.teamMember.create({
        data: {
          id: newId("tm"),
          tenantId: session.tenantId,
          teamId,
          userId: uid,
        },
      });
    }
  });
  return getTeamMembers(session, teamId);
}

function cannedDto(row: { id: string; shortCode: string; content: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id,
    short_code: row.shortCode,
    content: row.content,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listCanned(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  const rows = await db.cannedResponse.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { shortCode: "asc" },
  });
  return { items: rows.map(cannedDto) };
}

export async function createCanned(
  session: SessionContext,
  input: { short_code: string; content: string },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.short_code.trim() || !input.content.trim()) {
    throw new ApiError("validacao", "Código e conteúdo são obrigatórios.");
  }
  const row = await db.cannedResponse.create({
    data: {
      id: newId("can"),
      tenantId: session.tenantId,
      shortCode: input.short_code.trim().replace(/^\//, ""),
      content: input.content,
    },
  });
  return cannedDto(row);
}

export async function patchCanned(
  session: SessionContext,
  id: string,
  input: { short_code?: string; content?: string },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.cannedResponse.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  const updated = await db.cannedResponse.update({
    where: { id },
    data: {
      shortCode: input.short_code?.trim().replace(/^\//, ""),
      content: input.content,
    },
  });
  return cannedDto(updated);
}

export async function deleteCanned(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.cannedResponse.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.cannedResponse.delete({ where: { id } });
  return { ok: true };
}

export async function listNotificacoes(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const rows = await db.agentNotification.findMany({
    where: {
      tenantId: session.tenantId,
      userId: session.userId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      conversation_id: n.conversationId,
      read_at: n.readAt?.toISOString() ?? null,
      created_at: n.createdAt.toISOString(),
    })),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function markNotificacaoLida(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.agentNotification.findFirst({
    where: { id, tenantId: session.tenantId, userId: session.userId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.agentNotification.update({ where: { id }, data: { readAt: new Date() } });
  return { ok: true };
}

export async function getNotificacaoPrefs(session: SessionContext) {
  assertSaasRole(session, "admin", "vendedor");
  let row = await db.agentNotificationSetting.findUnique({ where: { userId: session.userId } });
  if (!row) {
    row = await db.agentNotificationSetting.create({
      data: {
        id: newId("ans"),
        tenantId: session.tenantId,
        userId: session.userId,
      },
    });
  }
  return {
    assigned: row.assigned,
    unassigned_conversation: row.unassignedConversation,
    conversation_activity: row.conversationActivity,
    email_enabled: row.emailEnabled,
  };
}

export async function putNotificacaoPrefs(
  session: SessionContext,
  input: {
    assigned?: boolean;
    unassigned_conversation?: boolean;
    conversation_activity?: boolean;
    email_enabled?: boolean;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  await getNotificacaoPrefs(session);
  await db.agentNotificationSetting.update({
    where: { userId: session.userId },
    data: {
      assigned: input.assigned,
      unassignedConversation: input.unassigned_conversation,
      conversationActivity: input.conversation_activity,
      emailEnabled: input.email_enabled,
    },
  });
  return getNotificacaoPrefs(session);
}

export async function patchPerfil(
  session: SessionContext,
  input: { availability?: AgentAvailability; signature?: string | null },
) {
  assertSaasRole(session, "admin", "vendedor");
  const user = await db.user.update({
    where: { id: session.userId },
    data: {
      availability: input.availability,
      signature: input.signature === undefined ? undefined : input.signature,
    },
  });
  return {
    availability: user.availability,
    signature: user.signature,
  };
}

export async function postPresence(
  session: SessionContext,
  input: { conversation_id?: string | null; state: PresenceState },
) {
  assertSaasRole(session, "admin", "vendedor");
  const ttlMs = input.state === "typing" ? 5_000 : 25_000;
  const expiresAt = new Date(Date.now() + ttlMs);

  if (input.state === "online" || input.state === "busy" || input.state === "offline") {
    await db.user.update({
      where: { id: session.userId },
      data: { availability: input.state === "offline" ? "offline" : input.state },
    });
  }

  if (input.conversation_id) {
    const conv = await db.conversation.findFirst({
      where: { id: input.conversation_id, tenantId: session.tenantId },
    });
    if (!conv) throw new ApiError("nao_encontrado", "Não encontrado.");

    const existing = await db.agentPresence.findFirst({
      where: {
        tenantId: session.tenantId,
        userId: session.userId,
        conversationId: input.conversation_id,
      },
    });
    const id = existing?.id ?? newId("prs");
    if (existing) {
      await db.agentPresence.update({
        where: { id },
        data: { state: input.state, expiresAt },
      });
    } else {
      await db.agentPresence.create({
        data: {
          id,
          tenantId: session.tenantId,
          userId: session.userId,
          conversationId: input.conversation_id,
          state: input.state,
          expiresAt,
        },
      });
    }

    const type = input.state === "typing" ? "agent.typing" : "agent.viewing";
    const evt = await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type,
      aggregateType: "conversation",
      aggregateId: input.conversation_id,
      actorUserId: session.userId,
      payload: {
        conversation_id: input.conversation_id,
        user_id: session.userId,
        state: input.state,
      },
    });
    fanoutCrmEvent({
      id: evt.id,
      tenantId: session.tenantId,
      type,
      createdAt: evt.createdAt,
      payload: {
        conversation_id: input.conversation_id,
        user_id: session.userId,
        state: input.state,
      },
    });
  }

  return { ok: true };
}

export async function buscaCrm(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) throw new ApiError("validacao", "Informe q com ao menos 2 caracteres.");
  const visibility = await conversationVisibilityFilter(session);

  const [conversations, contacts, messages, companies] = await Promise.all([
    db.conversation.findMany({
      where: {
        ...visibility,
        OR: [
          { id: { contains: q } },
          { contact: { nome: { contains: q } } },
          { contact: { phoneE164: { contains: q } } },
        ],
      },
      include: { contact: true, labels: { include: { label: true } } },
      take: 10,
    }),
    db.contact.findMany({
      where: {
        tenantId: session.tenantId,
        OR: [
          { nome: { contains: q } },
          { email: { contains: q } },
          { phoneE164: { contains: q } },
        ],
      },
      take: 10,
    }),
    db.message.findMany({
      where: {
        tenantId: session.tenantId,
        content: { contains: q },
        conversation: visibility,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    db.company.findMany({
      where: {
        tenantId: session.tenantId,
        OR: [{ razaoSocial: { contains: q } }, { nomeFantasia: { contains: q } }],
      },
      take: 10,
    }),
  ]);

  return {
    conversations: conversations.map(conversationDto),
    contacts: contacts.map(contactDto),
    messages: messages.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      content: m.content,
      created_at: m.createdAt.toISOString(),
    })),
    companies: companies.map(companyDto),
  };
}
