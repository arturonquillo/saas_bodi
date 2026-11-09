import type { SessionContext } from "../authz/session";
import { db } from "../db";
import { ApiError } from "../http/respond";
import { newId } from "../ids";
import { jobEnqueuePort } from "../ports/jobs";
import { appendDomainEvent } from "./events";
import { patchConversa, postMensagem, setConversationLabels } from "./conversations";

export type ConditionNode = {
  attribute_key: string;
  filter_operator: string;
  values?: unknown[];
};

export type ConditionsJson = {
  operator?: "and";
  values?: ConditionNode[];
};

export type ActionNode = {
  action_name: string;
  action_params?: Record<string, unknown>;
};

export type EvalContext = {
  status?: string | null;
  priority?: string | null;
  inbox_id?: string | null;
  team_id?: string | null;
  assignee_id?: string | null;
  message_type?: string | null;
  content?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  label_ids?: string[];
  custom_attributes?: Record<string, unknown>;
  [key: string]: unknown;
};

function readAttr(ctx: EvalContext, key: string): unknown {
  if (key.startsWith("custom_attribute.")) {
    const k = key.slice("custom_attribute.".length);
    return ctx.custom_attributes?.[k];
  }
  switch (key) {
    case "status":
      return ctx.status;
    case "priority":
      return ctx.priority;
    case "inbox_id":
      return ctx.inbox_id;
    case "team_id":
      return ctx.team_id;
    case "assignee_id":
      return ctx.assignee_id;
    case "message_type":
      return ctx.message_type;
    case "content":
      return ctx.content;
    case "contact_email":
      return ctx.contact_email;
    case "contact_phone":
      return ctx.contact_phone;
    case "label_ids":
      return ctx.label_ids;
    default:
      return undefined;
  }
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(",");
  return String(v);
}

export function evaluateConditions(conditions: ConditionsJson | null | undefined, ctx: EvalContext): boolean {
  const values = conditions?.values ?? [];
  if (!values.length) return true;
  for (const node of values) {
    const left = readAttr(ctx, node.attribute_key);
    const right = node.values?.[0];
    const op = node.filter_operator;
    switch (op) {
      case "equal":
        if (asString(left) !== asString(right)) return false;
        break;
      case "not_equal":
        if (asString(left) === asString(right)) return false;
        break;
      case "contains":
        if (!asString(left).includes(asString(right))) return false;
        break;
      case "does_not_contain":
        if (asString(left).includes(asString(right))) return false;
        break;
      case "is_present":
        if (left == null || left === "" || (Array.isArray(left) && !left.length)) return false;
        break;
      case "is_not_present":
        if (!(left == null || left === "" || (Array.isArray(left) && !left.length))) return false;
        break;
      case "is_greater_than":
        if (!(Number(left) > Number(right))) return false;
        break;
      case "is_less_than":
        if (!(Number(left) < Number(right))) return false;
        break;
      default:
        // fail-closed on unknown operators
        return false;
    }
  }
  return true;
}

export async function buildConversationEvalContext(tenantId: string, conversationId: string): Promise<EvalContext> {
  const row = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      contact: true,
      labels: true,
    },
  });
  if (!row) return {};
  let custom: Record<string, unknown> = {};
  try {
    custom = JSON.parse(row.customAttributesJson || "{}") as Record<string, unknown>;
  } catch {
    custom = {};
  }
  return {
    status: row.status,
    priority: row.priority,
    inbox_id: row.inboxId,
    team_id: row.teamId,
    assignee_id: row.assigneeUserId,
    contact_email: row.contact.email,
    contact_phone: row.contact.phoneE164,
    label_ids: row.labels.map((l) => l.labelId),
    custom_attributes: custom,
  };
}

/** Apply ordered actions via desk domain services. Macros forbid send_webhook. */
export async function runActions(input: {
  session: SessionContext;
  conversationId: string;
  actions: ActionNode[];
  allowWebhook?: boolean;
  source?: "automation" | "macro";
}): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;
  for (const action of input.actions) {
    try {
      const params = action.action_params ?? {};
      switch (action.action_name) {
        case "assign_agent":
          await patchConversa(input.session, input.conversationId, {
            assignee_user_id: (params.assignee_user_id as string | null) ?? null,
          });
          break;
        case "assign_team":
          await patchConversa(input.session, input.conversationId, {
            team_id: (params.team_id as string | null) ?? null,
          });
          break;
        case "add_label": {
          const ids = (params.label_ids as string[]) ?? (params.label_id ? [String(params.label_id)] : []);
          if (ids.length) await setConversationLabels(input.session, input.conversationId, ids, "add");
          break;
        }
        case "remove_label": {
          const removeIds = new Set(
            (params.label_ids as string[]) ?? (params.label_id ? [String(params.label_id)] : []),
          );
          if (removeIds.size) {
            const existing = await db.conversationLabel.findMany({
              where: { tenantId: input.session.tenantId, conversationId: input.conversationId },
            });
            const keep = existing.filter((l) => !removeIds.has(l.labelId)).map((l) => l.labelId);
            await setConversationLabels(input.session, input.conversationId, keep, "replace");
          }
          break;
        }
        case "mute":
          await patchConversa(input.session, input.conversationId, { muted: true });
          break;
        case "snooze":
          await patchConversa(input.session, input.conversationId, {
            status: "snoozed",
            snoozed_until: (params.snoozed_until as string) ?? new Date(Date.now() + 86_400_000).toISOString(),
          });
          break;
        case "resolve":
          await patchConversa(input.session, input.conversationId, { status: "resolved" });
          break;
        case "change_status":
          await patchConversa(input.session, input.conversationId, {
            status: params.status as "open" | "pending" | "snoozed" | "resolved",
          });
          break;
        case "change_priority":
          await patchConversa(input.session, input.conversationId, {
            priority: (params.priority as "low" | "medium" | "high" | "urgent" | null) ?? null,
          });
          break;
        case "send_message":
        case "send_attachment_message":
          await postMensagem(input.session, input.conversationId, {
            content: String(params.content ?? ""),
            private: false,
            content_type: action.action_name === "send_attachment_message" ? "attachment" : "text",
          });
          break;
        case "add_private_note":
          await postMensagem(input.session, input.conversationId, {
            content: String(params.content ?? ""),
            private: true,
          });
          break;
        case "set_custom_attribute": {
          const key = String(params.attribute_key ?? "");
          if (!key) throw new ApiError("validacao", "attribute_key obrigatório.");
          const row = await db.conversation.findFirst({
            where: { id: input.conversationId, tenantId: input.session.tenantId },
          });
          if (!row) throw new ApiError("nao_encontrado", "Não encontrado.");
          const bag = JSON.parse(row.customAttributesJson || "{}") as Record<string, unknown>;
          bag[key] = params.value;
          await db.conversation.update({
            where: { id: row.id },
            data: { customAttributesJson: JSON.stringify(bag) },
          });
          break;
        }
        case "apply_sla": {
          const { applyConversationSla } = await import("./sla");
          const policyId = String(params.sla_policy_id ?? "");
          if (!policyId) throw new ApiError("validacao", "sla_policy_id obrigatório.");
          await applyConversationSla(input.session, input.conversationId, policyId);
          break;
        }
        case "remove_sla": {
          const { removeConversationSla } = await import("./sla");
          await removeConversationSla(input.session, input.conversationId);
          break;
        }
        case "captain.apply_suggestion": {
          const { aceitarSugestao } = await import("./captain");
          const suggestionId = String(params.suggestion_id ?? "");
          if (!suggestionId) throw new ApiError("validacao", "suggestion_id obrigatório.");
          await aceitarSugestao(input.session, suggestionId);
          break;
        }
        case "send_webhook": {
          if (!input.allowWebhook) {
            throw new ApiError("validacao", "send_webhook não permitido em macros.");
          }
          const url = String(params.url ?? "");
          const webhookId = params.webhook_id ? String(params.webhook_id) : null;
          await jobEnqueuePort.enqueue({
            tenantId: input.session.tenantId,
            kind: "webhook.deliver",
            payload: {
              webhook_id: webhookId,
              url,
              event: "automation_action",
              payload: {
                conversation_id: input.conversationId,
                ...(params.payload as object | undefined),
              },
            },
          });
          break;
        }
        default:
          throw new ApiError("validacao", `Ação desconhecida: ${action.action_name}`);
      }
      applied += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "falha";
      errors.push(`${action.action_name}: ${msg}`);
      // stop rule on first hard failure
      break;
    }
  }
  return { applied, errors };
}

export function systemSession(tenantId: string, userId: string | null | undefined): SessionContext {
  return {
    userId: userId || "system",
    tenantId,
    tenantSlug: "",
    surface: "saas",
    saasRole: "admin",
    isCustomer: false,
    clienteStatus: null,
  };
}

export async function emitAutomationExecuted(
  tenantId: string,
  ruleId: string,
  conversationId: string,
  result: { applied: number; errors: string[] },
) {
  await appendDomainEvent(db, {
    tenantId,
    type: "automation.executed",
    aggregateType: "automation_rule",
    aggregateId: ruleId,
    payload: {
      rule_id: ruleId,
      conversation_id: conversationId,
      applied: result.applied,
      errors: result.errors,
      event_id: newId("tmp"),
    },
  });
}
