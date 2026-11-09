-- Chatwoot-parity Phase C — campaigns, help center, reports (schema only for reports)

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inbox_id" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "audience_label_ids_json" TEXT NOT NULL DEFAULT '[]',
    "template_key" TEXT,
    "message" TEXT,
    "scheduled_at" DATETIME,
    "display_status" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_by_user_id" TEXT NOT NULL,
    "stats_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "outbox_id" TEXT,
    "error" TEXT,
    CONSTRAINT "campaign_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "header_text" TEXT,
    "homepage_md" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "custom_domain" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "portals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "help_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "portal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "parent_category_id" TEXT,
    CONSTRAINT "help_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "help_categories_portal_id_fkey" FOREIGN KEY ("portal_id") REFERENCES "portals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "help_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "help_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "portal_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content_md" TEXT NOT NULL,
    "content_html" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "author_user_id" TEXT NOT NULL,
    "published_at" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "articles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "articles_portal_id_fkey" FOREIGN KEY ("portal_id") REFERENCES "portals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "help_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "articles_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_status_idx" ON "campaigns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_kind_idx" ON "campaigns"("tenant_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_contact_id_key" ON "campaign_recipients"("campaign_id", "contact_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_tenant_id_campaign_id_status_idx" ON "campaign_recipients"("tenant_id", "campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "portals_tenant_id_slug_key" ON "portals"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "portals_tenant_id_enabled_idx" ON "portals"("tenant_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "help_categories_portal_id_slug_key" ON "help_categories"("portal_id", "slug");

-- CreateIndex
CREATE INDEX "help_categories_tenant_id_portal_id_idx" ON "help_categories"("tenant_id", "portal_id");

-- CreateIndex
CREATE UNIQUE INDEX "articles_portal_id_slug_key" ON "articles"("portal_id", "slug");

-- CreateIndex
CREATE INDEX "articles_portal_id_status_idx" ON "articles"("portal_id", "status");

-- CreateIndex
CREATE INDEX "articles_tenant_id_category_id_idx" ON "articles"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "notification_outbox_tenant_id_campaign_id_idx" ON "notification_outbox"("tenant_id", "campaign_id");
