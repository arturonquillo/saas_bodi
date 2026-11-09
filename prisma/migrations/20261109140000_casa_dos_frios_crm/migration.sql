-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "cnpj_digits" TEXT NOT NULL,
    "cnpj_last4" TEXT NOT NULL,
    "whatsapp_comercial" TEXT,
    "canais_aviso" TEXT NOT NULL DEFAULT 'whatsapp',
    "loja_modo" TEXT NOT NULL DEFAULT 'pedido_direto',
    "default_vendedor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "themes" (
    "tenant_id" TEXT NOT NULL PRIMARY KEY,
    "marca" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "logo_url" TEXT,
    CONSTRAINT "themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "saas_role" TEXT,
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cadastro_requests" (
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
    "thread_id" TEXT,
    "cliente_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cadastro_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "whatsapp_threads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cadastro_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
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
    CONSTRAINT "clientes_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "intent" TEXT,
    "cliente_id" TEXT,
    "cadastro_request_id" TEXT,
    "orcamento_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_threads_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_threads_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_threads_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "whatsapp_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "cadastro_request_id" TEXT,
    "vendedor_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "valido_ate" DATETIME,
    "channel" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orcamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orcamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orcamentos_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orcamentos_vendedor_user_id_fkey" FOREIGN KEY ("vendedor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orcamento_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "codigo_snapshot" TEXT NOT NULL,
    "nome_snapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_centavos" INTEGER NOT NULL,
    "notas" TEXT,
    CONSTRAINT "orcamento_lines_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orcamento_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orcamento_status_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orcamento_status_histories_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orcamento_status_histories_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedidos_venda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vendedor_user_id" TEXT NOT NULL,
    "orcamento_id" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pedidos_venda_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedidos_venda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_venda_vendedor_user_id_fkey" FOREIGN KEY ("vendedor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_venda_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedido_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "codigo_snapshot" TEXT NOT NULL,
    "nome_snapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_centavos" INTEGER NOT NULL,
    CONSTRAINT "pedido_lines_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedido_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedido_status_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedido_status_histories_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedido_status_histories_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vendas_faturamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vendas_faturamento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vendas_faturamento_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vendas_faturamento_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "venda_status_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "venda_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "venda_status_histories_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas_faturamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "venda_status_histories_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco_atacado_centavos" INTEGER NOT NULL,
    "qtd_min_atacado" INTEGER NOT NULL DEFAULT 1,
    "visivel_loja" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "skus_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "sku_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "inventory_balances_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "type" TEXT NOT NULL,
    "delta_on_hand" INTEGER NOT NULL,
    "delta_reserved" INTEGER NOT NULL,
    "reason" TEXT,
    "actor_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_role" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "orcamento_id" TEXT,
    "pedido_id" TEXT,
    "venda_id" TEXT,
    "cadastro_request_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas_faturamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notification_outbox_cadastro_request_id_fkey" FOREIGN KEY ("cadastro_request_id") REFERENCES "cadastro_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_saas_role_idx" ON "memberships"("tenant_id", "saas_role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "cadastro_requests_tenant_id_status_idx" ON "cadastro_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "cadastro_requests_tenant_id_cnpj_digits_idx" ON "cadastro_requests"("tenant_id", "cnpj_digits");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cadastro_request_id_key" ON "clientes"("cadastro_request_id");

-- CreateIndex
CREATE INDEX "clientes_tenant_id_user_id_idx" ON "clientes"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenant_id_cnpj_digits_key" ON "clientes"("tenant_id", "cnpj_digits");

-- CreateIndex
CREATE INDEX "whatsapp_threads_tenant_id_phone_e164_idx" ON "whatsapp_threads"("tenant_id", "phone_e164");

-- CreateIndex
CREATE INDEX "whatsapp_threads_tenant_id_intent_idx" ON "whatsapp_threads"("tenant_id", "intent");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenant_id_thread_id_created_at_idx" ON "whatsapp_messages"("tenant_id", "thread_id", "created_at");

-- CreateIndex
CREATE INDEX "orcamentos_tenant_id_status_idx" ON "orcamentos"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orcamentos_tenant_id_cliente_id_idx" ON "orcamentos"("tenant_id", "cliente_id");

-- CreateIndex
CREATE INDEX "orcamento_lines_tenant_id_orcamento_id_idx" ON "orcamento_lines"("tenant_id", "orcamento_id");

-- CreateIndex
CREATE INDEX "orcamento_status_histories_tenant_id_orcamento_id_created_at_idx" ON "orcamento_status_histories"("tenant_id", "orcamento_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_venda_orcamento_id_key" ON "pedidos_venda"("orcamento_id");

-- CreateIndex
CREATE INDEX "pedidos_venda_tenant_id_status_idx" ON "pedidos_venda"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_venda_tenant_id_cliente_id_idx" ON "pedidos_venda"("tenant_id", "cliente_id");

-- CreateIndex
CREATE INDEX "pedido_lines_tenant_id_pedido_id_idx" ON "pedido_lines"("tenant_id", "pedido_id");

-- CreateIndex
CREATE INDEX "pedido_status_histories_tenant_id_pedido_id_created_at_idx" ON "pedido_status_histories"("tenant_id", "pedido_id", "created_at");

-- CreateIndex
CREATE INDEX "vendas_faturamento_tenant_id_status_idx" ON "vendas_faturamento"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "vendas_faturamento_tenant_id_pedido_id_idx" ON "vendas_faturamento"("tenant_id", "pedido_id");

-- CreateIndex
CREATE INDEX "venda_status_histories_tenant_id_venda_id_created_at_idx" ON "venda_status_histories"("tenant_id", "venda_id", "created_at");

-- CreateIndex
CREATE INDEX "skus_tenant_id_visivel_loja_idx" ON "skus"("tenant_id", "visivel_loja");

-- CreateIndex
CREATE UNIQUE INDEX "skus_tenant_id_codigo_key" ON "skus"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "inventory_balances_tenant_id_idx" ON "inventory_balances"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_sku_id_created_at_idx" ON "inventory_movements"("tenant_id", "sku_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_outbox_tenant_id_status_idx" ON "notification_outbox"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_user_id_idx" ON "sessions"("tenant_id", "user_id");

