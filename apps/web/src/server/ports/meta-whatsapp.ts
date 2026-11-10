import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/** Meta Graph API version for Cloud API text send. */
export const META_GRAPH_VERSION = "v21.0";

export type MetaWhatsappSendInput = {
  accessToken: string;
  phoneNumberId: string;
  toE164: string;
  body: string;
  /** Client-side idempotency hint (our message id). */
  clientMessageId?: string;
};

export type MetaWhatsappSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string; status?: number };

export type MetaWhatsappHttpPort = {
  sendText: (input: MetaWhatsappSendInput) => Promise<MetaWhatsappSendResult>;
};

function digitsOnlyPhone(toE164: string): string {
  return toE164.replace(/\D/g, "");
}

function graphBase(): string {
  return (env.metaGraphApiBaseUrl || `https://graph.facebook.com/${META_GRAPH_VERSION}`).replace(
    /\/$/,
    "",
  );
}

/**
 * Validate Meta `X-Hub-Signature-256` header against raw body + App Secret.
 * Never log tokens or the raw secret.
 */
export function verifyMetaWebhookSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  if (!appSecret || !signatureHeader) return false;
  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  try {
    const a = Buffer.from(expectedHex, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function metaSignatureHeader(appSecret: string, rawBody: string): string {
  const hex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return `sha256=${hex}`;
}

type FetchLike = typeof fetch;

let fetchImpl: FetchLike = globalThis.fetch.bind(globalThis);

/** Test hook — inject mocked fetch (no unpaid network in CI). */
export function setMetaWhatsappFetch(fn: FetchLike | null) {
  fetchImpl = fn ?? globalThis.fetch.bind(globalThis);
}

export const metaWhatsappHttpPort: MetaWhatsappHttpPort = {
  async sendText(input) {
    const phoneNumberId = input.phoneNumberId.trim();
    const token = input.accessToken.trim();
    if (!phoneNumberId || !token) {
      return { ok: false, reason: "missing_credentials" };
    }
    const to = digitsOnlyPhone(input.toE164);
    if (!to) {
      return { ok: false, reason: "invalid_to" };
    }

    const url = `${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: input.body },
    };

    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json: { messages?: Array<{ id?: string }>; error?: { message?: string } } = {};
      try {
        json = text ? (JSON.parse(text) as typeof json) : {};
      } catch {
        // ignore parse — treat as opaque failure (do not log body; may contain PII)
      }
      if (!res.ok) {
        return {
          ok: false,
          reason: json.error?.message ? "provider_error" : `http_${res.status}`,
          status: res.status,
        };
      }
      const providerMessageId = json.messages?.[0]?.id;
      if (!providerMessageId) {
        return { ok: false, reason: "missing_provider_id", status: res.status };
      }
      return { ok: true, providerMessageId };
    } catch {
      return { ok: false, reason: "network_error" };
    }
  },
};
