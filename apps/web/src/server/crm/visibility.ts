import type { SessionContext } from "../authz/session";
import { db } from "../db";
import { ApiError } from "../http/respond";

export type ConversationVisibilityRow = {
  id: string;
  tenantId: string;
  inboxId: string;
  assigneeUserId: string | null;
  teamId: string | null;
  inbox?: { vendedorSeeAll: boolean };
};

export async function assertConversationVisible(
  session: SessionContext,
  conversation: ConversationVisibilityRow,
) {
  if (conversation.tenantId !== session.tenantId) {
    throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  if (session.saasRole === "admin") return;

  const member = await db.inboxMember.findFirst({
    where: {
      tenantId: session.tenantId,
      inboxId: conversation.inboxId,
      userId: session.userId,
    },
  });
  if (!member) throw new ApiError("nao_encontrado", "Não encontrado.");

  const inbox =
    conversation.inbox ??
    (await db.inbox.findFirst({
      where: { id: conversation.inboxId, tenantId: session.tenantId },
      select: { vendedorSeeAll: true },
    }));
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (inbox.vendedorSeeAll) return;

  if (conversation.assigneeUserId === session.userId) return;
  if (conversation.assigneeUserId == null) return;
  if (conversation.teamId) {
    const tm = await db.teamMember.findFirst({
      where: {
        tenantId: session.tenantId,
        teamId: conversation.teamId,
        userId: session.userId,
      },
    });
    if (tm) return;
  }
  throw new ApiError("nao_encontrado", "Não encontrado.");
}

export async function conversationVisibilityFilter(session: SessionContext) {
  if (session.saasRole === "admin") {
    return { tenantId: session.tenantId };
  }
  const memberships = await db.inboxMember.findMany({
    where: { tenantId: session.tenantId, userId: session.userId },
    select: { inboxId: true },
  });
  const inboxIds = memberships.map((m) => m.inboxId);
  if (!inboxIds.length) {
    return { tenantId: session.tenantId, id: "__none__" };
  }
  const teamMemberships = await db.teamMember.findMany({
    where: { tenantId: session.tenantId, userId: session.userId },
    select: { teamId: true },
  });
  const teamIds = teamMemberships.map((t) => t.teamId);
  return {
    tenantId: session.tenantId,
    inboxId: { in: inboxIds },
    OR: [
      { assigneeUserId: session.userId },
      { assigneeUserId: null },
      ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
      { inbox: { vendedorSeeAll: true } },
    ],
  };
}

export async function assertInboxMember(session: SessionContext, inboxId: string) {
  if (session.saasRole === "admin") return;
  const member = await db.inboxMember.findFirst({
    where: { tenantId: session.tenantId, inboxId, userId: session.userId },
  });
  if (!member) throw new ApiError("nao_encontrado", "Não encontrado.");
}
