-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "sales_returns" ADD COLUMN     "cancellation_reason" VARCHAR(255),
ADD COLUMN     "completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" "ReturnStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "sales_returns_status_idx" ON "sales_returns"("status");

-- CreateIndex
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns"("customer_id");

-- CreateIndex
CREATE INDEX "sales_returns_created_at_idx" ON "sales_returns"("created_at");
