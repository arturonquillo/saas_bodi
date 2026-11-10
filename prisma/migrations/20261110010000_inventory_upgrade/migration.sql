-- Inventory / Estoque upgrade — SKU master fields + line discount snapshots
-- SQLite: ADD COLUMN only allows constant defaults (no CURRENT_TIMESTAMP).

-- AlterTable skus
ALTER TABLE "skus" ADD COLUMN "descricao" TEXT;
ALTER TABLE "skus" ADD COLUMN "unidade" TEXT NOT NULL DEFAULT 'un';
ALTER TABLE "skus" ADD COLUMN "desconto_max_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "skus" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "skus" ADD COLUMN "created_at" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE "skus" ADD COLUMN "updated_at" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

UPDATE "skus" SET "created_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "skus_tenant_id_ativo_visivel_loja_idx" ON "skus"("tenant_id", "ativo", "visivel_loja");

-- CreateIndex
CREATE INDEX "skus_tenant_id_nome_idx" ON "skus"("tenant_id", "nome");

-- AlterTable orcamento_lines
ALTER TABLE "orcamento_lines" ADD COLUMN "unidade_snapshot" TEXT;
ALTER TABLE "orcamento_lines" ADD COLUMN "preco_lista_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orcamento_lines" ADD COLUMN "desconto_pct" INTEGER NOT NULL DEFAULT 0;

UPDATE "orcamento_lines" SET "preco_lista_centavos" = "unit_price_centavos" WHERE "preco_lista_centavos" = 0;

-- AlterTable pedido_lines
ALTER TABLE "pedido_lines" ADD COLUMN "unidade_snapshot" TEXT;
ALTER TABLE "pedido_lines" ADD COLUMN "preco_lista_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pedido_lines" ADD COLUMN "desconto_pct" INTEGER NOT NULL DEFAULT 0;

UPDATE "pedido_lines" SET "preco_lista_centavos" = "unit_price_centavos" WHERE "preco_lista_centavos" = 0;
