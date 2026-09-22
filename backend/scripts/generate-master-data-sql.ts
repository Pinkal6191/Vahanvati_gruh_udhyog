import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function escapeSqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function formatSqlTimestamp(val: Date | string | null | undefined): string {
  if (!val) return 'NULL';
  const d = new Date(val);
  return `'${d.toISOString()}'::timestamptz`;
}

function formatSqlDecimal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  return val.toString();
}

function formatSqlBoolean(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  return val ? 'TRUE' : 'FALSE';
}

function formatSqlJson(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

async function main() {
  console.log('🔄 Fetching real local master data from local PostgreSQL database...');

  // 1. Core Master Data
  const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } });
  const categories = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
  const subcategories = await prisma.subcategory.findMany({ orderBy: { displayOrder: 'asc' } });
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  const packConfigs = await prisma.productPackConfiguration.findMany({ orderBy: [{ productId: 'asc' }, { displayOrder: 'asc' }] });
  const productPrices = await prisma.productPrice.findMany({ orderBy: [{ productId: 'asc' }, { customerType: 'asc' }] });

  // 2. Setting & Website Data
  const companySettings = await prisma.companySettings.findMany();
  const websiteContents = await prisma.websiteContent.findMany({ orderBy: { section: 'asc' } });
  const galleryItems = await prisma.galleryItem.findMany({ orderBy: { displayOrder: 'asc' } });

  console.log(`✅ Loaded from local DB:`);
  console.log(`   - units: ${units.length}`);
  console.log(`   - categories: ${categories.length}`);
  console.log(`   - subcategories: ${subcategories.length}`);
  console.log(`   - products: ${products.length}`);
  console.log(`   - product_pack_configurations: ${packConfigs.length}`);
  console.log(`   - product_prices: ${productPrices.length}`);
  console.log(`   - company_settings: ${companySettings.length}`);
  console.log(`   - website_contents: ${websiteContents.length}`);
  console.log(`   - gallery_items: ${galleryItems.length}`);

  // Validation
  const unitIds = new Set(units.map(u => u.id));
  const catIds = new Set(categories.map(c => c.id));
  const subcatIds = new Set(subcategories.map(s => s.id));
  const prodIds = new Set(products.map(p => p.id));
  const packIds = new Set(packConfigs.map(pc => pc.id));
  const prodCodes = new Set<string>();

  for (const s of subcategories) {
    if (!catIds.has(s.categoryId)) throw new Error(`Subcategory ${s.id} references non-existent category ${s.categoryId}`);
  }

  for (const p of products) {
    if (!subcatIds.has(p.subcategoryId)) throw new Error(`Product ${p.id} references non-existent subcategory ${p.subcategoryId}`);
    if (!unitIds.has(p.primaryUnitId)) throw new Error(`Product ${p.id} references non-existent unit ${p.primaryUnitId}`);
    if (prodCodes.has(p.code)) throw new Error(`Duplicate product code: ${p.code}`);
    prodCodes.add(p.code);
  }

  for (const pc of packConfigs) {
    if (!prodIds.has(pc.productId)) throw new Error(`Pack config ${pc.id} references non-existent product ${pc.productId}`);
    if (!unitIds.has(pc.unitId)) throw new Error(`Pack config ${pc.id} references non-existent unit ${pc.unitId}`);
  }

  for (const pr of productPrices) {
    if (!prodIds.has(pr.productId)) throw new Error(`Product price ${pr.id} references non-existent product ${pr.productId}`);
    if (pr.packConfigId && !packIds.has(pr.packConfigId)) {
      throw new Error(`Product price ${pr.id} references non-existent pack config ${pr.packConfigId}`);
    }
  }

  console.log('✅ All internal foreign key constraints and uniqueness rules validated successfully.');

  // Generate SQL
  const lines: string[] = [];

  lines.push('-- ====================================================================');
  lines.push('-- Vahanvati Gruh Udhyog — Production Master Data Export');
  lines.push(`-- Generated At: ${new Date().toISOString()}`);
  lines.push('-- Source Database: local PostgreSQL (vahanvati_db)');
  lines.push('-- Purpose: Safely populate empty production master tables');
  lines.push('-- Features:');
  lines.push('--   - Preserves original UUIDs and foreign key relationships');
  lines.push('--   - Deterministic and idempotent (ON CONFLICT DO UPDATE)');
  lines.push('--   - No destructive commands (NO DROP, NO TRUNCATE, NO DELETE)');
  lines.push('--   - No transaction/customer/test records included');
  lines.push('--   - No secrets, credentials, or users included');
  lines.push('-- ====================================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // 1. UNITS
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 1. UNITS (${units.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const u of units) {
    lines.push(
      `INSERT INTO "units" ("id", "name", "symbol", "is_weight_based", "conversion_factor_to_base", "is_active", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(u.id)}, ${escapeSqlString(u.name)}, ${escapeSqlString(u.symbol)}, ${formatSqlBoolean(u.isWeightBased)}, ${formatSqlDecimal(u.conversionFactorToBase)}, ${formatSqlBoolean(u.isActive)}, ${formatSqlTimestamp(u.createdAt)}, ${formatSqlTimestamp(u.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"name" = EXCLUDED."name", "symbol" = EXCLUDED."symbol", "is_weight_based" = EXCLUDED."is_weight_based", "conversion_factor_to_base" = EXCLUDED."conversion_factor_to_base", "is_active" = EXCLUDED."is_active", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 2. CATEGORIES
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 2. CATEGORIES (${categories.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const c of categories) {
    lines.push(
      `INSERT INTO "categories" ("id", "name", "code", "display_order", "is_active", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(c.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.code)}, ${c.displayOrder}, ${formatSqlBoolean(c.isActive)}, ${formatSqlTimestamp(c.createdAt)}, ${formatSqlTimestamp(c.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"name" = EXCLUDED."name", "code" = EXCLUDED."code", "display_order" = EXCLUDED."display_order", "is_active" = EXCLUDED."is_active", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 3. SUBCATEGORIES
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 3. SUBCATEGORIES (${subcategories.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const s of subcategories) {
    lines.push(
      `INSERT INTO "subcategories" ("id", "category_id", "name", "code", "display_order", "is_active", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(s.id)}, ${escapeSqlString(s.categoryId)}, ${escapeSqlString(s.name)}, ${escapeSqlString(s.code)}, ${s.displayOrder}, ${formatSqlBoolean(s.isActive)}, ${formatSqlTimestamp(s.createdAt)}, ${formatSqlTimestamp(s.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"category_id" = EXCLUDED."category_id", "name" = EXCLUDED."name", "code" = EXCLUDED."code", "display_order" = EXCLUDED."display_order", "is_active" = EXCLUDED."is_active", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 4. PRODUCTS
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 4. PRODUCTS (${products.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const p of products) {
    lines.push(
      `INSERT INTO "products" ("id", "subcategory_id", "primary_unit_id", "name", "gujarati_name", "code", "barcode", "description", "image_url", "is_loose_weight_allowed", "is_website_visible", "is_featured", "is_active", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(p.id)}, ${escapeSqlString(p.subcategoryId)}, ${escapeSqlString(p.primaryUnitId)}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.gujaratiName)}, ${escapeSqlString(p.code)}, ${escapeSqlString(p.barcode)}, ${escapeSqlString(p.description)}, ${escapeSqlString(p.imageUrl)}, ${formatSqlBoolean(p.isLooseWeightAllowed)}, ${formatSqlBoolean(p.isWebsiteVisible)}, ${formatSqlBoolean(p.isFeatured)}, ${formatSqlBoolean(p.isActive)}, ${formatSqlTimestamp(p.createdAt)}, ${formatSqlTimestamp(p.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"subcategory_id" = EXCLUDED."subcategory_id", "primary_unit_id" = EXCLUDED."primary_unit_id", "name" = EXCLUDED."name", "gujarati_name" = EXCLUDED."gujarati_name", "code" = EXCLUDED."code", "barcode" = EXCLUDED."barcode", "description" = EXCLUDED."description", "image_url" = EXCLUDED."image_url", "is_loose_weight_allowed" = EXCLUDED."is_loose_weight_allowed", "is_website_visible" = EXCLUDED."is_website_visible", "is_featured" = EXCLUDED."is_featured", "is_active" = EXCLUDED."is_active", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 5. PRODUCT PACK CONFIGURATIONS
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 5. PRODUCT PACK CONFIGURATIONS (${packConfigs.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const pc of packConfigs) {
    lines.push(
      `INSERT INTO "product_pack_configurations" ("id", "product_id", "pack_name", "weight_in_base_units", "unit_id", "display_order", "is_active") ` +
      `VALUES (${escapeSqlString(pc.id)}, ${escapeSqlString(pc.productId)}, ${escapeSqlString(pc.packName)}, ${formatSqlDecimal(pc.weightInBaseUnits)}, ${escapeSqlString(pc.unitId)}, ${pc.displayOrder}, ${formatSqlBoolean(pc.isActive)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"product_id" = EXCLUDED."product_id", "pack_name" = EXCLUDED."pack_name", "weight_in_base_units" = EXCLUDED."weight_in_base_units", "unit_id" = EXCLUDED."unit_id", "display_order" = EXCLUDED."display_order", "is_active" = EXCLUDED."is_active";`
    );
  }
  lines.push('');

  // 6. PRODUCT PRICES
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 6. PRODUCT PRICES (${productPrices.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const pr of productPrices) {
    lines.push(
      `INSERT INTO "product_prices" ("id", "product_id", "pack_config_id", "customer_type", "rate", "effective_from", "effective_to", "is_active", "created_by", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(pr.id)}, ${escapeSqlString(pr.productId)}, ${escapeSqlString(pr.packConfigId)}, ${escapeSqlString(pr.customerType)}::"CustomerType", ${formatSqlDecimal(pr.rate)}, ${formatSqlTimestamp(pr.effectiveFrom)}, ${formatSqlTimestamp(pr.effectiveTo)}, ${formatSqlBoolean(pr.isActive)}, ${escapeSqlString(pr.createdById)}, ${formatSqlTimestamp(pr.createdAt)}, ${formatSqlTimestamp(pr.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"product_id" = EXCLUDED."product_id", "pack_config_id" = EXCLUDED."pack_config_id", "customer_type" = EXCLUDED."customer_type", "rate" = EXCLUDED."rate", "effective_from" = EXCLUDED."effective_from", "effective_to" = EXCLUDED."effective_to", "is_active" = EXCLUDED."is_active", "created_by" = EXCLUDED."created_by", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 7. COMPANY SETTINGS (Padgol Store Location & FSSAI Details)
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 7. COMPANY SETTINGS (${companySettings.length} record)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const cs of companySettings) {
    lines.push(
      `INSERT INTO "company_settings" ("id", "company_name", "tagline", "address", "phone", "gstin", "fssai_license", "invoice_prefix", "invoice_footer_notes", "print_format", "allow_negative_stock", "email", "business_hours", "google_maps_url", "instagram_url", "youtube_url", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(cs.id)}, ${escapeSqlString(cs.companyName)}, ${escapeSqlString(cs.tagline)}, ${escapeSqlString(cs.address)}, ${escapeSqlString(cs.phone)}, ${escapeSqlString(cs.gstin)}, ${escapeSqlString(cs.fssaiLicense)}, ${escapeSqlString(cs.invoicePrefix)}, ${escapeSqlString(cs.invoiceFooterNotes)}, ${escapeSqlString(cs.printFormat)}, ${formatSqlBoolean(cs.allowNegativeStock)}, ${escapeSqlString(cs.email)}, ${escapeSqlString(cs.businessHours)}, ${escapeSqlString(cs.googleMapsUrl)}, ${escapeSqlString(cs.instagramUrl)}, ${escapeSqlString(cs.youtubeUrl)}, ${formatSqlTimestamp(cs.createdAt)}, ${formatSqlTimestamp(cs.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"company_name" = EXCLUDED."company_name", "tagline" = EXCLUDED."tagline", "address" = EXCLUDED."address", "phone" = EXCLUDED."phone", "gstin" = EXCLUDED."gstin", "fssai_license" = EXCLUDED."fssai_license", "invoice_prefix" = EXCLUDED."invoice_prefix", "invoice_footer_notes" = EXCLUDED."invoice_footer_notes", "print_format" = EXCLUDED."print_format", "allow_negative_stock" = EXCLUDED."allow_negative_stock", "email" = EXCLUDED."email", "business_hours" = EXCLUDED."business_hours", "google_maps_url" = EXCLUDED."google_maps_url", "instagram_url" = EXCLUDED."instagram_url", "youtube_url" = EXCLUDED."youtube_url", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  // 8. WEBSITE CONTENTS (Home & About Content)
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 8. WEBSITE CONTENTS (${websiteContents.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const wc of websiteContents) {
    lines.push(
      `INSERT INTO "website_contents" ("id", "section", "content", "updated_at", "updated_by") ` +
      `VALUES (${escapeSqlString(wc.id)}, ${escapeSqlString(wc.section)}, ${formatSqlJson(wc.content)}, ${formatSqlTimestamp(wc.updatedAt)}, ${escapeSqlString(wc.updatedBy)}) ` +
      `ON CONFLICT ("section") DO UPDATE SET ` +
      `"content" = EXCLUDED."content", "updated_at" = EXCLUDED."updated_at", "updated_by" = EXCLUDED."updated_by";`
    );
  }
  lines.push('');

  // 9. GALLERY ITEMS (Featured YouTube Videos & Photos)
  lines.push('-- --------------------------------------------------------------------');
  lines.push(`-- 9. GALLERY ITEMS (${galleryItems.length} records)`);
  lines.push('-- --------------------------------------------------------------------');
  for (const gi of galleryItems) {
    lines.push(
      `INSERT INTO "gallery_items" ("id", "title", "caption", "media_type", "media_url", "thumbnail_url", "display_order", "is_visible", "created_at", "updated_at") ` +
      `VALUES (${escapeSqlString(gi.id)}, ${escapeSqlString(gi.title)}, ${escapeSqlString(gi.caption)}, ${escapeSqlString(gi.mediaType)}::"GalleryMediaType", ${escapeSqlString(gi.mediaUrl)}, ${escapeSqlString(gi.thumbnailUrl)}, ${gi.displayOrder}, ${formatSqlBoolean(gi.isVisible)}, ${formatSqlTimestamp(gi.createdAt)}, ${formatSqlTimestamp(gi.updatedAt)}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      `"title" = EXCLUDED."title", "caption" = EXCLUDED."caption", "media_type" = EXCLUDED."media_type", "media_url" = EXCLUDED."media_url", "thumbnail_url" = EXCLUDED."thumbnail_url", "display_order" = EXCLUDED."display_order", "is_visible" = EXCLUDED."is_visible", "updated_at" = EXCLUDED."updated_at";`
    );
  }
  lines.push('');

  lines.push('COMMIT;');
  lines.push('');

  const sqlFilePath = path.resolve(process.cwd(), '../docs/production-master-data.sql');
  fs.writeFileSync(sqlFilePath, lines.join('\n'), 'utf-8');
  console.log(`✅ Production master data SQL written to: ${sqlFilePath}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
