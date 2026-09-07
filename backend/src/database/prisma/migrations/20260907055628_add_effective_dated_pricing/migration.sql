-- DropIndex
DROP INDEX "product_prices_product_id_pack_config_id_customer_type_key";

-- AlterTable
ALTER TABLE "product_prices" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effective_to" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "product_prices_product_id_customer_type_effective_from_idx" ON "product_prices"("product_id", "customer_type", "effective_from");

-- CreateIndex
CREATE INDEX "product_prices_product_id_pack_config_id_idx" ON "product_prices"("product_id", "pack_config_id");

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
