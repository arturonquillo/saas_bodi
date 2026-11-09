/** Frontend DTOs for `/api/saas/crm/*` — shapes from docs/architecture. */

export type ConversationStatus = "open" | "pending" | "snoozed" | "resolved";
export type ConversationPriority = "low" | "medium" | "high" | "urgent";
export type WaConnectionStatus =
  | "not_configured"
  | "credentials_saved"
  | "ready_stub"
  | "live";
export type AgentAvailability = "online" | "busy" | "offline";
export type MessageType = "incoming" | "outgoing" | "activity";

export type CrmLabelDto = {
  id: string;
  title: string;
  color: string;
  description?: string | null;
  system?: boolean;
  show_on_sidebar?: boolean;
};

export type CrmContactDto = {
  id: string;
  nome: string;
  email?: string | null;
  phone_e164?: string | null;
  company_id?: string | null;
  company_nome?: string | null;
  cliente_id?: string | null;
  cadastro_request_id?: string | null;
  notas?: string | null;
  labels?: CrmLabelDto[];
  custom_attributes?: Record<string, unknown>;
  updated_at?: string;
  created_at?: string;
};

export type CrmEmpresaDto = {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj_last4?: string | null;
  cnpj_registro_pendente?: boolean;
  contact_count?: number;
  updated_at?: string;
};

export type CrmMessageDto = {
  id: string;
  conversation_id?: string;
  message_type: MessageType | string;
  private: boolean;
  content: string;
  content_type?: string;
  sender_user_id?: string | null;
  delivery_status?: string | null;
  simulated?: boolean;
  created_at: string;
};

export type CrmConversationDto = {
  id: string;
  inbox_id: string;
  inbox_name?: string | null;
  contact_id: string;
  contact?: CrmContactDto | null;
  status: ConversationStatus | string;
  priority?: ConversationPriority | string | null;
  assignee_user_id?: string | null;
  assignee_nome?: string | null;
  team_id?: string | null;
  team_nome?: string | null;
  muted?: boolean;
  snoozed_until?: string | null;
  unread?: boolean;
  unread_count?: number;
  preview?: string | null;
  labels?: CrmLabelDto[];
  cliente_id?: string | null;
  cadastro_request_id?: string | null;
  orcamento_id?: string | null;
  draft?: string | null;
  viewers?: Array<{ user_id: string; nome?: string }>;
  custom_attributes?: Record<string, unknown>;
  bot_agent_bot_id?: string | null;
  last_activity_at?: string;
  updated_at: string;
  created_at?: string;
  messages?: CrmMessageDto[];
};

export type CrmConversationDetailDto = CrmConversationDto & {
  messages: CrmMessageDto[];
  contact: CrmContactDto;
};

export type CrmInboxDto = {
  id: string;
  name: string;
  channel_type: string;
  greeting?: string | null;
  ooo_message?: string | null;
  csat_enabled?: boolean;
  lock_to_single_conversation?: boolean;
  allow_auto_assign?: boolean;
  timezone?: string;
  member_count?: number;
  connection_status?: WaConnectionStatus | string;
};

export type CrmChannelDto = {
  inbox_id: string;
  provider?: string;
  phone_e164_display?: string | null;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  secrets_present?: boolean;
  connection_status: WaConnectionStatus | string;
};

/** Phase D — omnichannel + Loja widget */

export type ChannelTypeD =
  | "whatsapp"
  | "web_widget"
  | "email"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "telegram"
  | "line"
  | "sms"
  | "api";

export type PreChatField = {
  name: string;
  type: string;
  label_pt: string;
  required: boolean;
};

export type CrmCanalDto = {
  inbox_id: string;
  channel_type: ChannelTypeD | string;
  connection_status: WaConnectionStatus | string;
  secrets_present?: boolean;
  provider?: string | null;
  phone_e164_display?: string | null;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  forward_to_email?: string | null;
  from_email_display?: string | null;
  email_template_id?: string | null;
  external_page_or_bot_id?: string | null;
  from_number_display?: string | null;
  token_prefix?: string | null;
  token_last4?: string | null;
  callback_url?: string | null;
  website_token?: string | null;
  allowed_origins?: string[];
  welcome_title?: string | null;
  widget_color?: string | null;
  continuity?: "session" | "contact" | string;
};

export type CrmWidgetConfigDto = {
  inbox_id: string;
  channel_type?: string;
  website_token?: string | null;
  hmac_secret_present?: boolean;
  allowed_origins?: string[];
  pre_chat_fields?: PreChatField[];
  welcome_title?: string | null;
  widget_color?: string | null;
  continuity?: "session" | "contact" | string;
  connection_status?: WaConnectionStatus | string;
};

export type CrmWidgetSnippetDto = {
  website_token: string;
  /** Backend field name from getWidgetSnippet. */
  snippet: string;
  snippet_html?: string;
  snippet_js?: string;
};

export type CrmEmailTemplateDto = {
  id: string;
  name: string;
  slug: string;
  subject_template: string;
  body_html_template: string;
  updated_at?: string;
  created_at?: string;
};

export type CrmPushSubscriptionDto = {
  id: string;
  endpoint: string;
  created_at?: string;
};

export type WidgetBootstrapDto = {
  inbox_id: string;
  greeting?: string | null;
  welcome_title?: string | null;
  widget_color?: string | null;
  pre_chat_fields: PreChatField[];
  campaigns?: Array<{ id: string; title: string; message?: string | null }>;
  nome_fantasia?: string | null;
};

export type WidgetSessionDto = {
  session_token: string;
};

export type WidgetConversaDto = {
  id: string;
  status?: string;
  updated_at?: string;
} | null;

export type WidgetMessageDto = {
  id: string;
  message_type: string;
  content: string;
  content_type?: string;
  created_at: string;
};

export type CrmTemplateDto = {
  key: string;
  body: string;
};

export type CrmTeamDto = {
  id: string;
  name: string;
  member_count?: number;
  member_ids?: string[];
};

export type CrmCannedDto = {
  id: string;
  short_code: string;
  content: string;
};

export type CrmNotificationDto = {
  id: string;
  type?: string;
  title: string;
  body?: string | null;
  conversation_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type CrmNotificationPrefsDto = {
  assigned: boolean;
  unassigned_conversation: boolean;
  conversation_activity: boolean;
  email_enabled: boolean;
};

export type CrmPerfilDto = {
  availability: AgentAvailability | string;
  signature?: string | null;
};

export type CrmSearchHitDto = {
  type: "conversation" | "contact" | "message" | string;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export type CrmSearchResultDto = {
  /** Backend buscaCrm shape */
  conversations?: Array<{
    id: string;
    contact?: { nome?: string | null; phone_e164?: string | null } | null;
  }>;
  contacts?: Array<{ id: string; nome: string; phone_e164?: string | null; email?: string | null }>;
  messages?: Array<{ id: string; conversation_id: string; content: string; created_at: string }>;
  companies?: Array<{ id: string; razao_social: string }>;
  /** Legacy / flattened */
  conversas?: CrmSearchHitDto[];
  contatos?: CrmSearchHitDto[];
  mensagens?: CrmSearchHitDto[];
  items?: CrmSearchHitDto[];
};

export type CrmSseEvent = {
  id: string;
  type: string;
  ts: string;
  payload: unknown;
};

/** Phase B — operator power DTOs */

export type AutomationEventName =
  | "conversation_created"
  | "conversation_updated"
  | "conversation_status_changed"
  | "conversation_resolved"
  | "message_created"
  | "contact_created"
  | "contact_updated";

export type ConditionOperator =
  | "equal"
  | "not_equal"
  | "contains"
  | "does_not_contain"
  | "is_present"
  | "is_not_present"
  | "is_greater_than"
  | "is_less_than";

export type AutomationCondition = {
  attribute_key: string;
  filter_operator: ConditionOperator | string;
  values: string[];
};

export type AutomationAction = {
  action_name: string;
  action_params?: Record<string, unknown>;
};

export type CrmAutomationDto = {
  id: string;
  name: string;
  description?: string | null;
  event_name: AutomationEventName | string;
  conditions: { operator: "and"; values: AutomationCondition[] } | AutomationCondition[];
  actions: AutomationAction[];
  active: boolean;
  created_by_user_id?: string | null;
  updated_at?: string;
};

export type CrmMacroDto = {
  id: string;
  name: string;
  visibility: "public" | "private" | string;
  owner_user_id?: string | null;
  actions: AutomationAction[];
  updated_at?: string;
};

export type AttributeDisplayType = "text" | "number" | "link" | "date" | "list" | "checkbox";
export type AttributeModel = "contact" | "conversation";

export type CrmAttributeDto = {
  id: string;
  attribute_model: AttributeModel | string;
  attribute_display_type: AttributeDisplayType | string;
  attribute_key: string;
  attribute_display_name: string;
  default_value?: unknown;
  attribute_values?: string[] | unknown;
};

export type CrmBotDto = {
  id: string;
  name: string;
  description?: string | null;
  outgoing_url: string;
  /** Masked by default; plaintext only when `token_revealed` on create. */
  token?: string | null;
  token_revealed?: boolean;
  active: boolean;
  inbox_ids?: string[];
};

export type CrmWebhookDto = {
  id: string;
  name?: string | null;
  url: string;
  subscriptions: string[];
  inbox_id?: string | null;
  active: boolean;
};

export type CrmWorkingHourDto = {
  day_of_week: number;
  closed_all_day?: boolean;
  open_all_day?: boolean;
  open_hour?: number | null;
  open_minutes?: number | null;
  close_hour?: number | null;
  close_minutes?: number | null;
};

export type CrmWorkingHoursDto = {
  timezone: string;
  hours: CrmWorkingHourDto[];
  open_now?: boolean;
  next_open_at?: string | null;
};

export type CrmAssignmentPolicyDto = {
  kind: "round_robin" | string;
  enabled: boolean;
  last_assigned_user_id?: string | null;
};

export type CrmCsatDto = {
  id: string;
  conversation_id: string;
  inbox_id: string;
  contact_id?: string | null;
  rating: number;
  feedback_message?: string | null;
  assigned_agent_id?: string | null;
  submitted_at: string;
};

export type CrmFilterDto = {
  id: string;
  name: string;
  filter_type: "conversation" | "contact" | string;
  query: Record<string, unknown>;
  user_id?: string;
};

export type CrmImportPreviewDto = {
  total_rows: number;
  preview: Array<Record<string, string>>;
  dry_run: boolean;
};

export type CrmImportBatchDto = {
  batch_id: string;
  status: "pendente" | "processando" | "concluido" | "falha" | string;
  stats?: {
    total?: number;
    created?: number;
    updated?: number;
    errors?: number;
    failed?: number;
  };
  last_error?: string | null;
};

/** Phase C — campaigns, help center, reports */

export type CampaignKind = "one_off" | "ongoing";
export type CampaignStatus = "draft" | "scheduled" | "active" | "completed" | "cancelled";
export type CampaignChannel = "whatsapp" | "sms";
export type CampaignDisplayStatus = "awaiting_widget" | "ready";
export type CampaignRecipientStatus = "pendente" | "enviado" | "falha" | "omitido";

export type CrmCampaignDto = {
  id: string;
  title: string;
  description?: string | null;
  kind: CampaignKind | string;
  status: CampaignStatus | string;
  inbox_id?: string | null;
  channel: CampaignChannel | string;
  audience_label_ids: string[];
  template_key?: string | null;
  message?: string | null;
  scheduled_at?: string | null;
  display_status?: CampaignDisplayStatus | string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_by_user_id?: string | null;
  stats?: {
    targeted?: number;
    enviado?: number;
    falha?: number;
    omitido?: number;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type CrmCampaignRecipientDto = {
  id: string;
  campaign_id: string;
  contact_id: string;
  /** Not currently returned by Phase C recipient DTO — UI falls back to contact_id. */
  contact_nome?: string | null;
  status: CampaignRecipientStatus | string;
  outbox_id?: string | null;
  error?: string | null;
};

export type ArticleStatus = "draft" | "published" | "archived";

export type CrmPortalDto = {
  id: string;
  name: string;
  slug: string;
  header_text?: string | null;
  homepage_md?: string | null;
  locale: string;
  enabled: boolean;
  custom_domain?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CrmHelpCategoryDto = {
  id: string;
  portal_id: string;
  name: string;
  slug: string;
  description?: string | null;
  position: number;
  parent_category_id?: string | null;
};

export type CrmHelpArticleDto = {
  id: string;
  portal_id: string;
  category_id: string;
  title: string;
  slug: string;
  content_md: string;
  content_html?: string | null;
  status: ArticleStatus | string;
  author_user_id?: string | null;
  published_at?: string | null;
  position?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type PublicHelpPortalDto = {
  name: string;
  slug: string;
  header_text?: string | null;
  homepage_md?: string | null;
  locale: string;
};

export type PublicHelpCategoryDto = {
  id?: string;
  portal_id?: string;
  name: string;
  slug: string;
  description?: string | null;
  position: number;
  parent_category_id?: string | null;
  /** Backend field name (Phase C). */
  published_count: number;
};

export type PublicHelpArticleListDto = {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  published_at?: string | null;
  position?: number | null;
};

export type PublicHelpArticleDto = {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  content_md?: string | null;
  content_html?: string | null;
  published_at?: string | null;
};

/** Backend `series` is polymorphic: row array, named day buckets, or scalar map. */
export type CrmReportDto = {
  series:
    | Array<Record<string, string | number | null | undefined>>
    | Record<string, unknown>;
  totals: Record<string, number | string | null>;
  generated_at: string;
};
