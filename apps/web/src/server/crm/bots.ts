import { randomBytes } from "node:crypto";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { urlEgressGuard } from "../ports/egress";
import { appendDomainEvent } from "./events";
import { assertConversationVisible } from "./visibility";
import { conversationDto } from "./dto";

function maskToken(token: string) {
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function botDto(
  row: {
    id: string;
    name: string;
    description: string | null;
    outgoingUrl: string;
    token: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  opts?: { revealToken?: boolean },
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    outgoing_url: row.outgoingUrl,
    token: opts?.revealToken ? row.token : maskToken(row.token),
    token_revealed: Boolean(opts?.revealToken),
    active: row.active,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listBots(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.agentBot.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });
  return { items: rows.map((r) => botDto(r)) };
}

export async function createBot(
  session: SessionContext,
  input: { name: string; description?: string | null; outgoing_url: string; active?: boolean },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  const safe = await urlEgressGuard.assertSafeHttpsUrl(input.outgoing_url);
  const id = newId("bot");
  const token = randomBytes(24).toString("hex");
  await db.agentBot.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      description: input.description ?? null,
      outgoingUrl: safe.href,
      token,
      active: input.active !== false,
    },
  });
  const row = await db.agentBot.findUniqueOrThrow({ where: { id } });
  return botDto(row, { revealToken: true });
}

export async function getBot(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.agentBot.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return botDto(row);
}

export async function patchBot(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    outgoing_url?: string;
    active?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.agentBot.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  let outgoingUrl = row.outgoingUrl;
  if (input.outgoing_url) {
    const safe = await urlEgressGuard.assertSafeHttpsUrl(input.outgoing_url);
    outgoingUrl = safe.href;
  }
  await db.agentBot.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description,
      outgoingUrl,
      active: input.active,
    },
  });
  return getBot(session, id);
}

export async function deleteBot(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.agentBot.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.agentBot.delete({ where: { id } });
  return { id, deleted: true };
}

export async function getBotInboxes(session: SessionContext, botId: string) {
  assertSaasRole(session, "admin");
  const bot = await db.agentBot.findFirst({ where: { id: botId, tenantId: session.tenantId } });
  if (!bot) throw new ApiError("nao_encontrado", "Não encontrado.");
  const links = await db.agentBotInbox.findMany({
    where: { tenantId: session.tenantId, agentBotId: botId },
  });
  return { inbox_ids: links.map((l) => l.inboxId) };
}

export async function putBotInboxes(session: SessionContext, botId: string, inboxIds: string[]) {
  assertSaasRole(session, "admin");
  const bot = await db.agentBot.findFirst({ where: { id: botId, tenantId: session.tenantId } });
  if (!bot) throw new ApiError("nao_encontrado", "Não encontrado.");
  const unique = [...new Set(inboxIds)];
  for (const inboxId of unique) {
    const inbox = await db.inbox.findFirst({
      where: { id: inboxId, tenantId: session.tenantId },
    });
    if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
    const other = await db.agentBotInbox.findFirst({
      where: { inboxId, agentBotId: { not: botId } },
    });
    if (other) {
      throw new ApiError("validacao", "Caixa já vinculada a outro bot.");
    }
  }
  await db.$transaction(async (tx) => {
    await tx.agentBotInbox.deleteMany({
      where: { tenantId: session.tenantId, agentBotId: botId },
    });
    for (const inboxId of unique) {
      await tx.agentBotInbox.create({
        data: {
          id: newId("abi"),
          tenantId: session.tenantId,
          agentBotId: botId,
          inboxId,
        },
      });
    }
  });
  return getBotInboxes(session, botId);
}

export async function handoffBot(session: SessionContext, conversationId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: session.tenantId },
    include: {
      contact: true,
      labels: { include: { label: true } },
      inbox: { select: { vendedorSeeAll: true } },
    },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);
  await db.conversation.update({
    where: { id: conversationId },
    data: {
      botAgentBotId: null,
      status: "open",
      lastActivityAt: new Date(),
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "bot.handed_off",
    aggregateType: "conversation",
    aggregateId: conversationId,
    actorUserId: session.userId,
    payload: { conversation_id: conversationId },
  });
  const updated = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { contact: true, labels: { include: { label: true } } },
  });
  return {
    ...conversationDto(updated),
    bot_agent_bot_id: null,
  };
}
