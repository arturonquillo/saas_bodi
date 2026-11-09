import { createHmac, randomBytes } from "node:crypto";

export function signWebhookBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function webhookSignatureHeader(secret: string, rawBody: string): string {
  return `sha256=${signWebhookBody(secret, rawBody)}`;
}

export function newWebhookSigningSecret(): string {
  return randomBytes(32).toString("hex");
}
