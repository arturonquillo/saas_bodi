import type { CaptainMode, SystemIntentLabel } from "./crm";

export type CnpjRegistryResult =
  | { ok: true; razaoSocial: string }
  | { ok: false; reason: "not_found" | "unavailable" };

export type CnpjRegistryPort = {
  lookup: (cnpjDigits: string) => Promise<CnpjRegistryResult>;
};

export type OutboxChannel = "email" | "whatsapp" | "sms";

export type OutboxTransportPort = {
  send: (row: {
    id: string;
    channel: OutboxChannel;
    recipient: string;
    templateKey: string;
    payload: unknown;
  }) => Promise<void>;
};

/** Phase C — campaign blast via stub outbox only (no Meta/Twilio). */
export type CampaignSendPort = {
  enqueueBatch: (input: {
    tenantId: string;
    campaignId: string;
    cursor?: string;
    limit: number;
  }) => Promise<{ processed: number; done: boolean; nextCursor?: string }>;
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

/** Phase E — Captain AI (stub by default; live only with unlock + key). */
export type CaptainAiPort = {
  suggest: (input: {
    tenantId: string;
    conversationId: string;
    mode: CaptainMode;
    assistantId?: string;
    promptStub?: string;
  }) => Promise<{ proposal: unknown; provider: "stub" | "live" }>;
};

export type SamlAuthPort = {
  getSpMetadata: (tenantId: string) => Promise<string>;
  validateAssertion: (input: {
    tenantId: string;
    rawSamlResponse: string;
  }) => Promise<{ ok: true; nameId: string; email?: string } | { ok: false; reason: string }>;
};

export type MfaPort = {
  enroll: (userId: string) => Promise<{ secret: string; otpauthUri: string }>;
  verify: (userId: string, code: string) => Promise<boolean>;
  disable: (userId: string) => Promise<void>;
};

export type DnsVerifyPort = {
  verifyTxt: (input: {
    domain: string;
    expectedToken: string;
  }) => Promise<{ verified: boolean; skipped?: "no_provider" }>;
};

export type IntegrationConnectPort = {
  test: (input: {
    tenantId: string;
    provider: string;
  }) => Promise<{ ok: boolean; stub: true }>;
};
