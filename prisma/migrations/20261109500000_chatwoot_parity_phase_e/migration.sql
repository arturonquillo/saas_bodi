-- Chatwoot-parity Phase E — enterprise & AI

-- AlterTable tenants
ALTER TABLE "tenants" ADD COLUMN "mfa_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable memberships
ALTER TABLE "memberships" ADD COLUMN "custom_role_id" TEXT;

-- AlterTable inboxes
ALTER TABLE "inboxes" ADD COLUMN "default_sla_policy_id" TEXT;
ALTER TABLE "inboxes" ADD COLUMN "required_attribute_keys_on_resolve_json" TEXT NOT NULL DEFAULT '[]';

-- AlterTable conversations
ALTER TABLE "conversations" ADD COLUMN "sla_policy_id" TEXT;

-- AlterTable csat_responses
ALTER TABLE "csat_responses" ADD COLUMN "review_note" TEXT;
ALTER TABLE "csat_responses" ADD COLUMN "reviewed_by_user_id" TEXT;
ALTER TABLE "csat_responses" ADD COLUMN "reviewed_at" DATETIME;

-- AlterTable portals
ALTER TABLE "portals" ADD COLUMN "custom_domain_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "portals" ADD COLUMN "custom_domain_verification_token" TEXT;

-- CreateTable
CREATE TABLE "channel_voice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio_voice',
    "secrets_ciphertext" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_voice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_voice_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frt_seconds" INTEGER NOT NULL,
    "nrt_seconds" INTEGER NOT NULL,
    "rt_seconds" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sla_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_slas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "frt_due_at" DATETIME NOT NULL,
    "nrt_due_at" DATETIME,
    "rt_due_at" DATETIME NOT NULL,
    "frt_hit_at" DATETIME,
    "nrt_hit_at" DATETIME,
    "rt_hit_at" DATETIME,
    "frt_breached" BOOLEAN NOT NULL DEFAULT false,
    "nrt_breached" BOOLEAN NOT NULL DEFAULT false,
    "rt_breached" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversation_slas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_slas_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_slas_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_capacities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_open_conversations" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agent_capacities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_capacities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "captain_assistants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "system_prompt_stub" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "captain_assistants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "captain_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "assistant_id" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proposal_json" TEXT NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT 'agent',
    "actor_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "captain_suggestions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "captain_suggestions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "captain_suggestions_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "captain_assistants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "captain_suggestions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "captain_suggestions_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saml_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "idp_entity_id" TEXT,
    "idp_sso_url" TEXT,
    "idp_certificate_ciphertext" TEXT,
    "sp_entity_id" TEXT,
    "jit_provision" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "saml_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mfa_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recovery_codes_hash_json" TEXT NOT NULL DEFAULT '[]',
    "confirmed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mfa_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mfa_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_installs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "metadata_json" TEXT,
    "secrets_ciphertext" TEXT,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_installs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dashboard_apps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inbox_ids_json" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dashboard_apps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_voice_inbox_id_key" ON "channel_voice"("inbox_id");
CREATE INDEX "channel_voice_tenant_id_idx" ON "channel_voice"("tenant_id");
CREATE INDEX "sla_policies_tenant_id_active_idx" ON "sla_policies"("tenant_id", "active");
CREATE UNIQUE INDEX "conversation_slas_conversation_id_key" ON "conversation_slas"("conversation_id");
CREATE INDEX "conversation_slas_tenant_id_frt_due_at_idx" ON "conversation_slas"("tenant_id", "frt_due_at");
CREATE UNIQUE INDEX "agent_capacities_tenant_id_user_id_key" ON "agent_capacities"("tenant_id", "user_id");
CREATE INDEX "captain_assistants_tenant_id_active_idx" ON "captain_assistants"("tenant_id", "active");
CREATE INDEX "captain_suggestions_tenant_id_conversation_id_status_idx" ON "captain_suggestions"("tenant_id", "conversation_id", "status");
CREATE INDEX "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id", "created_at");
CREATE INDEX "audit_events_tenant_id_action_created_at_idx" ON "audit_events"("tenant_id", "action", "created_at");
CREATE UNIQUE INDEX "saml_configs_tenant_id_key" ON "saml_configs"("tenant_id");
CREATE UNIQUE INDEX "mfa_devices_tenant_id_user_id_key" ON "mfa_devices"("tenant_id", "user_id");
CREATE UNIQUE INDEX "custom_roles_tenant_id_name_key" ON "custom_roles"("tenant_id", "name");
CREATE UNIQUE INDEX "integration_installs_tenant_id_provider_key" ON "integration_installs"("tenant_id", "provider");
CREATE INDEX "dashboard_apps_tenant_id_enabled_idx" ON "dashboard_apps"("tenant_id", "enabled");
CREATE INDEX "memberships_tenant_id_custom_role_id_idx" ON "memberships"("tenant_id", "custom_role_id");
CREATE INDEX "inboxes_tenant_id_default_sla_policy_id_idx" ON "inboxes"("tenant_id", "default_sla_policy_id");
CREATE INDEX "conversations_tenant_id_sla_policy_id_idx" ON "conversations"("tenant_id", "sla_policy_id");
CREATE UNIQUE INDEX "portals_custom_domain_key" ON "portals"("custom_domain");
