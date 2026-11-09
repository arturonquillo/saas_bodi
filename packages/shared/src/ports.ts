export type CnpjRegistryResult =
  | { ok: true; razaoSocial: string }
  | { ok: false; reason: "not_found" | "unavailable" };

export type CnpjRegistryPort = {
  lookup: (cnpjDigits: string) => Promise<CnpjRegistryResult>;
};

export type OutboxChannel = "email" | "whatsapp";

export type OutboxTransportPort = {
  send: (row: {
    id: string;
    channel: OutboxChannel;
    recipient: string;
    templateKey: string;
    payload: unknown;
  }) => Promise<void>;
};

export type WhatsappInboxSimulatePort = {
  ingestInbound: (input: {
    tenantId: string;
    phoneE164: string;
    body: string;
    intentHint?: "cadastro" | "orcamento" | "info_empresa" | "outro";
  }) => Promise<{ threadId: string; messageId: string }>;
};
