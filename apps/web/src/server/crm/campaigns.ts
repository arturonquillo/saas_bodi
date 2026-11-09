import {
  CAMPAIGN_AUDIENCE_CAP,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_KINDS,
  CAMPAIGN_STATUSES,
  type CampaignChannel,
  type CampaignKind,
  type CampaignSendPort,
  type CampaignStatus,
  type OutboxChannel,
} from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { decodeCursor, encodeCursor, parsePaging } from "../http/pagination";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { ensureJobWorkerStarted, jobEnqueuePort } from "../ports/jobs";
import { stubOutboxTransport } from "../ports/outbox";
import { appendDomainEvent } from "./events";

type Stats = { targeted: number; enviado: number; falha: number; omitido: number };

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function campaignDto(row: {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  inboxId: string | null;
  channel: string;
  audienceLabelIdsJson: string;
  templateKey: string | null;
  message: string | null;
  scheduledAt: Date | null;
  displayStatus: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdByUserId: string;
  statsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    status: row.status,
    inbox_id: row.inboxId,
    channel: row.channel,
    audience_label_ids: parseJson<string[]>(row.audienceLabelIdsJson, []),
    template_key: row.templateKey,
    message: row.message,
    scheduled_at: row.scheduledAt?.toISOString() ?? null,
    display_status: row.displayStatus,
    started_at: row.startedAt?.toISOString() ?? null,
    completed_at: row.completedAt?.toISOString() ?? null,
    created_by_user_id: row.createdByUserId,
    stats: parseJson<Stats | null>(row.statsJson, null),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function recipientDto(row: {
  id: string;
  campaignId: string;
  contactId: string;
  status: string;
  outboxId: string | null;
  error: string | null;
}) {
  return {
    id: row.id,
    campaign_id: row.campaignId,
    contact_id: row.contactId,
    status: row.status,
    outbox_id: row.outboxId,
    error: row.error,
  };
}

function assertKind(kind: string): asserts kind is CampaignKind {
  if (!(CAMPAIGN_KINDS as readonly string[]).includes(kind)) {
    throw new ApiError("validacao", "kind inválido.");
  }
}

function assertChannel(channel: string): asserts channel is CampaignChannel {
  if (!(CAMPAIGN_CHANNELS as readonly string[]).includes(channel)) {
    throw new ApiError("validacao", "channel inválido.");
  }
}

function outboxChannelFor(channel: string): OutboxChannel {
  return channel === "sms" ? "sms" : "whatsapp";
}

async function assertTemplateOnInbox(tenantId: string, inboxId: string, templateKey: string) {
  const channel = await db.channelWhatsapp.findFirst({
    where: { tenantId, inboxId },
  });
  if (!channel) throw new ApiError("validacao", "Inbox WhatsApp não encontrado.");
  const templates = parseJson<{ key?: string }[]>(channel.messageTemplatesJson, []);
  if (!templates.some((t) => t?.key === templateKey)) {
    throw new ApiError("validacao", "template_key ausente no cache stub do canal.");
  }
}

async function resolveAudienceContactIds(tenantId: string, labelIds: string[]) {
  if (!labelIds.length) return [];
  const rows = await db.contactLabel.findMany({
    where: { tenantId, labelId: { in: labelIds } },
    select: { contactId: true },
  });
  return [...new Set(rows.map((r) => r.contactId))];
}

export async function listCampanhas(session: SessionContext, url: URL) {
  assertSaasRole(session, "admin");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  if (kind && !(CAMPAIGN_KINDS as readonly string[]).includes(kind)) {
    throw new ApiError("validacao", "kind inválido.");
  }
  if (status && !(CAMPAIGN_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError("validacao", "status inválido.");
  }
  const rows = await db.campaign.findMany({
    where: {
      tenantId: session.tenantId,
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(campaignDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

export async function getCampanha(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return campaignDto(row);
}

export async function createCampanha(
  session: SessionContext,
  input: {
    title: string;
    kind: string;
    inbox_id?: string | null;
    channel?: string;
    audience_label_ids?: string[];
    template_key?: string | null;
    message?: string | null;
    description?: string | null;
    scheduled_at?: string | null;
    display_status?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.title?.trim()) throw new ApiError("validacao", "Título obrigatório.");
  assertKind(input.kind);
  const channel = input.channel ?? "whatsapp";
  assertChannel(channel);
  const audience = input.audience_label_ids ?? [];
  if (input.kind === "one_off" && audience.length === 0) {
    throw new ApiError("validacao", "audience_label_ids obrigatório para one_off.");
  }
  if (input.kind === "one_off" && !input.inbox_id) {
    throw new ApiError("validacao", "inbox_id obrigatório para one_off.");
  }
  if (input.kind === "one_off") {
    if (!input.template_key?.trim()) {
      throw new ApiError("validacao", "template_key obrigatório para one_off.");
    }
    await assertTemplateOnInbox(session.tenantId, input.inbox_id!, input.template_key.trim());
  }
  let status: CampaignStatus = "draft";
  let scheduledAt: Date | null = null;
  if (input.scheduled_at) {
    scheduledAt = new Date(input.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ApiError("validacao", "scheduled_at inválido.");
    }
    status = "scheduled";
  }
  const displayStatus =
    input.kind === "ongoing" ? input.display_status ?? "awaiting_widget" : null;
  const id = newId("cmp");
  await db.campaign.create({
    data: {
      id,
      tenantId: session.tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      status,
      inboxId: input.inbox_id ?? null,
      channel,
      audienceLabelIdsJson: JSON.stringify(audience),
      templateKey: input.template_key?.trim() || null,
      message: input.message ?? null,
      scheduledAt,
      displayStatus,
      createdByUserId: session.userId,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "campaign.created",
    aggregateType: "campaign",
    aggregateId: id,
    payload: { campaign_id: id, kind: input.kind },
    actorUserId: session.userId,
  });
  return getCampanha(session, id);
}

export async function patchCampanha(
  session: SessionContext,
  id: string,
  input: {
    title?: string;
    description?: string | null;
    inbox_id?: string | null;
    channel?: string;
    audience_label_ids?: string[];
    template_key?: string | null;
    message?: string | null;
    scheduled_at?: string | null;
    display_status?: string | null;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "draft" && row.status !== "scheduled") {
    throw new ApiError("conflito", "Campanha não é editável neste status.");
  }
  // Audience edits only allowed while draft|scheduled (enforced above).
  if (input.channel) assertChannel(input.channel);
  const nextInbox = input.inbox_id === undefined ? row.inboxId : input.inbox_id;
  const nextTemplate =
    input.template_key === undefined ? row.templateKey : input.template_key?.trim() || null;
  if (row.kind === "one_off" && nextInbox && nextTemplate) {
    await assertTemplateOnInbox(session.tenantId, nextInbox, nextTemplate);
  }
  let scheduledAt: Date | null | undefined = undefined;
  let status: string | undefined = undefined;
  if (input.scheduled_at !== undefined) {
    if (input.scheduled_at === null) {
      scheduledAt = null;
      status = "draft";
    } else {
      scheduledAt = new Date(input.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new ApiError("validacao", "scheduled_at inválido.");
      }
      status = "scheduled";
    }
  }
  await db.campaign.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      description: input.description === undefined ? undefined : input.description,
      inboxId: input.inbox_id === undefined ? undefined : input.inbox_id,
      channel: input.channel,
      audienceLabelIdsJson:
        input.audience_label_ids === undefined
          ? undefined
          : JSON.stringify(input.audience_label_ids),
      templateKey: input.template_key === undefined ? undefined : nextTemplate,
      message: input.message === undefined ? undefined : input.message,
      scheduledAt,
      status,
      displayStatus:
        row.kind === "ongoing" && input.display_status !== undefined
          ? input.display_status
          : undefined,
    },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "campaign.updated",
    aggregateType: "campaign",
    aggregateId: id,
    payload: { campaign_id: id },
    actorUserId: session.userId,
  });
  return getCampanha(session, id);
}

export async function deleteCampanha(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "draft" && row.status !== "cancelled") {
    throw new ApiError("conflito", "Só draft/cancelled podem ser excluídas.");
  }
  await db.campaign.delete({ where: { id } });
  return { id, deleted: true };
}

export async function enviarCampanha(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "draft" && row.status !== "scheduled") {
    throw new ApiError("conflito", "Campanha não pode ser enviada neste status.");
  }

  if (row.kind === "ongoing") {
    // Phase D: if target widget inbox is ready_stub, flip display_status to ready.
    let displayStatus: string = "awaiting_widget";
    const widgetInboxId = row.inboxId;
    if (widgetInboxId) {
      const widget = await db.channelWebsiteWidget.findFirst({
        where: { tenantId: session.tenantId, inboxId: widgetInboxId },
      });
      if (widget?.connectionStatus === "ready_stub") {
        displayStatus = "ready";
      }
    } else {
      const anyReady = await db.channelWebsiteWidget.findFirst({
        where: { tenantId: session.tenantId, connectionStatus: "ready_stub" },
      });
      if (anyReady) displayStatus = "ready";
    }
    await db.campaign.update({
      where: { id },
      data: {
        status: "active",
        displayStatus,
        startedAt: new Date(),
      },
    });
    await appendDomainEvent(db, {
      tenantId: session.tenantId,
      type: "campaign.started",
      aggregateType: "campaign",
      aggregateId: id,
      payload: { campaign_id: id, kind: "ongoing", display_status: displayStatus },
      actorUserId: session.userId,
    });
    return getCampanha(session, id);
  }

  const audience = parseJson<string[]>(row.audienceLabelIdsJson, []);
  if (!audience.length) throw new ApiError("validacao", "Audiência vazia.");
  if (!row.inboxId || !row.templateKey) {
    throw new ApiError("validacao", "inbox_id e template_key obrigatórios.");
  }
  await assertTemplateOnInbox(session.tenantId, row.inboxId, row.templateKey);
  const contactIds = await resolveAudienceContactIds(session.tenantId, audience);
  if (!contactIds.length) {
    throw new ApiError("validacao", "Nenhum contato na audiência.");
  }
  if (contactIds.length > CAMPAIGN_AUDIENCE_CAP) {
    throw new ApiError("validacao", `Audiência excede ${CAMPAIGN_AUDIENCE_CAP} destinatários.`);
  }

  await db.campaign.update({
    where: { id },
    data: {
      status: "active",
      startedAt: new Date(),
      statsJson: JSON.stringify({
        targeted: contactIds.length,
        enviado: 0,
        falha: 0,
        omitido: 0,
      } satisfies Stats),
    },
  });
  ensureJobWorkerStarted();
  await jobEnqueuePort.enqueue({
    tenantId: session.tenantId,
    kind: "campaign.send_batch",
    payload: { tenant_id: session.tenantId, campaign_id: id },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "campaign.started",
    aggregateType: "campaign",
    aggregateId: id,
    payload: { campaign_id: id, kind: "one_off", targeted: contactIds.length },
    actorUserId: session.userId,
  });
  return getCampanha(session, id);
}

export async function cancelarCampanha(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (row.status !== "scheduled" && row.status !== "active") {
    throw new ApiError("conflito", "Só scheduled/active podem ser canceladas.");
  }
  await db.campaign.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() },
  });
  await appendDomainEvent(db, {
    tenantId: session.tenantId,
    type: "campaign.cancelled",
    aggregateType: "campaign",
    aggregateId: id,
    payload: { campaign_id: id },
    actorUserId: session.userId,
  });
  return getCampanha(session, id);
}

export async function listDestinatarios(session: SessionContext, id: string, url: URL) {
  assertSaasRole(session, "admin");
  const camp = await db.campaign.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!camp) throw new ApiError("nao_encontrado", "Não encontrado.");
  const { limit, cursor } = parsePaging(url);
  const decoded = decodeCursor(cursor);
  const status = url.searchParams.get("status");
  const rows = await db.campaignRecipient.findMany({
    where: {
      tenantId: session.tenantId,
      campaignId: id,
      ...(status ? { status } : {}),
      ...(decoded ? { id: { gt: decoded[0] } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(recipientDto),
    next_cursor: rows.length > limit ? encodeCursor([page[page.length - 1]!.id]) : null,
  };
}

/** Promote due scheduled campaigns → enqueue send_batch (one_off) or activate ongoing. */
export async function promoteScheduledCampaigns(limit = 20) {
  const now = new Date();
  const due = await db.campaign.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    take: limit,
  });
  for (const camp of due) {
    if (camp.kind === "ongoing") {
      await db.campaign.update({
        where: { id: camp.id },
        data: {
          status: "active",
          displayStatus: "awaiting_widget",
          startedAt: now,
        },
      });
      await appendDomainEvent(db, {
        tenantId: camp.tenantId,
        type: "campaign.started",
        aggregateType: "campaign",
        aggregateId: camp.id,
        payload: { campaign_id: camp.id, kind: "ongoing", via: "scheduler" },
      });
      continue;
    }
    const claimed = await db.campaign.updateMany({
      where: { id: camp.id, status: "scheduled" },
      data: { status: "active", startedAt: now },
    });
    if (claimed.count !== 1) continue;
    const audience = parseJson<string[]>(camp.audienceLabelIdsJson, []);
    const contactIds = await resolveAudienceContactIds(camp.tenantId, audience);
    await db.campaign.update({
      where: { id: camp.id },
      data: {
        statsJson: JSON.stringify({
          targeted: contactIds.length,
          enviado: 0,
          falha: 0,
          omitido: 0,
        } satisfies Stats),
      },
    });
    ensureJobWorkerStarted();
    await jobEnqueuePort.enqueue({
      tenantId: camp.tenantId,
      kind: "campaign.send_batch",
      payload: { tenant_id: camp.tenantId, campaign_id: camp.id },
    });
    await appendDomainEvent(db, {
      tenantId: camp.tenantId,
      type: "campaign.started",
      aggregateType: "campaign",
      aggregateId: camp.id,
      payload: { campaign_id: camp.id, kind: "one_off", via: "scheduler" },
    });
  }
  return due.length;
}

export const campaignSendPort: CampaignSendPort = {
  async enqueueBatch(input) {
    const camp = await db.campaign.findFirst({
      where: { id: input.campaignId, tenantId: input.tenantId },
    });
    if (!camp) return { processed: 0, done: true };
    if (camp.status === "cancelled") return { processed: 0, done: true };
    if (camp.kind !== "one_off" || camp.status !== "active") {
      return { processed: 0, done: true };
    }
    if (!camp.inboxId || !camp.templateKey) {
      await db.campaign.update({
        where: { id: camp.id },
        data: { status: "cancelled", completedAt: new Date() },
      });
      return { processed: 0, done: true };
    }

    const audience = parseJson<string[]>(camp.audienceLabelIdsJson, []);
    const allContactIds = await resolveAudienceContactIds(input.tenantId, audience);
    const already = await db.campaignRecipient.findMany({
      where: { campaignId: camp.id },
      select: { contactId: true, status: true },
    });
    const doneIds = new Set(
      already.filter((r) => r.status === "enviado" || r.status === "omitido").map((r) => r.contactId),
    );
    const pendingExisting = already.filter((r) => r.status === "pendente" || r.status === "falha");
    const missing = allContactIds.filter((id) => !already.some((r) => r.contactId === id));

    const queue = [
      ...pendingExisting.map((r) => r.contactId),
      ...missing,
    ].filter((id) => !doneIds.has(id));

    const start = input.cursor ? Number(input.cursor) || 0 : 0;
    const slice = queue.slice(start, start + input.limit);
    let enviado = 0;
    let falha = 0;
    let omitido = 0;

    for (const contactId of slice) {
      const contact = await db.contact.findFirst({
        where: { id: contactId, tenantId: input.tenantId },
      });
      if (!contact || contact.mergedIntoId) {
        omitido += 1;
        await upsertRecipient({
          tenantId: input.tenantId,
          campaignId: camp.id,
          contactId,
          status: "omitido",
          error: "contato_indisponivel",
        });
        continue;
      }
      const recipient =
        contact.phoneE164 ||
        contact.email ||
        `contact:${contact.id}`;
      const outboxId = newId("out");
      const channel = outboxChannelFor(camp.channel);
      try {
        await db.notificationOutbox.create({
          data: {
            id: outboxId,
            tenantId: input.tenantId,
            channel,
            recipientRole: "customer",
            recipient,
            templateKey: camp.templateKey.startsWith("campaign.")
              ? camp.templateKey
              : `campaign.${camp.templateKey}`,
            category: "campaign",
            campaignId: camp.id,
            payloadJson: JSON.stringify({
              campaign_id: camp.id,
              contact_id: contact.id,
              contact_nome: contact.nome,
              // redacted — no full CNPJ
            }),
            status: "pendente",
          },
        });
        await stubOutboxTransport.send({
          id: outboxId,
          channel,
          recipient,
          templateKey: camp.templateKey,
          payload: {},
        });
        await upsertRecipient({
          tenantId: input.tenantId,
          campaignId: camp.id,
          contactId,
          status: "enviado",
          outboxId,
        });
        enviado += 1;
      } catch (err) {
        falha += 1;
        await upsertRecipient({
          tenantId: input.tenantId,
          campaignId: camp.id,
          contactId,
          status: "falha",
          error: err instanceof Error ? err.message.slice(0, 200) : "falha",
        });
      }
    }

    const stats = parseJson<Stats>(camp.statsJson, {
      targeted: allContactIds.length,
      enviado: 0,
      falha: 0,
      omitido: 0,
    });
    stats.targeted = allContactIds.length;
    stats.enviado += enviado;
    stats.falha += falha;
    stats.omitido += omitido;
    await db.campaign.update({
      where: { id: camp.id },
      data: { statsJson: JSON.stringify(stats) },
    });

    const nextStart = start + slice.length;
    const done = nextStart >= queue.length;
    if (done) {
      // Re-check leftover pendente
      const left = await db.campaignRecipient.count({
        where: { campaignId: camp.id, status: "pendente" },
      });
      const fresh = await db.campaign.findFirst({ where: { id: camp.id } });
      if (fresh?.status === "cancelled") {
        return { processed: slice.length, done: true };
      }
      if (left === 0) {
        await db.campaign.update({
          where: { id: camp.id },
          data: { status: "completed", completedAt: new Date() },
        });
        await appendDomainEvent(db, {
          tenantId: input.tenantId,
          type: "campaign.completed",
          aggregateType: "campaign",
          aggregateId: camp.id,
          payload: { campaign_id: camp.id, stats },
        });
      }
      return { processed: slice.length, done: left === 0, nextCursor: left ? String(nextStart) : undefined };
    }
    return {
      processed: slice.length,
      done: false,
      nextCursor: String(nextStart),
    };
  },
};

async function upsertRecipient(input: {
  tenantId: string;
  campaignId: string;
  contactId: string;
  status: string;
  outboxId?: string | null;
  error?: string | null;
}) {
  const existing = await db.campaignRecipient.findUnique({
    where: {
      campaignId_contactId: {
        campaignId: input.campaignId,
        contactId: input.contactId,
      },
    },
  });
  if (existing) {
    await db.campaignRecipient.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        outboxId: input.outboxId ?? existing.outboxId,
        error: input.error ?? null,
      },
    });
    return;
  }
  await db.campaignRecipient.create({
    data: {
      id: newId("cpr"),
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      status: input.status,
      outboxId: input.outboxId ?? null,
      error: input.error ?? null,
    },
  });
}

/** Job consumer entry. */
export async function handleCampaignSendBatch(payload: {
  tenant_id: string;
  campaign_id: string;
  cursor?: string;
}) {
  const result = await campaignSendPort.enqueueBatch({
    tenantId: payload.tenant_id,
    campaignId: payload.campaign_id,
    cursor: payload.cursor,
    limit: 100,
  });
  if (!result.done && result.nextCursor) {
    await jobEnqueuePort.enqueue({
      tenantId: payload.tenant_id,
      kind: "campaign.send_batch",
      payload: {
        tenant_id: payload.tenant_id,
        campaign_id: payload.campaign_id,
        cursor: result.nextCursor,
      },
    });
  }
}
