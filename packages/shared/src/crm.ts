/** Chatwoot-parity CRM Phase A contracts (packages/shared). */

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
] as const;
export type CrmDomainEventType = (typeof CRM_DOMAIN_EVENT_TYPES)[number];

export const BACKGROUND_JOB_KINDS = [
  "automation.run",
  "webhook.deliver",
  "bot.deliver",
  "campaign.send_batch",
  "csat.deliver",
  "notification.email_stub",
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

export type CrmSseEvent = {
  id: string;
  type: string;
  ts: string;
  payload: unknown;
};
