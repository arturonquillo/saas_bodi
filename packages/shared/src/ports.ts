import type { SystemIntentLabel } from "./crm";

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

/** @deprecated Prefer ChannelSimulateInboundPort — kept for migration callers. */
export type WhatsappInboxSimulatePort = {
  ingestInbound: (input: {
    tenantId: string;
    phoneE164: string;
    body: string;
    intentHint?: "cadastro" | "orcamento" | "info_empresa" | "outro";
  }) => Promise<{ threadId: string; messageId: string }>;
};

export type ChannelSimulateInboundPort = {
  ingestInbound: (input: {
    tenantId: string;
    inboxId?: string;
    phoneE164: string;
    body: string;
    intentLabel?: SystemIntentLabel;
  }) => Promise<{ conversationId: string; messageId: string; contactId: string }>;
};

export type ChannelSendPort = {
  sendOutgoing: (input: {
    tenantId: string;
    inboxId: string;
    conversationId: string;
    messageId: string;
    toE164: string;
    body: string;
  }) => Promise<{ deliveryStatus: "queued" | "sent" | "failed" }>;
};

export type ChannelCredentialsVaultPort = {
  seal: (secrets: Record<string, string>) => Promise<string>;
  open: (ciphertext: string) => Promise<Record<string, string>>;
  mask: (secretsPresent: boolean) => { secrets_present: boolean };
};

export type JobEnqueuePort = {
  enqueue: (input: {
    tenantId: string;
    kind: string;
    payload: unknown;
    runAfter?: Date;
  }) => Promise<{ id: string }>;
};

export type JobWorkerPort = {
  tick: (limit?: number) => Promise<number>;
};

export type UrlEgressGuardPort = {
  assertSafeHttpsUrl: (url: string) => Promise<{ href: string; hostname: string }>;
};
