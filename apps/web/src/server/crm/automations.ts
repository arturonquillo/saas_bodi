import {
  AUTOMATION_EVENT_NAMES,
  type AutomationEventName,
} from "@saas-frota/shared";
import type { SessionContext } from "../authz/session";
import { assertSaasRole } from "../authz/gates";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import {
  evaluateConditions,
  type ActionNode,
  type ConditionsJson,
  type EvalContext,
} from "./actions-runner";

const MAX_ACTIVE = 20;

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function automationDto(row: {
  id: string;
  name: string;
  description: string | null;
  eventName: string;
  conditionsJson: string;
  actionsJson: string;
  active: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    event_name: row.eventName,
    conditions: parseJson<ConditionsJson>(row.conditionsJson, { operator: "and", values: [] }),
    actions: parseJson<ActionNode[]>(row.actionsJson, []),
    active: row.active,
    created_by_user_id: row.createdByUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function assertEventName(name: string): asserts name is AutomationEventName {
  if (!(AUTOMATION_EVENT_NAMES as readonly string[]).includes(name)) {
    throw new ApiError("validacao", "event_name inválido.");
  }
}

export async function listAutomacoes(session: SessionContext) {
  assertSaasRole(session, "admin");
  const rows = await db.automationRule.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });
  return { items: rows.map(automationDto) };
}

export async function createAutomacao(
  session: SessionContext,
  input: {
    name: string;
    description?: string | null;
    event_name: string;
    conditions?: ConditionsJson;
    actions?: ActionNode[];
    active?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  if (!input.name?.trim()) throw new ApiError("validacao", "Nome obrigatório.");
  assertEventName(input.event_name);
  const active = input.active !== false;
  if (active) {
    const count = await db.automationRule.count({
      where: { tenantId: session.tenantId, active: true },
    });
    if (count >= MAX_ACTIVE) {
      throw new ApiError("validacao", `Máximo de ${MAX_ACTIVE} automações ativas.`);
    }
  }
  const id = newId("aut");
  await db.automationRule.create({
    data: {
      id,
      tenantId: session.tenantId,
      name: input.name.trim(),
      description: input.description ?? null,
      eventName: input.event_name,
      conditionsJson: JSON.stringify(input.conditions ?? { operator: "and", values: [] }),
      actionsJson: JSON.stringify(input.actions ?? []),
      active,
      createdByUserId: session.userId,
    },
  });
  return getAutomacao(session, id);
}

export async function getAutomacao(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.automationRule.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return automationDto(row);
}

export async function patchAutomacao(
  session: SessionContext,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    event_name?: string;
    conditions?: ConditionsJson;
    actions?: ActionNode[];
    active?: boolean;
  },
) {
  assertSaasRole(session, "admin");
  const row = await db.automationRule.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  if (input.event_name) assertEventName(input.event_name);
  if (input.active === true && !row.active) {
    const count = await db.automationRule.count({
      where: { tenantId: session.tenantId, active: true },
    });
    if (count >= MAX_ACTIVE) {
      throw new ApiError("validacao", `Máximo de ${MAX_ACTIVE} automações ativas.`);
    }
  }
  await db.automationRule.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description,
      eventName: input.event_name,
      conditionsJson:
        input.conditions === undefined ? undefined : JSON.stringify(input.conditions),
      actionsJson: input.actions === undefined ? undefined : JSON.stringify(input.actions),
      active: input.active,
    },
  });
  return getAutomacao(session, id);
}

export async function deleteAutomacao(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.automationRule.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  await db.automationRule.delete({ where: { id } });
  return { id, deleted: true };
}

export async function clonarAutomacao(session: SessionContext, id: string) {
  assertSaasRole(session, "admin");
  const row = await db.automationRule.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  return createAutomacao(session, {
    name: `${row.name} (cópia)`,
    description: row.description,
    event_name: row.eventName,
    conditions: parseJson(row.conditionsJson, { operator: "and", values: [] }),
    actions: parseJson(row.actionsJson, []),
    active: false,
  });
}

/** Dry-run conditions only — no side effects / no egress. */
export async function testarAutomacao(
  session: SessionContext,
  id: string,
  sample: EvalContext,
) {
  assertSaasRole(session, "admin");
  const row = await db.automationRule.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
  const conditions = parseJson<ConditionsJson>(row.conditionsJson, {
    operator: "and",
    values: [],
  });
  const matched = evaluateConditions(conditions, sample);
  return {
    rule_id: id,
    matched,
    conditions,
    dry_run: true,
  };
}
