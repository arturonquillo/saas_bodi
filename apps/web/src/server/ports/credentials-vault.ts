import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ChannelCredentialsVaultPort } from "@saas-frota/shared";
import { env } from "../env";
import { ApiError } from "../http/respond";

type Envelope = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function keyBytes(): Buffer {
  const raw = env.credentialsEncryptionKey;
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new ApiError("validacao", "Chave de criptografia inválida.");
  }
  if (buf.length !== 32) {
    throw new ApiError("validacao", "CREDENTIALS_ENCRYPTION_KEY deve ter 32 bytes (base64).");
  }
  return buf;
}

export const channelCredentialsVault: ChannelCredentialsVaultPort = {
  async seal(secrets) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
    const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope: Envelope = {
      alg: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    return JSON.stringify(envelope);
  },

  async open(ciphertext) {
    const envelope = JSON.parse(ciphertext) as Envelope;
    if (envelope.alg !== "aes-256-gcm") {
      throw new ApiError("validacao", "Envelope de segredo não suportado.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyBytes(),
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString("utf8")) as Record<string, string>;
  },

  mask(secretsPresent) {
    return { secrets_present: secretsPresent };
  },
};
