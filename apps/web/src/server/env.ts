import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

function findRepoRoot(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "prisma", "schema.prisma"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const repoRoot = findRepoRoot();

config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(process.cwd(), ".env") });

export const env = {
  // Absolute file URL so Next and Vitest share the same SQLite file.
  databaseUrl: `file://${path.join(repoRoot, "prisma", "dev.db")}`,
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-change-me-not-for-production",
  defaultTenantSlug: process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "casa-dos-frios",
  cnpjRegistryEnabled: process.env.CNPJ_REGISTRY_ENABLED === "true",
  /**
   * `simulate` = default stub send when channel is not `live`.
   * Channel `connection_status=live` always uses Meta Cloud HTTP for WA outbound.
   */
  whatsappInboxMode: process.env.WHATSAPP_INBOX_MODE ?? "simulate",
  /** base64 32-byte key — AES-256-GCM for WA channel secrets */
  credentialsEncryptionKey:
    process.env.CREDENTIALS_ENCRYPTION_KEY ??
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  /** Public origin for webhook URL hints in admin UI (e.g. https://test3.lecrunch.com.br) */
  publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.WEBHOOK_BASE_URL ?? "",
  /** Override Graph host in tests; production default is graph.facebook.com */
  metaGraphApiBaseUrl: process.env.META_GRAPH_API_BASE_URL ?? "",
  /** Optional Web Push VAPID — unset → push APIs 404 / jobs no-op */
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
};
