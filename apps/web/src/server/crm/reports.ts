import { REPORT_MAX_RANGE_DAYS } from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertReportAccess } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";

type Range = {
  from: Date;
  to: Date;
  tz: string;
  inboxId: string | null;
  teamId: string | null;
};

function parseRange(url: URL): Range {
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  if (!fromRaw || !toRaw) {
    throw new ApiError("validacao", "from e to são obrigatórios.");
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError("validacao", "from/to inválidos.");
  }
  if (to < from) throw new ApiError("validacao", "to deve ser >= from.");
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > REPORT_MAX_RANGE_DAYS) {
    throw new ApiError("validacao", `Intervalo máximo de ${REPORT_MAX_RANGE_DAYS} dias.`);
  }
  // Inclusive day end if to is date-only-ish (midnight) — keep as given ISO.
  const tz = url.searchParams.get("tz") || "America/Sao_Paulo";
  return {
    from,
    to,
    tz,
    inboxId: url.searchParams.get("inbox_id"),
    teamId: url.searchParams.get("team_id"),
  };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function emptySeries(from: Date, to: Date) {
  const days: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function wrap(series: unknown, totals: unknown) {
  return {
    series,
    totals,
    generated_at: new Date().toISOString(),
  };
}

async function convWhere(session: SessionContext, range: Range) {
  return {
    tenantId: session.tenantId,
    createdAt: { gte: range.from, lte: range.to },
    ...(range.inboxId ? { inboxId: range.inboxId } : {}),
    ...(range.teamId ? { teamId: range.teamId } : {}),
  };
}

export async function reportVisaoGeral(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const base = {
    tenantId: session.tenantId,
    ...(range.inboxId ? { inboxId: range.inboxId } : {}),
    ...(range.teamId ? { teamId: range.teamId } : {}),
  };
  const [open, pending, resolved, created, messagesIn, messagesOut, csat] = await Promise.all([
    db.conversation.count({ where: { ...base, status: "open" } }),
    db.conversation.count({ where: { ...base, status: "pending" } }),
    db.conversation.count({ where: { ...base, status: "resolved" } }),
    db.conversation.count({
      where: { ...base, createdAt: { gte: range.from, lte: range.to } },
    }),
    db.message.count({
      where: {
        tenantId: session.tenantId,
        messageType: "incoming",
        private: false,
        createdAt: { gte: range.from, lte: range.to },
        ...(range.inboxId
          ? { conversation: { inboxId: range.inboxId } }
          : {}),
      },
    }),
    db.message.count({
      where: {
        tenantId: session.tenantId,
        messageType: "outgoing",
        private: false,
        createdAt: { gte: range.from, lte: range.to },
        ...(range.inboxId
          ? { conversation: { inboxId: range.inboxId } }
          : {}),
      },
    }),
    db.csatResponse.aggregate({
      where: {
        tenantId: session.tenantId,
        submittedAt: { gte: range.from, lte: range.to },
        ...(range.inboxId ? { inboxId: range.inboxId } : {}),
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  // Avg first agent response (outgoing non-private after first incoming) — sample capped.
  const sample = await db.conversation.findMany({
    where: {
      ...base,
      createdAt: { gte: range.from, lte: range.to },
    },
    take: 200,
    select: { id: true, createdAt: true },
  });
  let frSum = 0;
  let frN = 0;
  for (const c of sample) {
    const firstOut = await db.message.findFirst({
      where: {
        conversationId: c.id,
        messageType: "outgoing",
        private: false,
        senderUserId: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!firstOut) continue;
    frSum += firstOut.createdAt.getTime() - c.createdAt.getTime();
    frN += 1;
  }

  const days = emptySeries(range.from, range.to);
  const byDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const createdRows = await db.conversation.findMany({
    where: { ...base, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true },
  });
  for (const r of createdRows) {
    const k = dayKey(r.createdAt);
    if (k in byDay) byDay[k]! += 1;
  }

  return wrap(
    { new_conversations_by_day: days.map((d) => ({ day: d, count: byDay[d] ?? 0 })) },
    {
      open,
      pending,
      resolved,
      new_conversations: created,
      messages_in: messagesIn,
      messages_out: messagesOut,
      avg_first_response_ms: frN ? Math.round(frSum / frN) : null,
      csat_avg: csat._avg.rating,
      csat_count: csat._count._all,
      tz: range.tz,
    },
  );
}

export async function reportConversas(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const where = await convWhere(session, range);
  const rows = await db.conversation.findMany({
    where,
    select: { status: true, createdAt: true, updatedAt: true },
  });
  const days = emptySeries(range.from, range.to);
  const byDay: Record<string, Record<string, number>> = {};
  for (const d of days) byDay[d] = { open: 0, pending: 0, snoozed: 0, resolved: 0 };
  let resolutions = 0;
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (byDay[k]) byDay[k]![r.status] = (byDay[k]![r.status] ?? 0) + 1;
    if (r.status === "resolved") resolutions += 1;
  }
  // Reopen approx: status_changed events open after resolved — count domain events.
  const reopenEvents = await db.domainEvent.count({
    where: {
      tenantId: session.tenantId,
      type: "conversation.status_changed",
      createdAt: { gte: range.from, lte: range.to },
      payloadJson: { contains: '"to":"open"' },
    },
  });
  return wrap(
    {
      by_day: days.map((d) => ({ day: d, ...(byDay[d] ?? {}) })),
    },
    {
      volume: rows.length,
      resolutions,
      reopen_count: reopenEvents,
    },
  );
}

export async function reportAgentes(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const convs = await db.conversation.findMany({
    where: {
      tenantId: session.tenantId,
      createdAt: { gte: range.from, lte: range.to },
      assigneeUserId: { not: null },
      ...(range.inboxId ? { inboxId: range.inboxId } : {}),
      ...(range.teamId ? { teamId: range.teamId } : {}),
    },
    select: { id: true, assigneeUserId: true, status: true, createdAt: true },
  });
  const byAgent = new Map<
    string,
    { assigned: number; resolved: number; messages_sent: number; fr_sum: number; fr_n: number }
  >();
  for (const c of convs) {
    const aid = c.assigneeUserId!;
    const cur = byAgent.get(aid) ?? {
      assigned: 0,
      resolved: 0,
      messages_sent: 0,
      fr_sum: 0,
      fr_n: 0,
    };
    cur.assigned += 1;
    if (c.status === "resolved") cur.resolved += 1;
    byAgent.set(aid, cur);
  }
  const msgs = await db.message.findMany({
    where: {
      tenantId: session.tenantId,
      messageType: "outgoing",
      private: false,
      senderUserId: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    select: { senderUserId: true, conversationId: true, createdAt: true },
  });
  for (const m of msgs) {
    const aid = m.senderUserId!;
    const cur = byAgent.get(aid) ?? {
      assigned: 0,
      resolved: 0,
      messages_sent: 0,
      fr_sum: 0,
      fr_n: 0,
    };
    cur.messages_sent += 1;
    byAgent.set(aid, cur);
  }
  const series = [...byAgent.entries()].map(([assignee_user_id, v]) => ({
    assignee_user_id,
    assigned: v.assigned,
    resolved: v.resolved,
    messages_sent: v.messages_sent,
    avg_response_ms: null as number | null,
  }));
  return wrap(series, {
    agents: series.length,
    assigned: series.reduce((a, r) => a + r.assigned, 0),
    resolved: series.reduce((a, r) => a + r.resolved, 0),
  });
}

export async function reportLabels(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const labels = await db.label.findMany({
    where: { tenantId: session.tenantId },
  });
  const series = [];
  for (const label of labels) {
    const tagged = await db.conversationLabel.count({
      where: {
        tenantId: session.tenantId,
        labelId: label.id,
        conversation: {
          createdAt: { gte: range.from, lte: range.to },
          ...(range.inboxId ? { inboxId: range.inboxId } : {}),
        },
      },
    });
    const resolutions = await db.conversationLabel.count({
      where: {
        tenantId: session.tenantId,
        labelId: label.id,
        conversation: {
          status: "resolved",
          createdAt: { gte: range.from, lte: range.to },
          ...(range.inboxId ? { inboxId: range.inboxId } : {}),
        },
      },
    });
    series.push({
      label_id: label.id,
      title: label.title,
      conversations: tagged,
      resolutions,
    });
  }
  return wrap(series, {
    labels: series.length,
    conversations: series.reduce((a, r) => a + r.conversations, 0),
  });
}

export async function reportInboxes(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const inboxes = await db.inbox.findMany({
    where: { tenantId: session.tenantId },
  });
  const series = [];
  for (const inbox of inboxes) {
    if (range.inboxId && inbox.id !== range.inboxId) continue;
    const volume = await db.conversation.count({
      where: {
        tenantId: session.tenantId,
        inboxId: inbox.id,
        createdAt: { gte: range.from, lte: range.to },
      },
    });
    const resolutions = await db.conversation.count({
      where: {
        tenantId: session.tenantId,
        inboxId: inbox.id,
        status: "resolved",
        createdAt: { gte: range.from, lte: range.to },
      },
    });
    series.push({
      inbox_id: inbox.id,
      name: inbox.name,
      volume,
      resolutions,
    });
  }
  return wrap(series, {
    inboxes: series.length,
    volume: series.reduce((a, r) => a + r.volume, 0),
  });
}

export async function reportEquipes(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const teams = await db.team.findMany({ where: { tenantId: session.tenantId } });
  const series = [];
  for (const team of teams) {
    if (range.teamId && team.id !== range.teamId) continue;
    const volume = await db.conversation.count({
      where: {
        tenantId: session.tenantId,
        teamId: team.id,
        createdAt: { gte: range.from, lte: range.to },
        ...(range.inboxId ? { inboxId: range.inboxId } : {}),
      },
    });
    const resolutions = await db.conversation.count({
      where: {
        tenantId: session.tenantId,
        teamId: team.id,
        status: "resolved",
        createdAt: { gte: range.from, lte: range.to },
        ...(range.inboxId ? { inboxId: range.inboxId } : {}),
      },
    });
    series.push({
      team_id: team.id,
      name: team.name,
      volume,
      resolutions,
    });
  }
  return wrap(series, {
    teams: series.length,
    volume: series.reduce((a, r) => a + r.volume, 0),
  });
}

export async function reportCsat(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const rows = await db.csatResponse.findMany({
    where: {
      tenantId: session.tenantId,
      submittedAt: { gte: range.from, lte: range.to },
      ...(range.inboxId ? { inboxId: range.inboxId } : {}),
    },
    select: { rating: true },
  });
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let sum = 0;
  for (const r of rows) {
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
    sum += r.rating;
  }
  return wrap(
    { distribution },
    {
      count: rows.length,
      avg: rows.length ? sum / rows.length : null,
    },
  );
}

export async function reportBots(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const [messaged, handedOff, touched] = await Promise.all([
    db.domainEvent.count({
      where: {
        tenantId: session.tenantId,
        type: "bot.messaged",
        createdAt: { gte: range.from, lte: range.to },
      },
    }),
    db.domainEvent.count({
      where: {
        tenantId: session.tenantId,
        type: "bot.handed_off",
        createdAt: { gte: range.from, lte: range.to },
      },
    }),
    db.conversation.count({
      where: {
        tenantId: session.tenantId,
        botAgentBotId: { not: null },
        createdAt: { gte: range.from, lte: range.to },
        ...(range.inboxId ? { inboxId: range.inboxId } : {}),
      },
    }),
  ]);
  return wrap(
    {
      bot_messages: messaged,
      handoffs: handedOff,
      conversations_touched: touched,
    },
    { bot_messages: messaged, handoffs: handedOff, conversations_touched: touched },
  );
}


export async function reportSla(session: SessionContext, url: URL) {
  assertReportAccess(session);
  const range = parseRange(url);
  const rows = await db.conversationSla.findMany({
    where: {
      tenantId: session.tenantId,
      appliedAt: { gte: range.from, lte: range.to },
      ...(range.inboxId
        ? { conversation: { inboxId: range.inboxId } }
        : {}),
    },
    include: { conversation: { select: { inboxId: true, teamId: true } } },
  });
  const filtered = range.teamId
    ? rows.filter((r) => r.conversation.teamId === range.teamId)
    : rows;
  const days = emptySeries(range.from, range.to);
  const byDay: Record<
    string,
    { applied: number; frt_hit: number; nrt_hit: number; rt_hit: number; frt_breach: number; nrt_breach: number; rt_breach: number }
  > = {};
  for (const d of days) {
    byDay[d] = { applied: 0, frt_hit: 0, nrt_hit: 0, rt_hit: 0, frt_breach: 0, nrt_breach: 0, rt_breach: 0 };
  }
  for (const r of filtered) {
    const key = dayKey(r.appliedAt);
    if (!byDay[key]) continue;
    byDay[key].applied += 1;
    if (r.frtHitAt && !r.frtBreached) byDay[key].frt_hit += 1;
    if (r.nrtHitAt && !r.nrtBreached) byDay[key].nrt_hit += 1;
    if (r.rtHitAt && !r.rtBreached) byDay[key].rt_hit += 1;
    if (r.frtBreached) byDay[key].frt_breach += 1;
    if (r.nrtBreached) byDay[key].nrt_breach += 1;
    if (r.rtBreached) byDay[key].rt_breach += 1;
  }
  const series = days.map((d) => ({ day: d, ...byDay[d]! }));
  const totals = {
    applied: filtered.length,
    frt_hit: filtered.filter((r) => r.frtHitAt && !r.frtBreached).length,
    nrt_hit: filtered.filter((r) => r.nrtHitAt && !r.nrtBreached).length,
    rt_hit: filtered.filter((r) => r.rtHitAt && !r.rtBreached).length,
    frt_breach: filtered.filter((r) => r.frtBreached).length,
    nrt_breach: filtered.filter((r) => r.nrtBreached).length,
    rt_breach: filtered.filter((r) => r.rtBreached).length,
    frt_hit_rate: filtered.length
      ? filtered.filter((r) => r.frtHitAt && !r.frtBreached).length / filtered.length
      : 0,
    nrt_hit_rate: filtered.length
      ? filtered.filter((r) => r.nrtHitAt && !r.nrtBreached).length / filtered.length
      : 0,
    rt_hit_rate: filtered.length
      ? filtered.filter((r) => r.rtHitAt && !r.rtBreached).length / filtered.length
      : 0,
  };
  return wrap(series, totals);
}
