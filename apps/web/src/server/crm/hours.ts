import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { assertInboxMember } from "./visibility";

export type WorkingHourInput = {
  day_of_week: number;
  closed_all_day?: boolean;
  open_all_day?: boolean;
  open_hour?: number | null;
  open_minutes?: number | null;
  close_hour?: number | null;
  close_minutes?: number | null;
};

export function workingHourDto(row: {
  dayOfWeek: number;
  closedAllDay: boolean;
  openAllDay: boolean;
  openHour: number | null;
  openMinutes: number | null;
  closeHour: number | null;
  closeMinutes: number | null;
}) {
  return {
    day_of_week: row.dayOfWeek,
    closed_all_day: row.closedAllDay,
    open_all_day: row.openAllDay,
    open_hour: row.openHour,
    open_minutes: row.openMinutes,
    close_hour: row.closeHour,
    close_minutes: row.closeMinutes,
  };
}

/** Return parts in inbox timezone. Falls back to America/Sao_Paulo. */
export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dayOfWeek: map[weekday] ?? 0,
    hour: Number(get("hour") === "24" ? "0" : get("hour")),
    minute: Number(get("minute")),
  };
}

export function isOpenNow(
  hours: Array<{
    dayOfWeek: number;
    closedAllDay: boolean;
    openAllDay: boolean;
    openHour: number | null;
    openMinutes: number | null;
    closeHour: number | null;
    closeMinutes: number | null;
  }>,
  timeZone: string,
  now = new Date(),
): boolean {
  if (!hours.length) return true; // no schedule → always open
  const { dayOfWeek, hour, minute } = zonedParts(now, timeZone);
  const row = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!row) return true;
  if (row.closedAllDay) return false;
  if (row.openAllDay) return true;
  const open = (row.openHour ?? 0) * 60 + (row.openMinutes ?? 0);
  const close = (row.closeHour ?? 23) * 60 + (row.closeMinutes ?? 59);
  const cur = hour * 60 + minute;
  return cur >= open && cur < close;
}

export async function getHorarios(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertInboxMember(session, inboxId);
  const rows = await db.workingHour.findMany({
    where: { tenantId: session.tenantId, inboxId },
    orderBy: { dayOfWeek: "asc" },
  });
  return {
    inbox_id: inboxId,
    timezone: inbox.timezone,
    hours: rows.map(workingHourDto),
  };
}

export async function putHorarios(
  session: SessionContext,
  inboxId: string,
  input: { timezone?: string; hours: WorkingHourInput[] },
) {
  assertSaasRole(session, "admin");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (!Array.isArray(input.hours)) throw new ApiError("validacao", "hours obrigatório.");
  for (const h of input.hours) {
    if (h.day_of_week < 0 || h.day_of_week > 6) {
      throw new ApiError("validacao", "day_of_week inválido.");
    }
  }
  await db.$transaction(async (tx) => {
    if (input.timezone) {
      await tx.inbox.update({
        where: { id: inboxId },
        data: { timezone: input.timezone },
      });
    }
    await tx.workingHour.deleteMany({ where: { tenantId: session.tenantId, inboxId } });
    for (const h of input.hours) {
      await tx.workingHour.create({
        data: {
          id: newId("whr"),
          tenantId: session.tenantId,
          inboxId,
          dayOfWeek: h.day_of_week,
          closedAllDay: Boolean(h.closed_all_day),
          openAllDay: Boolean(h.open_all_day),
          openHour: h.open_hour ?? null,
          openMinutes: h.open_minutes ?? null,
          closeHour: h.close_hour ?? null,
          closeMinutes: h.close_minutes ?? null,
        },
      });
    }
  });
  return getHorarios(session, inboxId);
}

export async function getHorariosEstado(session: SessionContext, inboxId: string) {
  assertSaasRole(session, "admin", "vendedor");
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId: session.tenantId } });
  if (!inbox) throw new ApiError("nao_encontrado", "Não encontrado.");
  await assertInboxMember(session, inboxId);
  const rows = await db.workingHour.findMany({
    where: { tenantId: session.tenantId, inboxId },
  });
  return {
    open_now: isOpenNow(rows, inbox.timezone),
    timezone: inbox.timezone,
  };
}

/** Domain helper for simulate/inbound — no session. */
export async function inboxIsOpen(tenantId: string, inboxId: string, now = new Date()) {
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, tenantId } });
  if (!inbox) return true;
  const rows = await db.workingHour.findMany({ where: { tenantId, inboxId } });
  return isOpenNow(rows, inbox.timezone, now);
}
