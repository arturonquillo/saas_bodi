-- Chatwoot-parity Phase D — omnichannel stubs + Loja widget + email templates + push

-- CreateTable
CREATE TABLE "channel_website_widgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "website_token" TEXT NOT NULL,
    "hmac_secret_ciphertext" TEXT,
    "allowed_origins_json" TEXT NOT NULL DEFAULT '[]',
    "pre_chat_fields_json" TEXT NOT NULL DEFAULT '[]',
    "welcome_title" TEXT,
    "widget_color" TEXT,
    "continuity" TEXT NOT NULL DEFAULT 'session',
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_website_widgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_website_widgets_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "widget_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "website_token" TEXT NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "contact_id" TEXT,
    "conversation_id" TEXT,
    "pre_chat_json" TEXT,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "widget_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "widget_sessions_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subject_template" TEXT NOT NULL,
    "body_html_template" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channel_email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'smtp_imap',
    "forward_to_email" TEXT,
    "from_email_display" TEXT,
    "secrets_ciphertext" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "email_template_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_email_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_email_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_email_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channel_social" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_page_or_bot_id" TEXT,
    "secrets_ciphertext" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_social_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_social_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channel_sms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "from_number_display" TEXT,
    "secrets_ciphertext" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_sms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_sms_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channel_api" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "api_access_token_hash" TEXT,
    "token_prefix" TEXT,
    "token_last4" TEXT,
    "callback_url" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'not_configured',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "channel_api_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channel_api_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_website_widgets_inbox_id_key" ON "channel_website_widgets"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_website_widgets_website_token_key" ON "channel_website_widgets"("website_token");

-- CreateIndex
CREATE UNIQUE INDEX "widget_sessions_tenant_id_session_token_hash_key" ON "widget_sessions"("tenant_id", "session_token_hash");

-- CreateIndex
CREATE INDEX "widget_sessions_inbox_id_contact_id_idx" ON "widget_sessions"("inbox_id", "contact_id");

-- CreateIndex
CREATE INDEX "widget_sessions_website_token_idx" ON "widget_sessions"("website_token");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenant_id_slug_key" ON "email_templates"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "channel_email_inbox_id_key" ON "channel_email"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_social_inbox_id_key" ON "channel_social"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_sms_inbox_id_key" ON "channel_sms"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_api_inbox_id_key" ON "channel_api"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_api_api_access_token_hash_key" ON "channel_api"("api_access_token_hash");

-- CreateIndex
CREATE INDEX "channel_api_tenant_id_idx" ON "channel_api"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_tenant_id_user_id_endpoint_key" ON "push_subscriptions"("tenant_id", "user_id", "endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_user_id_idx" ON "push_subscriptions"("tenant_id", "user_id");
