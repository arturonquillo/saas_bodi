/** Phase B vocabulary — mirrors docs/architecture/crm-chatwoot-parity.md */

export const AUTOMATION_EVENTS = [
  "conversation_created",
  "conversation_updated",
  "conversation_status_changed",
  "conversation_resolved",
  "message_created",
  "contact_created",
  "contact_updated",
] as const;

export const CONDITION_OPERATORS = [
  "equal",
  "not_equal",
  "contains",
  "does_not_contain",
  "is_present",
  "is_not_present",
  "is_greater_than",
  "is_less_than",
] as const;

export const CONDITION_ATTRIBUTES = [
  "status",
  "priority",
  "inbox_id",
  "team_id",
  "assignee_id",
  "message_type",
  "content",
  "contact_email",
  "contact_phone",
  "label_ids",
] as const;

export const AUTOMATION_ACTIONS = [
  "assign_agent",
  "assign_team",
  "add_label",
  "remove_label",
  "mute",
  "snooze",
  "resolve",
  "change_status",
  "change_priority",
  "send_message",
  "send_attachment_message",
  "send_webhook",
  "add_private_note",
  "set_custom_attribute",
] as const;

/** Macros omit send_webhook (architecture lock). */
export const MACRO_ACTIONS = AUTOMATION_ACTIONS.filter((a) => a !== "send_webhook");

export const ATTRIBUTE_TYPES = ["text", "number", "link", "date", "list", "checkbox"] as const;

export const DAY_LABELS_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export function eventLabel(event: string) {
  const map: Record<string, string> = {
    conversation_created: "Conversa criada",
    conversation_updated: "Conversa atualizada",
    conversation_status_changed: "Status alterado",
    conversation_resolved: "Conversa resolvida",
    message_created: "Mensagem criada",
    contact_created: "Contato criado",
    contact_updated: "Contato atualizado",
  };
  return map[event] ?? event;
}

export function operatorLabel(op: string) {
  const map: Record<string, string> = {
    equal: "igual a",
    not_equal: "diferente de",
    contains: "contém",
    does_not_contain: "não contém",
    is_present: "está presente",
    is_not_present: "não está presente",
    is_greater_than: "maior que",
    is_less_than: "menor que",
  };
  return map[op] ?? op;
}

export function actionLabel(name: string) {
  const map: Record<string, string> = {
    assign_agent: "Atribuir agente",
    assign_team: "Atribuir equipe",
    add_label: "Adicionar label",
    remove_label: "Remover label",
    mute: "Silenciar",
    snooze: "Adiar",
    resolve: "Resolver",
    change_status: "Alterar status",
    change_priority: "Alterar prioridade",
    send_message: "Enviar mensagem",
    send_attachment_message: "Enviar anexo",
    send_webhook: "Enviar webhook",
    add_private_note: "Nota privada",
    set_custom_attribute: "Definir atributo",
  };
  return map[name] ?? name;
}

export function defaultWeekHours() {
  return Array.from({ length: 7 }, (_, day_of_week) => {
    const weekend = day_of_week === 0 || day_of_week === 6;
    return {
      day_of_week,
      closed_all_day: weekend,
      open_all_day: false,
      open_hour: weekend ? null : 8,
      open_minutes: weekend ? null : 0,
      close_hour: weekend ? null : 18,
      close_minutes: weekend ? null : 0,
    };
  });
}

export function normalizeConditions(
  raw: unknown,
): Array<{ attribute_key: string; filter_operator: string; values: string[] }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((c) => ({
      attribute_key: String((c as { attribute_key?: string }).attribute_key ?? ""),
      filter_operator: String((c as { filter_operator?: string }).filter_operator ?? "equal"),
      values: Array.isArray((c as { values?: string[] }).values)
        ? ((c as { values: string[] }).values as string[])
        : [],
    }));
  }
  if (typeof raw === "object" && raw && "values" in raw && Array.isArray((raw as { values: unknown }).values)) {
    return normalizeConditions((raw as { values: unknown }).values);
  }
  return [];
}
