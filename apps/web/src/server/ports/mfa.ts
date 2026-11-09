import { createHash, randomBytes } from "node:crypto";
import type { MfaPort } from "@saas-frota/shared";

/** In-memory pending enroll secrets for stub MFA (tests / local). */
const pendingSecrets = new Map<string, string>();

function base32(buf: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function hotp(secretAscii: string, counter: number) {
  // Deterministic stub verifier: accept code derived from secret + time step, or "000000" in VITEST.
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    if (arguments.length >= 0) {
      /* keep signature */
    }
  }
  const step = Math.floor(Date.now() / 30_000);
  const digest = createHash("sha1")
    .update(`${secretAscii}:${counter ?? step}`)
    .digest("hex");
  const num = parseInt(digest.slice(0, 6), 16) % 1_000_000;
  return String(num).padStart(6, "0");
}

export const mfaPort: MfaPort = {
  async enroll(userId) {
    const secret = base32(randomBytes(20));
    pendingSecrets.set(userId, secret);
    const otpauthUri = `otpauth://totp/CasaDosFrios:${encodeURIComponent(userId)}?secret=${secret}&issuer=CasaDosFrios`;
    return { secret, otpauthUri };
  },

  async verify(userId, code) {
    const secret = pendingSecrets.get(userId);
    if (!secret) return false;
    const trimmed = code.trim();
    if ((process.env.VITEST || process.env.NODE_ENV === "test") && trimmed === "000000") {
      return true;
    }
    const expected = hotp(secret, Math.floor(Date.now() / 30_000));
    return trimmed === expected;
  },

  async disable(userId) {
    pendingSecrets.delete(userId);
  },
};

/** Expose pending secret for domain layer to seal after confirm. */
export function peekPendingMfaSecret(userId: string) {
  return pendingSecrets.get(userId) ?? null;
}

export function clearPendingMfaSecret(userId: string) {
  pendingSecrets.delete(userId);
}

export function setPendingMfaSecret(userId: string, secret: string) {
  pendingSecrets.set(userId, secret);
}
