/** Phase D vocabulary — mirrors docs/architecture/crm-chatwoot-parity.md */

import { apiGet, apiSend, asPage, type PageDto } from "../api";
import type {
  ChannelTypeD,
  CrmCanalDto,
  CrmEmailTemplateDto,
  CrmInboxDto,
  CrmWidgetConfigDto,
  CrmWidgetSnippetDto,
  PreChatField,
} from "./types";

export const CHANNEL_TYPES_D = [
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
] as const satisfies readonly ChannelTypeD[];

export const SOCIAL_CHANNEL_TYPES = [
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "telegram",
  "line",
] as const;

export const CAIXAS_API = "/api/saas/crm/caixas";
export const INBOXES_API = "/api/saas/crm/inboxes";

export function channelTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "whatsapp":
      return "WhatsApp";
    case "web_widget":
      return "Widget da loja";
    case "email":
      return "E-mail";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "twitter":
      return "X (Twitter)";
    case "telegram":
      return "Telegram";
    case "line":
      return "LINE";
    case "sms":
      return "SMS";
    case "api":
      return "API";
    default:
      return type ?? "—";
  }
}

export function isSocialChannel(type: string | null | undefined) {
  return (SOCIAL_CHANNEL_TYPES as readonly string[]).includes(type ?? "");
}

export function isWidgetChannel(type: string | null | undefined) {
  return type === "web_widget";
}

export function channelStubAlert(type: string | null | undefined) {
  if (type === "web_widget") {
    return "Widget first-party: mensagens entram no desk CRM. Status máximo ready_stub (sem provedor externo “live”).";
  }
  if (type === "api") {
    return "Canal API in-process com token Bearer. Sem HTTP de provedor externo; status máximo ready_stub.";
  }
  if (type === "email") {
    return "Credenciais IMAP/SMTP ou OAuth são salvas e mascaradas. Envio real SMTP não está habilitado — só stub/outbox.";
  }
  if (type === "sms") {
    return "Credenciais Twilio/Bandwidth ficam em stub. Sem envio real de SMS nesta fase.";
  }
  if (isSocialChannel(type)) {
    return "Credenciais sociais ficam em stub (ready_stub). Sem Meta Graph, Telegram Bot API ou outros HTTP de provedor.";
  }
  return "Envio e recebimento reais aguardam integração aprovada. Você pode salvar credenciais e simular mensagens.";
}

export function defaultPreChatFields(): PreChatField[] {
  return [
    { name: "nome", type: "text", label_pt: "Nome", required: true },
    { name: "email", type: "email", label_pt: "E-mail", required: false },
    { name: "empresa", type: "text", label_pt: "Empresa", required: false },
  ];
}

/** Prefer Phase D `/caixas`; fall back to Phase A `/inboxes` while backend D lands. */
export async function listCaixas(): Promise<PageDto<CrmInboxDto>> {
  try {
    return asPage<CrmInboxDto>(await apiGet(CAIXAS_API));
  } catch {
    return asPage<CrmInboxDto>(await apiGet(INBOXES_API));
  }
}

export async function getCaixa(id: string): Promise<CrmInboxDto> {
  try {
    return await apiGet<CrmInboxDto>(`${CAIXAS_API}/${id}`);
  } catch {
    return await apiGet<CrmInboxDto>(`${INBOXES_API}/${id}`);
  }
}

export async function patchCaixa(id: string, body: Record<string, unknown>) {
  try {
    return await apiSend<CrmInboxDto>(`${CAIXAS_API}/${id}`, "PATCH", body);
  } catch {
    return await apiSend<CrmInboxDto>(`${INBOXES_API}/${id}`, "PATCH", body);
  }
}

export async function createCaixa(body: { name: string; channel_type: ChannelTypeD }) {
  return apiSend<CrmInboxDto>(CAIXAS_API, "POST", body);
}

export async function getCanal(id: string): Promise<CrmCanalDto | null> {
  try {
    return await apiGet<CrmCanalDto>(`${CAIXAS_API}/${id}/canal`);
  } catch {
    try {
      const legacy = await apiGet<{
        inbox_id: string;
        provider?: string;
        phone_e164_display?: string | null;
        phone_number_id?: string | null;
        business_account_id?: string | null;
        secrets_present?: boolean;
        connection_status: string;
      }>(`${INBOXES_API}/${id}/channel`);
      return {
        ...legacy,
        channel_type: "whatsapp",
      };
    } catch {
      return null;
    }
  }
}

export async function putCanal(id: string, body: Record<string, unknown>) {
  try {
    return await apiSend<CrmCanalDto>(`${CAIXAS_API}/${id}/canal`, "PUT", body);
  } catch {
    return await apiSend<CrmCanalDto>(`${INBOXES_API}/${id}/channel`, "PUT", body);
  }
}

export async function rotateCanalToken(id: string) {
  return apiSend<{ token: string; website_token?: string; api_access_token?: string }>(
    `${CAIXAS_API}/${id}/canal/rotacionar-token`,
    "POST",
  );
}

export async function simulateCanal(id: string, body: Record<string, unknown>) {
  try {
    return await apiSend(`${CAIXAS_API}/${id}/canal/simular`, "POST", body);
  } catch {
    return await apiSend("/api/saas/crm/simular", "POST", { inbox_id: id, ...body });
  }
}

export async function getWidgetConfig(id: string) {
  return apiGet<CrmWidgetConfigDto>(`${CAIXAS_API}/${id}/widget`);
}

export async function putWidgetConfig(id: string, body: Record<string, unknown>) {
  return apiSend<CrmWidgetConfigDto>(`${CAIXAS_API}/${id}/widget`, "PUT", body);
}

export async function getWidgetSnippet(id: string) {
  return apiGet<CrmWidgetSnippetDto>(`${CAIXAS_API}/${id}/widget/snippet`);
}

export async function listModelosEmail() {
  return asPage<CrmEmailTemplateDto>(await apiGet("/api/saas/crm/modelos-email"));
}

export async function createModeloEmail(body: Record<string, unknown>) {
  return apiSend<CrmEmailTemplateDto>("/api/saas/crm/modelos-email", "POST", body);
}

export async function patchModeloEmail(id: string, body: Record<string, unknown>) {
  return apiSend<CrmEmailTemplateDto>(`/api/saas/crm/modelos-email/${id}`, "PATCH", body);
}

export async function deleteModeloEmail(id: string) {
  return apiSend(`/api/saas/crm/modelos-email/${id}`, "DELETE");
}
