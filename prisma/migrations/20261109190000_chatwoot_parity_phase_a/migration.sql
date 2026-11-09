-- DropIndex
DROP INDEX "whatsapp_messages_tenant_id_thread_id_created_at_idx";

-- DropIndex
DROP INDEX "whatsapp_threads_tenant_id_intent_idx";

-- DropIndex
DROP INDEX "whatsapp_threads_tenant_id_phone_e164_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "whatsapp_messages";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "whatsapp_threads";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "cnpj_digits" TEXT NOT NULL,
    "cnpj_last4" TEXT NOT NULL,
    "cnpj_registro_pendente" BOOLEAN NOT NULL DEFAULT false,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "phone_e164" TEXT,
    "company_id" TEXT,
    "cliente_id" TEXT,
    "cadastro_request_id" TEXT,
    "notas" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contacts_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contacts_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_inboxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_inboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_inboxes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_inboxes_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inboxes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_type" TEXT NOT NULL DEFAULT 'whatsapp',
    "greeting" TEXT,
    "ooo_message" TEXT,
    "csat_enabled" BOOLEAN NOT NULL DEFAULT false,
    "lock_to_single_conversation" BOOLEAN NOT NULL DEFAULT true,
    "allow_auto_assign" BOOLEAN NOT NULL DEFAULT false,
    "vendedor_see_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channel_whatsapp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whatsapp_cloud',
    "phone_e164_display" TEXT,
    "phone_number_id" TEXT,
    "business_account_id" TEXT,
    "secrets_ciphertext" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "message_templates_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_whatsapp_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_whatsapp_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbox_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_members_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT,
    "assignee_user_id" TEXT,
    "team_id" TEXT,
    "snoozed_until" DATETIME,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "cliente_id" TEXT,
    "cadastro_request_id" TEXT,
    "orcamento_id" TEXT,
    "last_activity_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "attachment_meta_json" TEXT,
    "sender_user_id" TEXT,
    "delivery_status" TEXT NOT NULL DEFAULT 'queued',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversation_drafts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_drafts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1F5C6B',
    "show_on_sidebar" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    CONSTRAINT "conversation_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_labels_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    CONSTRAINT "contact_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_labels_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "canned_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_notification_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned" BOOLEAN NOT NULL DEFAULT true,
    "unassigned_conversation" BOOLEAN NOT NULL DEFAULT true,
    "conversation_activity" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "agent_notification_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "conversation_id" TEXT,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_notifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_presences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "state" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agent_presences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_presences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_presences_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "domain_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "domain_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "run_after" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" DATETIME,
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "background_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cadastro_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "cnpj_digits" TEXT NOT NULL,
    "cnpj_last4" TEXT NOT NULL,
    "cnpj_registro_pendente" BOOLEAN NOT NULL DEFAULT false,
    "razao_social" TEXT NOT NULL,
    "contato_nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "motivo_recusa" TEXT,
    "source" TEXT NOT NULL,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "cliente_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cadastro_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cadastro_requests" ("cliente_id", "cnpj_digits", "cnpj_last4", "cnpj_registro_pendente", "contato_nome", "created_at", "email", "id", "motivo_recusa", "razao_social", "reviewed_by_user_id", "source", "status", "tenant_id", "updated_at", "whatsapp") SELECT "cliente_id", "cnpj_digits", "cnpj_last4", "cnpj_registro_pendente", "contato_nome", "created_at", "email", "id", "motivo_recusa", "razao_social", "reviewed_by_user_id", "source", "status", "tenant_id", "updated_at", "whatsapp" FROM "cadastro_requests";
DROP TABLE "cadastro_requests";
ALTER TABLE "new_cadastro_requests" RENAME TO "cadastro_requests";
CREATE INDEX "cadastro_requests_tenant_id_status_idx" ON "cadastro_requests"("tenant_id", "status");
CREATE INDEX "cadastro_requests_tenant_id_cnpj_digits_idx" ON "cadastro_requests"("tenant_id", "cnpj_digits");
CREATE TABLE "new_clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "company_id" TEXT,
    "primary_contact_id" TEXT,
    "cnpj_digits" TEXT NOT NULL,
    "cnpj_last4" TEXT NOT NULL,
    "cnpj_registro_pendente" BOOLEAN NOT NULL DEFAULT false,
    "razao_social" TEXT NOT NULL,
    "contato_nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aprovado',
    "cadastro_request_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clientes_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clientes" ("cadastro_request_id", "cnpj_digits", "cnpj_last4", "cnpj_registro_pendente", "contato_nome", "created_at", "email", "id", "razao_social", "status", "tenant_id", "user_id", "whatsapp") SELECT "cadastro_request_id", "cnpj_digits", "cnpj_last4", "cnpj_registro_pendente", "contato_nome", "created_at", "email", "id", "razao_social", "status", "tenant_id", "user_id", "whatsapp" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
CREATE UNIQUE INDEX "clientes_cadastro_request_id_key" ON "clientes"("cadastro_request_id");
CREATE INDEX "clientes_tenant_id_user_id_idx" ON "clientes"("tenant_id", "user_id");
CREATE UNIQUE INDEX "clientes_tenant_id_cnpj_digits_key" ON "clientes"("tenant_id", "cnpj_digits");
CREATE TABLE "new_notification_outbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_role" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'commerce',
    "campaign_id" TEXT,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "orcamento_id" TEXT,
    "pedido_id" TEXT,
    "venda_id" TEXT,
    "cadastro_request_id" TEXT,
    "conversation_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas_faturamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_notification_outbox" ("cadastro_request_id", "channel", "created_at", "id", "orcamento_id", "payload_json", "pedido_id", "recipient", "recipient_role", "status", "template_key", "tenant_id", "venda_id") SELECT "cadastro_request_id", "channel", "created_at", "id", "orcamento_id", "payload_json", "pedido_id", "recipient", "recipient_role", "status", "template_key", "tenant_id", "venda_id" FROM "notification_outbox";
DROP TABLE "notification_outbox";
ALTER TABLE "new_notification_outbox" RENAME TO "notification_outbox";
CREATE INDEX "notification_outbox_tenant_id_status_idx" ON "notification_outbox"("tenant_id", "status");
CREATE INDEX "notification_outbox_tenant_id_category_status_idx" ON "notification_outbox"("tenant_id", "category", "status");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "availability" TEXT NOT NULL DEFAULT 'offline',
    "signature" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("ativo", "created_at", "email", "id", "nome", "password_hash", "whatsapp") SELECT "ativo", "created_at", "email", "id", "nome", "password_hash", "whatsapp" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_cnpj_digits_key" ON "companies"("tenant_id", "cnpj_digits");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_phone_e164_idx" ON "contacts"("tenant_id", "phone_e164");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_email_idx" ON "contacts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_cliente_id_idx" ON "contacts"("tenant_id", "cliente_id");

-- CreateIndex
CREATE INDEX "contact_inboxes_tenant_id_contact_id_idx" ON "contact_inboxes"("tenant_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_inboxes_tenant_id_inbox_id_source_id_key" ON "contact_inboxes"("tenant_id", "inbox_id", "source_id");

-- CreateIndex
CREATE INDEX "inboxes_tenant_id_channel_type_idx" ON "inboxes"("tenant_id", "channel_type");

-- CreateIndex
CREATE UNIQUE INDEX "channel_whatsapp_inbox_id_key" ON "channel_whatsapp"("inbox_id");

-- CreateIndex
CREATE INDEX "inbox_members_tenant_id_user_id_idx" ON "inbox_members"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_members_inbox_id_user_id_key" ON "inbox_members"("inbox_id", "user_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_status_last_activity_at_idx" ON "conversations"("tenant_id", "status", "last_activity_at");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_assignee_user_id_idx" ON "conversations"("tenant_id", "assignee_user_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_inbox_id_idx" ON "conversations"("tenant_id", "inbox_id");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_contact_id_idx" ON "conversations"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_conversation_id_created_at_idx" ON "messages"("tenant_id", "conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_drafts_conversation_id_user_id_key" ON "conversation_drafts"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_tenant_id_title_key" ON "labels"("tenant_id", "title");

-- CreateIndex
CREATE INDEX "conversation_labels_tenant_id_label_id_idx" ON "conversation_labels"("tenant_id", "label_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_labels_conversation_id_label_id_key" ON "conversation_labels"("conversation_id", "label_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_labels_contact_id_label_id_key" ON "contact_labels"("contact_id", "label_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenant_id_name_key" ON "teams"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "team_members_tenant_id_user_id_idx" ON "team_members"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_tenant_id_short_code_key" ON "canned_responses"("tenant_id", "short_code");

-- CreateIndex
CREATE UNIQUE INDEX "agent_notification_settings_user_id_key" ON "agent_notification_settings"("user_id");

-- CreateIndex
CREATE INDEX "agent_notification_settings_tenant_id_idx" ON "agent_notification_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_notifications_tenant_id_user_id_created_at_idx" ON "agent_notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_presences_tenant_id_conversation_id_expires_at_idx" ON "agent_presences"("tenant_id", "conversation_id", "expires_at");

-- CreateIndex
CREATE INDEX "agent_presences_tenant_id_user_id_idx" ON "agent_presences"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "domain_events_tenant_id_created_at_idx" ON "domain_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "domain_events_tenant_id_aggregate_type_aggregate_id_idx" ON "domain_events"("tenant_id", "aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "background_jobs_status_run_after_idx" ON "background_jobs"("status", "run_after");

-- CreateIndex
CREATE INDEX "background_jobs_tenant_id_kind_status_idx" ON "background_jobs"("tenant_id", "kind", "status");
