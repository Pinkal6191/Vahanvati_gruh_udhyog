-- CreateEnum
CREATE TYPE "GalleryMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "business_hours" VARCHAR(150) DEFAULT 'Monday - Sunday: 9:00 AM - 8:00 PM',
ADD COLUMN     "email" VARCHAR(100),
ADD COLUMN     "google_maps_url" TEXT,
ADD COLUMN     "instagram_url" VARCHAR(255) DEFAULT 'https://www.instagram.com/vahanvatigruhudhyog/',
ADD COLUMN     "youtube_url" VARCHAR(255) DEFAULT 'https://www.youtube.com/watch?v=FrB9KyMpOxQ';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_website_visible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "gallery_items" (
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

-- CreateTable
CREATE TABLE "website_contents" (
    "id" UUID NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "website_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gallery_items_is_visible_display_order_idx" ON "gallery_items"("is_visible", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_contents_section_key" ON "website_contents"("section");
