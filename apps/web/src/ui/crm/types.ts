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
