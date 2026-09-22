import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function validateAndInspect() {
  console.log('=== VALIDATING MASTER DATA INTEGRITY ===\n');

  const categories = await prisma.category.findMany();
  const subcategories = await prisma.subcategory.findMany();
  const units = await prisma.unit.findMany();
  const products = await prisma.product.findMany();
  const packConfigs = await prisma.productPackConfiguration.findMany();
  const prices = await prisma.productPrice.findMany();

  const categoryIds = new Set(categories.map(c => c.id));
  const subcategoryIds = new Set(subcategories.map(s => s.id));
  const unitIds = new Set(units.map(u => u.id));
  const productIds = new Set(products.map(p => p.id));
  const packConfigIds = new Set(packConfigs.map(pc => pc.id));

  // Check subcategories -> category
  let subcatOrphans = 0;
  for (const s of subcategories) {
    if (!categoryIds.has(s.categoryId)) {
      console.error(`Orphan subcategory ${s.id} (${s.name}) references missing category ${s.categoryId}`);
      subcatOrphans++;
    }
  }

  // Check products -> subcategory, unit
  let productSubcatOrphans = 0;
  let productUnitOrphans = 0;
  const productCodes = new Set<string>();
  let duplicateProductCodes = 0;

  for (const p of products) {
    if (!subcategoryIds.has(p.subcategoryId)) {
      console.error(`Orphan product ${p.id} (${p.name}) references missing subcategory ${p.subcategoryId}`);
      productSubcatOrphans++;
    }
    if (!unitIds.has(p.primaryUnitId)) {
      console.error(`Orphan product ${p.id} (${p.name}) references missing unit ${p.primaryUnitId}`);
      productUnitOrphans++;
    }
    if (productCodes.has(p.code)) {
      console.error(`Duplicate product code: ${p.code}`);
      duplicateProductCodes++;
    }
    productCodes.add(p.code);
  }

  // Check pack configs -> product, unit
  let packProductOrphans = 0;
  let packUnitOrphans = 0;
  for (const pc of packConfigs) {
    if (!productIds.has(pc.productId)) {
      console.error(`Orphan pack config ${pc.id} references missing product ${pc.productId}`);
      packProductOrphans++;
    }
    if (!unitIds.has(pc.unitId)) {
      console.error(`Orphan pack config ${pc.id} references missing unit ${pc.unitId}`);
      packUnitOrphans++;
    }
  }

  // Check prices -> product, pack config
  let priceProductOrphans = 0;
  let pricePackOrphans = 0;
  for (const pr of prices) {
    if (!productIds.has(pr.productId)) {
      console.error(`Orphan price ${pr.id} references missing product ${pr.productId}`);
      priceProductOrphans++;
    }
    if (pr.packConfigId && !packConfigIds.has(pr.packConfigId)) {
      console.error(`Orphan price ${pr.id} references missing pack config ${pr.packConfigId}`);
      pricePackOrphans++;
    }
  }

  console.log('Validation results:');
  console.log(`- Subcategory orphan count: ${subcatOrphans}`);
  console.log(`- Product subcategory orphan count: ${productSubcatOrphans}`);
  console.log(`- Product unit orphan count: ${productUnitOrphans}`);
  console.log(`- Duplicate product codes: ${duplicateProductCodes}`);
  console.log(`- Pack config product orphan count: ${packProductOrphans}`);
  console.log(`- Pack config unit orphan count: ${packUnitOrphans}`);
  console.log(`- Price product orphan count: ${priceProductOrphans}`);
  console.log(`- Price pack config orphan count: ${pricePackOrphans}`);

  // Product visibility and featured counts
  const websiteVisibleCount = products.filter(p => p.isWebsiteVisible).length;
  const featuredCount = products.filter(p => p.isFeatured).length;
  const looseCount = products.filter(p => p.isLooseWeightAllowed).length;
  const withImageCount = products.filter(p => p.imageUrl).length;

  console.log(`\nProduct stats:`);
  console.log(`- Total products: ${products.length}`);
  console.log(`- Website visible products: ${websiteVisibleCount}`);
  console.log(`- Featured products: ${featuredCount}`);
  console.log(`- Loose weight allowed: ${looseCount}`);
  console.log(`- Products with image: ${withImageCount}`);

  // Check company settings and website content
  const companySettings = await prisma.companySettings.findFirst();
  console.log('\n--- COMPANY SETTINGS ---');
  console.log(companySettings ? JSON.stringify(companySettings, null, 2) : 'None');

  const websiteContents = await prisma.websiteContent.findMany();
  console.log('\n--- WEBSITE CONTENTS ---');
  console.log(websiteContents.map(w => ({ id: w.id, section: w.section, updatedAt: w.updatedAt })));

  const galleryItems = await prisma.galleryItem.findMany();
  console.log('\n--- GALLERY ITEMS ---');
  console.log(galleryItems.map(g => ({ id: g.id, title: g.title, mediaType: g.mediaType, mediaUrl: g.mediaUrl, isVisible: g.isVisible })));

  await prisma.$disconnect();
}

validateAndInspect().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
