import type {
  ConversationPriority,
  ConversationStatus,
  SystemIntentLabel,
} from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { channelSimulateInboundPort, stubChannelSendPort } from "../ports/channel";
import { appendDomainEvent } from "./events";
import { conversationDto, messageDto } from "./dto";
import { assertConversationVisible, conversationVisibilityFilter } from "./visibility";
import { ensureJobWorkerStarted, jobEnqueuePort } from "../ports/jobs";

const MENTION_RE = /@\[user_id:([^\]]+)\]/g;

async function loadConversation(tenantId: string, id: string) {
  return db.conversation.findFirst({
    where: { id, tenantId },
    include: {
      contact: true,
      labels: { include: { label: true } },
      inbox: { select: { vendedorSeeAll: true } },
    },
  });
}

export async function listConversas(session: SessionContext, url: URL) {
  ensureJobWorkerStarted();
  assertSaasRole(session, "admin", "vendedor");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const visibility = await conversationVisibilityFilter(session);

  const status = url.searchParams.get("status") as ConversationStatus | null;
  const inboxId = url.searchParams.get("inbox_id");
  const assignee = url.searchParams.get("assignee");
  const teamId = url.searchParams.get("team_id");
  const label = url.searchParams.get("label");
  const q = url.searchParams.get("q")?.trim();
  const updatedSince = url.searchParams.get("updated_since");

  const rows = await db.conversation.findMany({
    where: {
      ...visibility,
      ...(status ? { status } : {}),
      ...(inboxId ? { inboxId } : {}),
      ...(assignee === "me"
        ? { assigneeUserId: session.userId }
        : assignee === "unassigned"
          ? { assigneeUserId: null }
          : assignee
            ? { assigneeUserId: assignee }
            : {}),
      ...(teamId ? { teamId } : {}),
      ...(label
        ? { labels: { some: { label: { title: label } } } }
        : {}),
      ...(q
        ? {
            OR: [
              { contact: { nome: { contains: q } } },
              { contact: { phoneE164: { contains: q } } },
              { id: { contains: q } },
            ],
          }
        : {}),
      ...(updatedSince ? { updatedAt: { gte: new Date(updatedSince) } } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    include: {
      contact: true,
      labels: { include: { label: true } },
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "asc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(conversationDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getConversa(session: SessionContext, id: string) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, id);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);
  const draft = await db.conversationDraft.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.userId } },
  });
  const viewers = await db.agentPresence.findMany({
    where: {
      tenantId: session.tenantId,
      conversationId: id,
      expiresAt: { gt: new Date() },
      userId: { not: session.userId },
      state: "viewing",
    },
    include: { user: { select: { id: true, nome: true } } },
  });
  return {
    ...conversationDto(row),
    draft: draft?.body ?? "",
    viewers: viewers.map((v) => ({
      user_id: v.userId,
      nome: v.user.nome,
    })),
  };
}

export async function patchConversa(
  session: SessionContext,
  id: string,
  input: {
    status?: ConversationStatus;
    priority?: ConversationPriority | null;
    assignee_user_id?: string | null;
    team_id?: string | null;
    muted?: boolean;
    snoozed_until?: string | null;
    cliente_id?: string | null;
    cadastro_request_id?: string | null;
    orcamento_id?: string | null;
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, id);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);

  if (input.assignee_user_id) {
    const mem = await db.membership.findFirst({
      where: {
        tenantId: session.tenantId,
        userId: input.assignee_user_id,
        saasRole: { not: null },
      },
    });
    if (!mem) throw new ApiError("validacao", "Responsável inválido.");
  }
  if (input.team_id) {
    const team = await db.team.findFirst({
      where: { id: input.team_id, tenantId: session.tenantId },
    });
    if (!team) throw new ApiError("nao_encontrado", "Não encontrado.");
  }
  for (const [key, value] of [
    ["cliente_id", input.cliente_id],
    ["cadastro_request_id", input.cadastro_request_id],
    ["orcamento_id", input.orcamento_id],
  ] as const) {
    if (value) {
      if (key === "cliente_id") {
        const c = await db.cliente.findFirst({ where: { id: value, tenantId: session.tenantId } });
        if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
      }
      if (key === "cadastro_request_id") {
        const c = await db.cadastroRequest.findFirst({
          where: { id: value, tenantId: session.tenantId },
        });
        if (!c) throw new ApiError("nao_encontrado", "Não encontrado.");
      }
      if (key === "orcamento_id") {
        const o = await db.orcamento.findFirst({ where: { id: value, tenantId: session.tenantId } });
        if (!o) throw new ApiError("nao_encontrado", "Não encontrado.");
      }
    }
  }

  const statusChanged = input.status !== undefined && input.status !== row.status;
  const assignedChanged =
    input.assignee_user_id !== undefined && input.assignee_user_id !== row.assigneeUserId;

  if (input.status === "resolved") {
    const inbox = await db.inbox.findFirst({
      where: { id: row.inboxId, tenantId: session.tenantId },
    });
    let requiredKeys: string[] = [];
    try {
      const parsed = JSON.parse(inbox?.requiredAttributeKeysOnResolveJson || "[]") as unknown;
      if (Array.isArray(parsed)) {
        requiredKeys = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      requiredKeys = [];
    }
    if (requiredKeys.length) {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = JSON.parse(row.customAttributesJson || "{}") as Record<string, unknown>;
      } catch {
        attrs = {};
      }
      const missing = requiredKeys.filter((k) => {
        const v = attrs[k];
        return v === undefined || v === null || v === "";
      });
      if (missing.length) {
        throw new ApiError(
          "validacao",
          `Atributos obrigatórios ausentes para resolver: ${missing.join(", ")}`,
        );
      }
    }
  }

  await db.conversation.update({
    where: { id },
    data: {
      status: input.status,
      priority: input.priority === undefined ? undefined : input.priority,
      assigneeUserId: input.assignee_user_id === undefined ? undefined : input.assignee_user_id,
      teamId: input.team_id === undefined ? undefined : input.team_id,
      muted: input.muted,
      snoozedUntil:
        input.snoozed_until === undefined
          ? undefined
          : input.snoozed_until
            ? new Date(input.snoozed_until)
            : null,
      clienteId: input.cliente_id === undefined ? undefined : input.cliente_id,
      cadastroRequestId:
        input.cadastro_request_id === undefined ? undefined : input.cadastro_request_id,
      orcamentoId: input.orcamento_id === undefined ? undefined : input.orcamento_id,
      lastActivityAt: new Date(),
    },
  });

  if (statusChanged) {
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "conversation.status_changed",
      aggregateType: "conversation",
      aggregateId: id,
      actorUserId: session.userId,
      payload: {
        conversation_id: id,
        inbox_id: row.inboxId,
        from: row.status,
        to: input.status,
      },
    });
    if (input.status === "resolved") {
      const inbox = await db.inbox.findFirst({
        where: { id: row.inboxId, tenantId: session.tenantId },
      });
      if (inbox?.csatEnabled) {
        await jobEnqueuePort.enqueue({
          tenantId: session.tenantId,
          kind: "csat.deliver",
          payload: {
            tenant_id: session.tenantId,
            conversation_id: id,
          },
        });
      }
    }
    const sla = await db.conversationSla.findFirst({
      where: { tenantId: session.tenantId, conversationId: id },
    });
    if (sla) {
      await jobEnqueuePort.enqueue({
        tenantId: session.tenantId,
        kind: "sla.evaluate",
        payload: { tenant_id: session.tenantId, conversation_id: id },
      });
    }
  }
  if (assignedChanged) {
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "conversation.assigned",
      aggregateType: "conversation",
      aggregateId: id,
      actorUserId: session.userId,
      payload: {
        conversation_id: id,
        assignee_user_id: input.assignee_user_id,
      },
    });
    if (input.assignee_user_id) {
      await db.agentNotification.create({
        data: {
          id: newId("ntf"),
          tenantId: session.tenantId,
          userId: input.assignee_user_id,
          type: "assigned",
          title: "Conversa atribuída",
          body: `Você foi atribuído à conversa ${id}`,
          conversationId: id,
        },
      });
    }
  }
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "conversation.updated",
    aggregateType: "conversation",
    aggregateId: id,
    actorUserId: session.userId,
    payload: { conversation_id: id },
  });

  return getConversa(session, id);
}

export async function bulkConversas(
  session: SessionContext,
  input: {
    ids: string[];
    action: "assign" | "resolve" | "label" | "mute";
    params?: {
      assignee_user_id?: string | null;
      label_ids?: string[];
      muted?: boolean;
    };
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  if (!input.ids?.length) throw new ApiError("validacao", "Informe ids.");
  const results = [];
  for (const id of input.ids) {
    if (input.action === "assign") {
      results.push(
        await patchConversa(session, id, { assignee_user_id: input.params?.assignee_user_id ?? null }),
      );
    } else if (input.action === "resolve") {
      results.push(await patchConversa(session, id, { status: "resolved" }));
    } else if (input.action === "mute") {
      results.push(await patchConversa(session, id, { muted: input.params?.muted ?? true }));
    } else if (input.action === "label") {
      results.push(await setConversationLabels(session, id, input.params?.label_ids ?? [], "add"));
    }
  }
  return { items: results };
}

export async function listMensagens(session: SessionContext, conversationId: string, url: URL) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, conversationId);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);

  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const after = url.searchParams.get("after");

  const rows = await db.message.findMany({
    where: {
      tenantId: session.tenantId,
      conversationId,
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(messageDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function postMensagem(
  session: SessionContext,
  conversationId: string,
  input: {
    content: string;
    private?: boolean;
    content_type?: "text" | "attachment" | "input_select" | "cards" | "form";
  },
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, conversationId);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);
  if (!input.content?.trim()) throw new ApiError("validacao", "Conteúdo obrigatório.");

  const inboxMeta = await db.inbox.findFirst({
    where: { id: row.inboxId, tenantId: session.tenantId },
  });
  const { assertInteractiveContentAllowed } = await import("./channels");
  assertInteractiveContentAllowed(inboxMeta?.channelType ?? "whatsapp", input.content_type);

  const isPrivate = Boolean(input.private);
  const messageId = newId("msg");
  let deliveryStatus: "queued" | "sent" | "failed" = "queued";

  let content = input.content.trim();
  if (!isPrivate && session.userId && session.userId !== "system") {
    const sender = await db.user.findUnique({ where: { id: session.userId } });
    if (sender?.signature?.trim()) {
      content = `${content}\n\n${sender.signature.trim()}`;
    }
  }

  if (!isPrivate) {
    const contact = row.contact;
    const to = contact.phoneE164;
    if (to) {
      const send = await stubChannelSendPort.sendOutgoing({
        tenantId: session.tenantId,
        inboxId: row.inboxId,
        conversationId,
        messageId,
        toE164: to,
        body: content,
      });
      deliveryStatus = send.deliveryStatus;
    } else {
      deliveryStatus = "sent";
    }
  } else {
    deliveryStatus = "sent";
  }

  await db.message.create({
    data: {
      id: messageId,
      tenantId: session.tenantId,
      conversationId,
      messageType: "outgoing",
      private: isPrivate,
      content,
      contentType: input.content_type ?? "text",
      senderUserId: session.userId === "system" ? null : session.userId,
      deliveryStatus,
      simulated: true,
    },
  });

  // Mentions → AgentNotification type=mention
  const mentioned = new Set<string>();
  for (const m of content.matchAll(MENTION_RE)) {
    if (m[1]) mentioned.add(m[1]);
  }
  for (const userId of mentioned) {
    const mem = await db.membership.findFirst({
      where: { tenantId: session.tenantId, userId, saasRole: { not: null } },
    });
    if (!mem) continue;
    await db.agentNotification.create({
      data: {
        id: newId("ntf"),
        tenantId: session.tenantId,
        userId,
        type: "mention",
        title: "Você foi mencionado",
        body: `Menção na conversa ${conversationId}`,
        conversationId,
      },
    });
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "mention.created",
      aggregateType: "message",
      aggregateId: messageId,
      actorUserId: session.userId === "system" ? null : session.userId,
      payload: { conversation_id: conversationId, message_id: messageId, user_id: userId },
    });
  }

  // Agent reply while bot-owned → handoff to open
  if (!isPrivate && row.botAgentBotId) {
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
      actorUserId: session.userId === "system" ? null : session.userId,
      payload: { conversation_id: conversationId, reason: "agent_reply" },
    });
  } else {
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date() },
    });
  }

  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "message.created",
    aggregateType: "message",
    aggregateId: messageId,
    actorUserId: session.userId === "system" ? null : session.userId,
    payload: {
      conversation_id: conversationId,
      inbox_id: row.inboxId,
      message_id: messageId,
      private: isPrivate,
      message_type: "outgoing",
    },
  });

  if (!isPrivate) {
    const sla = await db.conversationSla.findFirst({
      where: { tenantId: session.tenantId, conversationId },
    });
    if (sla) {
      await jobEnqueuePort.enqueue({
        tenantId: session.tenantId,
        kind: "sla.evaluate",
        payload: { tenant_id: session.tenantId, conversation_id: conversationId },
      });
    }
  }

  const msg = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  return messageDto(msg);
}

export async function setConversationLabels(
  session: SessionContext,
  conversationId: string,
  labelIds: string[],
  mode: "replace" | "add" = "replace",
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, conversationId);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);

  const labels = await db.label.findMany({
    where: { tenantId: session.tenantId, id: { in: labelIds } },
  });
  if (labels.length !== labelIds.length) {
    throw new ApiError("validacao", "Label inválida.");
  }

  await db.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.conversationLabel.deleteMany({
        where: { tenantId: session.tenantId, conversationId },
      });
    }
    for (const label of labels) {
      const exists = await tx.conversationLabel.findUnique({
        where: { conversationId_labelId: { conversationId, labelId: label.id } },
      });
      if (!exists) {
        await tx.conversationLabel.create({
          data: {
            id: newId("clb"),
            tenantId: session.tenantId,
            conversationId,
            labelId: label.id,
          },
        });
      }
    }
  });
  return getConversa(session, conversationId);
}

export async function putDraft(
  session: SessionContext,
  conversationId: string,
  body: string,
) {
  assertSaasRole(session, "admin", "vendedor");
  const row = await loadConversation(session.tenantId, conversationId);
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertConversationVisible(session, row);

  const existing = await db.conversationDraft.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });
  if (existing) {
    await db.conversationDraft.update({
      where: { id: existing.id },
      data: { body: body ?? "" },
    });
  } else {
    await db.conversationDraft.create({
      data: {
        id: newId("drf"),
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
        body: body ?? "",
      },
    });
  }
  return { conversation_id: conversationId, body: body ?? "" };
}

export async function simularInbound(
  session: SessionContext,
  input: {
    inbox_id?: string;
    phone_e164: string;
    body: string;
    intent_label?: SystemIntentLabel;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.phone_e164?.trim() || !input.body?.trim()) {
    throw new ApiError("validacao", "Telefone e mensagem são obrigatórios.");
  }
  const result = await channelSimulateInboundPort.ingestInbound({
    tenantId: session.tenantId,
    inboxId: input.inbox_id,
    phoneE164: input.phone_e164.trim(),
    body: input.body.trim(),
    intentLabel: input.intent_label,
  });
  return getConversa(session, result.conversationId);
}
