import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function tokenDisplay(token: string): { prefix: string; last4: string } {
  const prefix = token.slice(0, 8);
  const last4 = token.slice(-4);
  return { prefix, last4 };
}
