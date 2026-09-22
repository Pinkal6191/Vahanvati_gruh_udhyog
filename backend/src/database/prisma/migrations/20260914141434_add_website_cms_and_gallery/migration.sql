-- CreateEnum safely if not exists
DO $$ BEGIN
    CREATE TYPE "GalleryMediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable company_settings (safe if columns already exist)
ALTER TABLE "company_settings" 
ADD COLUMN IF NOT EXISTS "business_hours" VARCHAR(150) DEFAULT 'Monday - Sunday: 9:00 AM - 8:00 PM',
ADD COLUMN IF NOT EXISTS "email" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "google_maps_url" TEXT,
ADD COLUMN IF NOT EXISTS "instagram_url" VARCHAR(255) DEFAULT 'https://www.instagram.com/vahanvatigruhudhyog/',
ADD COLUMN IF NOT EXISTS "youtube_url" VARCHAR(255) DEFAULT 'https://www.youtube.com/watch?v=FrB9KyMpOxQ';

-- AlterTable products (safe if columns already exist)
ALTER TABLE "products" 
ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_website_visible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable gallery_items safely if not exists
CREATE TABLE IF NOT EXISTS "gallery_items" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150),
    "caption" TEXT,
    "media_type" "GalleryMediaType" NOT NULL DEFAULT 'IMAGE',
    "media_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable website_contents safely if not exists
CREATE TABLE IF NOT EXISTS "website_contents" (
    "id" UUID NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "website_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex safely if not exists
CREATE INDEX IF NOT EXISTS "gallery_items_is_visible_display_order_idx" ON "gallery_items"("is_visible", "display_order");

-- CreateIndex safely if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "website_contents_section_key" ON "website_contents"("section");
