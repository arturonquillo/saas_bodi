/** Chatwoot-parity CRM Phase A+B+C+D+E contracts (packages/shared). */

export const CONVERSATION_STATUSES = ["open", "pending", "snoozed", "resolved"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type ConversationPriority = (typeof CONVERSATION_PRIORITIES)[number];

export const MESSAGE_TYPES = ["incoming", "outgoing", "activity"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_CONTENT_TYPES = [
  "text",
  "attachment",
  "input_select",
  "cards",
  "form",
] as const;
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPES)[number];

/** Interactive types allowed only on web_widget + api inboxes (Phase D). */
export const INTERACTIVE_CONTENT_TYPES = ["input_select", "cards", "form"] as const;
export type InteractiveContentType = (typeof INTERACTIVE_CONTENT_TYPES)[number];

export const MESSAGE_DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;
export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUSES)[number];

export const CHANNEL_TYPES = [
  "whatsapp",
  "web_widget",
  "email",
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "telegram",
  "line",
  "sms",
  "api",
  "voice",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const VOICE_CHANNEL_PROVIDERS = ["twilio_voice", "wa_calling"] as const;
export type VoiceChannelProvider = (typeof VOICE_CHANNEL_PROVIDERS)[number];

export const SOCIAL_CHANNEL_TYPES = [
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "telegram",
  "line",
] as const;
export type SocialChannelType = (typeof SOCIAL_CHANNEL_TYPES)[number];

export const WIDGET_CONTINUITIES = ["session", "contact"] as const;
export type WidgetContinuity = (typeof WIDGET_CONTINUITIES)[number];

export const EMAIL_CHANNEL_PROVIDERS = ["smtp_imap", "google", "microsoft"] as const;
export type EmailChannelProvider = (typeof EMAIL_CHANNEL_PROVIDERS)[number];

export const SMS_CHANNEL_PROVIDERS = ["twilio", "bandwidth"] as const;
export type SmsChannelProvider = (typeof SMS_CHANNEL_PROVIDERS)[number];

/** Channels that may carry interactive message content_types. */
export const INTERACTIVE_CHANNEL_TYPES = ["web_widget", "api"] as const;

export const WA_CONNECTION_STATUSES = [
  "not_configured",
  "credentials_saved",
  "ready_stub",
  "live",
] as const;
export type WaConnectionStatus = (typeof WA_CONNECTION_STATUSES)[number];

/** Phase A–E max reachable channel status — API rejects `live`. */
export const WA_CONNECTION_MAX_PHASE_A: WaConnectionStatus = "ready_stub";
export const CHANNEL_CONNECTION_MAX_PHASE_D: WaConnectionStatus = "ready_stub";
export const CHANNEL_CONNECTION_MAX_PHASE_E: WaConnectionStatus = "ready_stub";

export const INTEGRATION_PROVIDERS = [
  "slack",
  "linear",
  "notion",
  "shopify",
  "stripe",
  "dialogflow",
  "google_translate",
  "dyte",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_CONNECTION_STATUSES = [
  "not_configured",
  "credentials_saved",
  "connected_stub",
  "live",
] as const;
export type IntegrationConnectionStatus = (typeof INTEGRATION_CONNECTION_STATUSES)[number];

/** Phase E max reachable integration status — API rejects `live`. */
export const INTEGRATION_CONNECTION_MAX: IntegrationConnectionStatus = "connected_stub";

export const CAPTAIN_MODES = ["copilot", "triage", "monitor", "assistant"] as const;
export type CaptainMode = (typeof CAPTAIN_MODES)[number];

export const CAPTAIN_SUGGESTION_STATUSES = [
  "pending",
  "accepted",
  "dismissed",
  "expired",
] as const;
export type CaptainSuggestionStatus = (typeof CAPTAIN_SUGGESTION_STATUSES)[number];

export const CUSTOM_ROLE_PERMISSION_BITS = [
  "conversation_manage",
  "contact_manage",
  "report_manage",
  "knowledge_manage",
  "automation_manage",
  "integration_manage",
  "audit_read",
  "sla_manage",
  "security_manage",
] as const;
export type CustomRolePermissionBit = (typeof CUSTOM_ROLE_PERMISSION_BITS)[number];

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
  // Phase C
  "campaign.created",
  "campaign.updated",
  "campaign.started",
  "campaign.completed",
  "campaign.cancelled",
  "portal.updated",
  "article.published",
  "article.unpublished",
  // Phase D
  "channel.updated",
  "widget.session_started",
  "widget.message_created",
  "campaign.displayed",
  "push.subscribed",
  "push.failed",
  // Phase E
  "sla.applied",
  "sla.removed",
  "sla.threshold_warning",
  "sla.breached",
  "sla.hit",
  "capacity.updated",
  "captain.suggestion_created",
  "captain.suggestion_accepted",
  "captain.suggestion_dismissed",
  "integration.updated",
  "saml.updated",
  "mfa.enrolled",
  "mfa.disabled",
  "custom_role.updated",
  "dashboard_app.updated",
  "voice.simulated",
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
  "report.rollup_daily",
  "push.notify",
  "email.channel_stub_deliver",
  "channel.simulate_social_ingest",
  // Phase E
  "sla.evaluate",
  "assignment.balanced",
  "captain.suggest",
  "captain.monitor_scan",
  "integration.deliver",
  "audit.prune",
  "dns.verify_portal_domain",
] as const;

export const CAMPAIGN_KINDS = ["one_off", "ongoing"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_CHANNELS = ["whatsapp", "sms"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_DISPLAY_STATUSES = ["awaiting_widget", "ready"] as const;
export type CampaignDisplayStatus = (typeof CAMPAIGN_DISPLAY_STATUSES)[number];

export const CAMPAIGN_RECIPIENT_STATUSES = [
  "pendente",
  "enviado",
  "falha",
  "omitido",
] as const;
export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

export const ARTICLE_STATUSES = ["draft", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const REPORT_SERIES = [
  "visao-geral",
  "conversas",
  "agentes",
  "labels",
  "inboxes",
  "equipes",
  "csat",
  "bots",
  "sla",
] as const;
export type ReportSeries = (typeof REPORT_SERIES)[number];

/** Max recipients per campaign blast (MVP). */
export const CAMPAIGN_AUDIENCE_CAP = 5000;

/** Max report date range in days. */
export const REPORT_MAX_RANGE_DAYS = 90;
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
  "apply_sla",
  "remove_sla",
  "captain.apply_suggestion",
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

export const ASSIGNMENT_POLICY_KINDS = ["round_robin", "balanced"] as const;
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
