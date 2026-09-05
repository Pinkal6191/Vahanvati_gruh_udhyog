-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "gstin" VARCHAR(50);

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
