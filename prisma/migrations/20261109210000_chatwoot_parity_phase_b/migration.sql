-- Chatwoot-parity Phase B — operator power tables + columns

-- AlterTable tenants
ALTER TABLE "tenants" ADD COLUMN "webhook_signing_secret" TEXT;

-- AlterTable contacts
ALTER TABLE "contacts" ADD COLUMN "custom_attributes_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "contacts" ADD COLUMN "merged_into_id" TEXT;

-- AlterTable inboxes
ALTER TABLE "inboxes" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable conversations
ALTER TABLE "conversations" ADD COLUMN "custom_attributes_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "conversations" ADD COLUMN "bot_agent_bot_id" TEXT;
ALTER TABLE "conversations" ADD COLUMN "csat_token" TEXT;
ALTER TABLE "conversations" ADD COLUMN "csat_sent_at" DATETIME;

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_name" TEXT NOT NULL,
    "conditions_json" TEXT NOT NULL DEFAULT '{"operator":"and","values":[]}',
    "actions_json" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "automation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "macros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actions_json" TEXT NOT NULL DEFAULT '[]',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "owner_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "macros_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "macros_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_attribute_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "attribute_model" TEXT NOT NULL,
    "attribute_display_type" TEXT NOT NULL,
    "attribute_key" TEXT NOT NULL,
    "attribute_display_name" TEXT NOT NULL,
    "default_value_json" TEXT,
    "attribute_values_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_attribute_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_bots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "outgoing_url" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agent_bots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_bot_inboxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "agent_bot_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_bot_inboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_bot_inboxes_agent_bot_id_fkey" FOREIGN KEY ("agent_bot_id") REFERENCES "agent_bots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_bot_inboxes_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "subscriptions_json" TEXT NOT NULL DEFAULT '[]',
    "inbox_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "webhooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "webhooks_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "closed_all_day" BOOLEAN NOT NULL DEFAULT false,
    "open_all_day" BOOLEAN NOT NULL DEFAULT false,
    "open_hour" INTEGER,
    "open_minutes" INTEGER,
    "close_hour" INTEGER,
    "close_minutes" INTEGER,
    CONSTRAINT "working_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "working_hours_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignment_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'round_robin',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_assigned_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assignment_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_policies_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assignment_policies_last_assigned_user_id_fkey" FOREIGN KEY ("last_assigned_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "csat_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback_message" TEXT,
    "assigned_agent_id" TEXT,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "csat_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "csat_responses_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "csat_responses_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "csat_responses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "csat_responses_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_filters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filter_type" TEXT NOT NULL,
    "query_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "custom_filters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "custom_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_import_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "stats_json" TEXT NOT NULL DEFAULT '{}',
    "csv_text" TEXT,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contact_import_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_import_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "contacts_tenant_id_merged_into_id_idx" ON "contacts"("tenant_id", "merged_into_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_csat_token_key" ON "conversations"("csat_token");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_bot_agent_bot_id_idx" ON "conversations"("tenant_id", "bot_agent_bot_id");

-- CreateIndex
CREATE INDEX "automation_rules_tenant_id_active_event_name_idx" ON "automation_rules"("tenant_id", "active", "event_name");

-- CreateIndex
CREATE INDEX "macros_tenant_id_visibility_idx" ON "macros"("tenant_id", "visibility");

-- CreateIndex
CREATE INDEX "macros_tenant_id_owner_user_id_idx" ON "macros"("tenant_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_attribute_definitions_tenant_id_attribute_model_attribute_key_key" ON "custom_attribute_definitions"("tenant_id", "attribute_model", "attribute_key");

-- CreateIndex
CREATE INDEX "custom_attribute_definitions_tenant_id_attribute_model_idx" ON "custom_attribute_definitions"("tenant_id", "attribute_model");

-- CreateIndex
CREATE INDEX "agent_bots_tenant_id_active_idx" ON "agent_bots"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_bot_inboxes_inbox_id_key" ON "agent_bot_inboxes"("inbox_id");

-- CreateIndex
CREATE INDEX "agent_bot_inboxes_tenant_id_agent_bot_id_idx" ON "agent_bot_inboxes"("tenant_id", "agent_bot_id");

-- CreateIndex
CREATE INDEX "webhooks_tenant_id_active_idx" ON "webhooks"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "webhooks_tenant_id_inbox_id_idx" ON "webhooks"("tenant_id", "inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_inbox_id_day_of_week_key" ON "working_hours"("inbox_id", "day_of_week");

-- CreateIndex
CREATE INDEX "working_hours_tenant_id_inbox_id_idx" ON "working_hours"("tenant_id", "inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_policies_inbox_id_key" ON "assignment_policies"("inbox_id");

-- CreateIndex
CREATE INDEX "assignment_policies_tenant_id_idx" ON "assignment_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "csat_responses_conversation_id_key" ON "csat_responses"("conversation_id");

-- CreateIndex
CREATE INDEX "csat_responses_tenant_id_inbox_id_idx" ON "csat_responses"("tenant_id", "inbox_id");

-- CreateIndex
CREATE INDEX "csat_responses_tenant_id_rating_idx" ON "csat_responses"("tenant_id", "rating");

-- CreateIndex
CREATE INDEX "custom_filters_tenant_id_user_id_filter_type_idx" ON "custom_filters"("tenant_id", "user_id", "filter_type");

-- CreateIndex
CREATE INDEX "contact_import_batches_tenant_id_status_idx" ON "contact_import_batches"("tenant_id", "status");
