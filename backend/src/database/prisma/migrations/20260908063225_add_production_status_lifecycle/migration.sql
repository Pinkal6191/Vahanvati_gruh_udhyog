-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "production_entries" ADD COLUMN     "completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" "ProductionStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "production_entries_status_idx" ON "production_entries"("status");

-- CreateIndex
CREATE INDEX "production_entries_product_id_production_date_idx" ON "production_entries"("product_id", "production_date");
