export function labelDto(row: {
  id: string;
  title: string;
  color: string;
  showOnSidebar: boolean;
  system: boolean;
}) {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    show_on_sidebar: row.showOnSidebar,
    system: row.system,
  };
}

export function contactDto(row: {
  id: string;
  nome: string;
  email: string | null;
  phoneE164: string | null;
  companyId: string | null;
  clienteId: string | null;
  cadastroRequestId: string | null;
  notas: string | null;
  customAttributesJson?: string;
  mergedIntoId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let custom_attributes: Record<string, unknown> = {};
  try {
    custom_attributes = JSON.parse(row.customAttributesJson || "{}") as Record<string, unknown>;
  } catch {
    custom_attributes = {};
  }
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    phone_e164: row.phoneE164,
    company_id: row.companyId,
    cliente_id: row.clienteId,
    cadastro_request_id: row.cadastroRequestId,
    notas: row.notas,
    custom_attributes,
    merged_into_id: row.mergedIntoId ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function companyDto(row: {
  id: string;
  cnpjLast4: string;
  cnpjRegistroPendente: boolean;
  razaoSocial: string;
  nomeFantasia: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    cnpj_last4: row.cnpjLast4,
    cnpj_registro_pendente: row.cnpjRegistroPendente,
    razao_social: row.razaoSocial,
    nome_fantasia: row.nomeFantasia,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function messageDto(row: {
  id: string;
  messageType: string;
  private: boolean;
  content: string;
  contentType: string;
  attachmentMetaJson: string | null;
  senderUserId: string | null;
  deliveryStatus: string;
  simulated: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    message_type: row.messageType,
    private: row.private,
    content: row.content,
    content_type: row.contentType,
    attachment_meta: row.attachmentMetaJson ? JSON.parse(row.attachmentMetaJson) : null,
    sender_user_id: row.senderUserId,
    delivery_status: row.deliveryStatus,
    simulated: row.simulated,
    created_at: row.createdAt.toISOString(),
  };
}

export function conversationDto(row: {
  id: string;
  inboxId: string;
  contactId: string;
  status: string;
  priority: string | null;
  assigneeUserId: string | null;
  teamId: string | null;
  snoozedUntil: Date | null;
  muted: boolean;
  clienteId: string | null;
  cadastroRequestId: string | null;
  orcamentoId: string | null;
  customAttributesJson?: string;
  botAgentBotId?: string | null;
  csatToken?: string | null;
  csatSentAt?: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  contact?: Parameters<typeof contactDto>[0];
  labels?: Array<{ label: Parameters<typeof labelDto>[0] }>;
}) {
  let custom_attributes: Record<string, unknown> = {};
  try {
    custom_attributes = JSON.parse(row.customAttributesJson || "{}") as Record<string, unknown>;
  } catch {
    custom_attributes = {};
  }
  return {
    id: row.id,
    inbox_id: row.inboxId,
    contact_id: row.contactId,
    status: row.status,
    priority: row.priority,
    assignee_user_id: row.assigneeUserId,
    team_id: row.teamId,
    snoozed_until: row.snoozedUntil?.toISOString() ?? null,
    muted: row.muted,
    cliente_id: row.clienteId,
    cadastro_request_id: row.cadastroRequestId,
    orcamento_id: row.orcamentoId,
    custom_attributes,
    bot_agent_bot_id: row.botAgentBotId ?? null,
    csat_sent_at: row.csatSentAt?.toISOString() ?? null,
    last_activity_at: row.lastActivityAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    contact: row.contact ? contactDto(row.contact) : undefined,
    labels: row.labels?.map((l) => labelDto(l.label)),
  };
}

export function inboxDto(row: {
  id: string;
  name: string;
  channelType: string;
  greeting: string | null;
  oooMessage: string | null;
  csatEnabled: boolean;
  lockToSingleConversation: boolean;
  allowAutoAssign: boolean;
  vendedorSeeAll: boolean;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    channel_type: row.channelType,
    greeting: row.greeting,
    ooo_message: row.oooMessage,
    csat_enabled: row.csatEnabled,
    lock_to_single_conversation: row.lockToSingleConversation,
    allow_auto_assign: row.allowAutoAssign,
    vendedor_see_all: row.vendedorSeeAll,
    timezone: row.timezone ?? "America/Sao_Paulo",
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function channelDto(row: {
  id: string;
  inboxId: string;
  provider: string;
  phoneE164Display: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  secretsCiphertext: string | null;
  connectionStatus: string;
  messageTemplatesJson: string;
}) {
  return {
    id: row.id,
    inbox_id: row.inboxId,
    provider: row.provider,
    phone_e164_display: row.phoneE164Display,
    phone_number_id: row.phoneNumberId,
    business_account_id: row.businessAccountId,
    connection_status: row.connectionStatus,
    secrets_present: Boolean(row.secretsCiphertext),
    // Never return plaintext secrets
    api_token: row.secretsCiphertext ? "••••••••" : null,
    api_secret: row.secretsCiphertext ? "••••••••" : null,
    webhook_verify_token: row.secretsCiphertext ? "••••••••" : null,
    message_templates: JSON.parse(row.messageTemplatesJson || "[]") as unknown,
  };
}
