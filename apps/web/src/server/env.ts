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
  whatsappInboxMode: process.env.WHATSAPP_INBOX_MODE ?? "simulate",
};
