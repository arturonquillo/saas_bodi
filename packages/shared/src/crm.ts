/** Chatwoot-parity CRM Phase A+B contracts (packages/shared). */

export const CONVERSATION_STATUSES = ["open", "pending", "snoozed", "resolved"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type ConversationPriority = (typeof CONVERSATION_PRIORITIES)[number];

export const MESSAGE_TYPES = ["incoming", "outgoing", "activity"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_CONTENT_TYPES = ["text", "attachment"] as const;
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPES)[number];

export const MESSAGE_DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;
export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUSES)[number];

export const CHANNEL_TYPES = ["whatsapp"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const WA_CONNECTION_STATUSES = [
  "not_configured",
  "credentials_saved",
  "ready_stub",
  "live",
] as const;
export type WaConnectionStatus = (typeof WA_CONNECTION_STATUSES)[number];

/** Phase A max reachable status — API rejects `live`. */
export const WA_CONNECTION_MAX_PHASE_A: WaConnectionStatus = "ready_stub";

export const AGENT_AVAILABILITIES = ["online", "busy", "offline"] as const;
export type AgentAvailability = (typeof AGENT_AVAILABILITIES)[number];

export const PRESENCE_STATES = ["viewing", "typing", "online", "busy", "offline"] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const OUTBOX_CATEGORIES = [
  "commerce",
  "campaign",
  "crm_agent",
  "csat",
  "agent_email",
] as const;
export type OutboxCategory = (typeof OUTBOX_CATEGORIES)[number];

export const SYSTEM_INTENT_LABELS = [
  "intent:cadastro",
  "intent:orcamento",
  "intent:info_empresa",
  "intent:outro",
] as const;
export type SystemIntentLabel = (typeof SYSTEM_INTENT_LABELS)[number];

export const CRM_DOMAIN_EVENT_TYPES = [
  "conversation.created",
  "conversation.updated",
  "conversation.status_changed",
  "conversation.assigned",
  "message.created",
  "contact.updated",
  "agent.viewing",
  "agent.typing",
  // Phase B
  "automation.executed",
  "macro.executed",
  "csat.requested",
  "csat.submitted",
  "bot.messaged",
  "bot.handed_off",
  "webhook.delivered",
  "webhook.failed",
  "contact.merged",
  "contact.imported",
  "mention.created",
] as const;
export type CrmDomainEventType = (typeof CRM_DOMAIN_EVENT_TYPES)[number];

export const BACKGROUND_JOB_KINDS = [
  "automation.run",
  "webhook.deliver",
  "bot.deliver",
  "campaign.send_batch",
  "csat.deliver",
  "notification.email_stub",
  "contact.import_csv",
  "assignment.round_robin",
] as const;
export type BackgroundJobKind = (typeof BACKGROUND_JOB_KINDS)[number];

export const BACKGROUND_JOB_STATUSES = [
  "pendente",
  "processando",
  "concluido",
  "falha",
  "morto",
] as const;
export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

/** Automation event_name vocabulary (underscore); map from dotted domain_events.type. */
export const AUTOMATION_EVENT_NAMES = [
  "conversation_created",
  "conversation_updated",
  "conversation_status_changed",
  "conversation_resolved",
  "message_created",
  "contact_created",
  "contact_updated",
] as const;
export type AutomationEventName = (typeof AUTOMATION_EVENT_NAMES)[number];

export const AUTOMATION_CONDITION_OPERATORS = [
  "equal",
  "not_equal",
  "contains",
  "does_not_contain",
  "is_present",
  "is_not_present",
  "is_greater_than",
  "is_less_than",
] as const;
export type AutomationConditionOperator = (typeof AUTOMATION_CONDITION_OPERATORS)[number];

export const AUTOMATION_ACTION_NAMES = [
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
export type AutomationActionName = (typeof AUTOMATION_ACTION_NAMES)[number];

export const MACRO_VISIBILITIES = ["public", "private"] as const;
export type MacroVisibility = (typeof MACRO_VISIBILITIES)[number];

export const CUSTOM_ATTRIBUTE_MODELS = ["contact", "conversation"] as const;
export type CustomAttributeModel = (typeof CUSTOM_ATTRIBUTE_MODELS)[number];

export const CUSTOM_ATTRIBUTE_DISPLAY_TYPES = [
  "text",
  "number",
  "link",
  "date",
  "list",
  "checkbox",
] as const;
export type CustomAttributeDisplayType = (typeof CUSTOM_ATTRIBUTE_DISPLAY_TYPES)[number];

export const CUSTOM_FILTER_TYPES = ["conversation", "contact"] as const;
export type CustomFilterType = (typeof CUSTOM_FILTER_TYPES)[number];

export const ASSIGNMENT_POLICY_KINDS = ["round_robin"] as const;
export type AssignmentPolicyKind = (typeof ASSIGNMENT_POLICY_KINDS)[number];

export type CrmSseEvent = {
  id: string;
  type: string;
  ts: string;
  payload: unknown;
};

/** Map domain_events.type (dotted) → automation event_name (underscore). */
export function domainEventToAutomationEvent(type: string): AutomationEventName | null {
  switch (type) {
    case "conversation.created":
      return "conversation_created";
    case "conversation.updated":
      return "conversation_updated";
    case "conversation.status_changed":
      return "conversation_status_changed";
    case "message.created":
      return "message_created";
    case "contact.updated":
      return "contact_updated";
    default:
      return null;
  }
}
