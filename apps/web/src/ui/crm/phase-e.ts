/** Phase E vocabulary — mirrors docs/architecture/crm-chatwoot-parity.md */

import { apiGet, apiSend, asPage, type PageDto } from "../api";
import type {
  CrmAgentCapacityDto,
  CrmAuditEventDto,
  CrmCaptainAssistantDto,
  CrmCaptainStatusDto,
  CrmCaptainSuggestionDto,
  CrmConversationSlaDto,
  CrmCustomRoleDto,
  CrmDashboardAppDto,
  CrmIntegrationInstallDto,
  CrmSamlConfigDto,
  CrmSecurityPolicyDto,
  CrmSlaPolicyDto,
  CrmMfaStatusDto,
} from "./types";

export const CAPTAIN_MODES = ["copilot", "triage", "monitor", "assistant"] as const;
export type CaptainMode = (typeof CAPTAIN_MODES)[number];

export const CUSTOM_ROLE_PERMISSIONS = [
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

export type CustomRolePermission = (typeof CUSTOM_ROLE_PERMISSIONS)[number];

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

export const VOICE_PROVIDERS = ["twilio_voice", "wa_calling"] as const;

export function captainModeLabel(mode: string) {
  switch (mode) {
    case "copilot":
      return "Copiloto";
    case "triage":
      return "Triagem";
    case "monitor":
      return "Monitor";
    case "assistant":
      return "Assistente";
    default:
      return mode;
  }
}

export function permissionLabel(bit: string) {
  switch (bit) {
    case "conversation_manage":
      return "Conversas";
    case "contact_manage":
      return "Contatos";
    case "report_manage":
      return "Relatórios";
    case "knowledge_manage":
      return "Central de ajuda";
    case "automation_manage":
      return "Automações";
    case "integration_manage":
      return "Integrações";
    case "audit_read":
      return "Auditoria (leitura)";
    case "sla_manage":
      return "SLA";
    case "security_manage":
      return "Segurança";
    default:
      return bit;
  }
}

export function integrationProviderLabel(provider: string) {
  switch (provider) {
    case "slack":
      return "Slack";
    case "linear":
      return "Linear";
    case "notion":
      return "Notion";
    case "shopify":
      return "Shopify";
    case "stripe":
      return "Stripe";
    case "dialogflow":
      return "Dialogflow";
    case "google_translate":
      return "Google Translate";
    case "dyte":
      return "Dyte";
    default:
      return provider;
  }
}

export function connectionStatusLabel(status: string) {
  switch (status) {
    case "not_configured":
      return "Não configurado";
    case "credentials_saved":
      return "Credenciais salvas";
    case "connected_stub":
      return "Conectado (stub)";
    case "ready_stub":
      return "Pronto (stub)";
    case "live":
      return "Live (bloqueado)";
    default:
      return status;
  }
}

export function secondsToLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

/* —— SLA —— */

export async function listSlaPolicies() {
  return asPage<CrmSlaPolicyDto>(await apiGet("/api/saas/crm/sla/politicas"));
}

export async function createSlaPolicy(body: Record<string, unknown>) {
  return apiSend<CrmSlaPolicyDto>("/api/saas/crm/sla/politicas", "POST", body);
}

export async function patchSlaPolicy(id: string, body: Record<string, unknown>) {
  return apiSend<CrmSlaPolicyDto>(`/api/saas/crm/sla/politicas/${id}`, "PATCH", body);
}

export async function deleteSlaPolicy(id: string) {
  return apiSend(`/api/saas/crm/sla/politicas/${id}`, "DELETE");
}

export async function putInboxSla(inboxId: string, sla_policy_id: string | null) {
  return apiSend(`/api/saas/crm/inboxes/${inboxId}/sla`, "PUT", { sla_policy_id });
}

export async function getConversationSla(conversationId: string) {
  return apiGet<CrmConversationSlaDto>(`/api/saas/crm/conversas/${conversationId}/sla`);
}

export async function applyConversationSla(conversationId: string, sla_policy_id: string) {
  return apiSend<CrmConversationSlaDto>(`/api/saas/crm/conversas/${conversationId}/sla`, "POST", {
    sla_policy_id,
  });
}

export async function removeConversationSla(conversationId: string) {
  return apiSend(`/api/saas/crm/conversas/${conversationId}/sla`, "DELETE");
}

/* —— Capacidade —— */

export async function listCapacidade() {
  return asPage<CrmAgentCapacityDto>(await apiGet("/api/saas/crm/capacidade"));
}

export async function putCapacidade(rows: Array<{ user_id: string; max_open_conversations: number }>) {
  return apiSend<PageDto<CrmAgentCapacityDto> | CrmAgentCapacityDto[]>(
    "/api/saas/crm/capacidade",
    "PUT",
    { items: rows },
  );
}

export async function putInboxAtributosObrigatorios(inboxId: string, keys: string[]) {
  return apiSend(`/api/saas/crm/inboxes/${inboxId}/atributos-obrigatorios`, "PUT", { keys });
}

/* —— Captain —— */

export async function listCaptainAssistants() {
  return asPage<CrmCaptainAssistantDto>(await apiGet("/api/saas/crm/captain/assistentes"));
}

export async function createCaptainAssistant(body: Record<string, unknown>) {
  return apiSend<CrmCaptainAssistantDto>("/api/saas/crm/captain/assistentes", "POST", body);
}

export async function patchCaptainAssistant(id: string, body: Record<string, unknown>) {
  return apiSend<CrmCaptainAssistantDto>(`/api/saas/crm/captain/assistentes/${id}`, "PATCH", body);
}

export async function deleteCaptainAssistant(id: string) {
  return apiSend(`/api/saas/crm/captain/assistentes/${id}`, "DELETE");
}

export async function getCaptainStatus() {
  return apiGet<CrmCaptainStatusDto>("/api/saas/crm/captain/status");
}

export async function suggestCaptain(body: {
  conversation_id: string;
  mode: string;
  assistant_id?: string | null;
}) {
  return apiSend<CrmCaptainSuggestionDto>("/api/saas/crm/captain/sugerir", "POST", body);
}

export async function listCaptainSuggestions(params?: {
  conversation_id?: string;
  status?: string;
}) {
  const q = new URLSearchParams();
  if (params?.conversation_id) q.set("conversation_id", params.conversation_id);
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return asPage<CrmCaptainSuggestionDto>(
    await apiGet(`/api/saas/crm/captain/sugestoes${qs ? `?${qs}` : ""}`),
  );
}

export async function acceptCaptainSuggestion(id: string) {
  return apiSend<CrmCaptainSuggestionDto>(`/api/saas/crm/captain/sugestoes/${id}/aceitar`, "POST");
}

export async function dismissCaptainSuggestion(id: string) {
  return apiSend<CrmCaptainSuggestionDto>(
    `/api/saas/crm/captain/sugestoes/${id}/descartar`,
    "POST",
  );
}

/* —— Auditoria —— */

export async function listAuditoria(params?: {
  cursor?: string;
  actor_user_id?: string;
  action?: string;
  from?: string;
  to?: string;
  aggregate_type?: string;
}) {
  const q = new URLSearchParams();
  if (params?.cursor) q.set("cursor", params.cursor);
  if (params?.actor_user_id) q.set("actor_user_id", params.actor_user_id);
  if (params?.action) q.set("action", params.action);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.aggregate_type) q.set("aggregate_type", params.aggregate_type);
  const qs = q.toString();
  return asPage<CrmAuditEventDto>(await apiGet(`/api/saas/crm/auditoria${qs ? `?${qs}` : ""}`));
}

export async function getAuditoria(id: string) {
  return apiGet<CrmAuditEventDto>(`/api/saas/crm/auditoria/${id}`);
}

/* —— Segurança —— */

export async function getSamlConfig() {
  return apiGet<CrmSamlConfigDto>("/api/saas/crm/seguranca/saml");
}

export async function putSamlConfig(body: Record<string, unknown>) {
  return apiSend<CrmSamlConfigDto>("/api/saas/crm/seguranca/saml", "PUT", body);
}

export async function testSamlConfig() {
  return apiSend<{ ok: boolean; message?: string }>("/api/saas/crm/seguranca/saml/testar", "POST");
}

export async function getMfaStatus() {
  return apiGet<CrmMfaStatusDto>("/api/saas/crm/seguranca/mfa");
}

export async function startMfa() {
  return apiSend<{ secret: string; otpauth_uri: string }>("/api/saas/crm/seguranca/mfa/iniciar", "POST");
}

export async function confirmMfa(code: string) {
  return apiSend("/api/saas/crm/seguranca/mfa/confirmar", "POST", { code });
}

export async function disableMfa(code: string) {
  return apiSend("/api/saas/crm/seguranca/mfa/desativar", "POST", { code });
}

export async function adminResetMfa(userId: string) {
  return apiSend(`/api/saas/crm/seguranca/mfa/admin-reset/${userId}`, "POST");
}

export async function putSecurityPolicy(body: Partial<CrmSecurityPolicyDto>) {
  return apiSend<CrmSecurityPolicyDto>("/api/saas/crm/seguranca/politica", "PUT", body);
}

/* —— Papéis —— */

export async function listPapeis() {
  return asPage<CrmCustomRoleDto>(await apiGet("/api/saas/crm/papeis"));
}

export async function createPapel(body: Record<string, unknown>) {
  return apiSend<CrmCustomRoleDto>("/api/saas/crm/papeis", "POST", body);
}

export async function patchPapel(id: string, body: Record<string, unknown>) {
  return apiSend<CrmCustomRoleDto>(`/api/saas/crm/papeis/${id}`, "PATCH", body);
}

export async function deletePapel(id: string) {
  return apiSend(`/api/saas/crm/papeis/${id}`, "DELETE");
}

/* —— Integrações —— */

export async function listIntegracoes() {
  return asPage<CrmIntegrationInstallDto>(await apiGet("/api/saas/crm/integracoes"));
}

export async function getIntegracao(provider: string) {
  return apiGet<CrmIntegrationInstallDto>(`/api/saas/crm/integracoes/${provider}`);
}

export async function putIntegracao(provider: string, body: Record<string, unknown>) {
  return apiSend<CrmIntegrationInstallDto>(`/api/saas/crm/integracoes/${provider}`, "PUT", body);
}

export async function disconnectIntegracao(provider: string) {
  return apiSend(`/api/saas/crm/integracoes/${provider}/desconectar`, "POST");
}

export async function testIntegracao(provider: string) {
  return apiSend<{ ok: boolean; message?: string }>(
    `/api/saas/crm/integracoes/${provider}/testar`,
    "POST",
  );
}

/* —— Apps painel —— */

export async function listAppsPainel() {
  return asPage<CrmDashboardAppDto>(await apiGet("/api/saas/crm/apps-painel"));
}

export async function createAppPainel(body: Record<string, unknown>) {
  return apiSend<CrmDashboardAppDto>("/api/saas/crm/apps-painel", "POST", body);
}

export async function patchAppPainel(id: string, body: Record<string, unknown>) {
  return apiSend<CrmDashboardAppDto>(`/api/saas/crm/apps-painel/${id}`, "PATCH", body);
}

export async function deleteAppPainel(id: string) {
  return apiSend(`/api/saas/crm/apps-painel/${id}`, "DELETE");
}

export async function listConversationApps(conversationId: string) {
  return asPage<CrmDashboardAppDto>(
    await apiGet(`/api/saas/crm/conversas/${conversationId}/apps-painel`),
  );
}

/* —— CSAT notes / HC domain —— */

export async function patchCsatReview(id: string, review_note: string | null) {
  return apiSend(`/api/saas/crm/csat/${id}`, "PATCH", { review_note });
}

export async function putPortalDominio(custom_domain: string | null) {
  return apiSend("/api/saas/crm/central-ajuda/portal/dominio", "PUT", { custom_domain });
}

export async function verifyPortalDominio() {
  return apiSend<{
    verified?: boolean;
    status?: string;
    message?: string;
  }>("/api/saas/crm/central-ajuda/portal/dominio/verificar", "POST");
}
