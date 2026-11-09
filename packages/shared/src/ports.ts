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
