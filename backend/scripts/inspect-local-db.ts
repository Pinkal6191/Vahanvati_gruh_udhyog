import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('=== VAHANVATI LOCAL DATABASE INSPECTION ===\n');

  // Count core master data
  const categoriesCount = await prisma.category.count();
  const subcategoriesCount = await prisma.subcategory.count();
  const unitsCount = await prisma.unit.count();
  const productsCount = await prisma.product.count();
  const packConfigsCount = await prisma.productPackConfiguration.count();
  const productPricesCount = await prisma.productPrice.count();

  // Count related / setting tables
  const companySettingsCount = await prisma.companySettings.count();
  const websiteContentsCount = await prisma.websiteContent.count();
  const galleryItemsCount = await prisma.galleryItem.count();
  const usersCount = await prisma.user.count();
  const customersCount = await prisma.customer.count();

  // Count transactional / inventory tables
  const stocksCount = await prisma.stock.count();
  const stockMovementsCount = await prisma.stockMovement.count();
  const salesCount = await prisma.sale.count();
  const saleItemsCount = await prisma.saleItem.count();
  const paymentsCount = await prisma.payment.count();
  const salesReturnsCount = await prisma.salesReturn.count();
  const salesReturnItemsCount = await prisma.salesReturnItem.count();
  const productionEntriesCount = await prisma.productionEntry.count();
  const auditLogsCount = await prisma.auditLog.count();
  const refreshTokensCount = await prisma.refreshToken.count();

  console.log('--- MASTER DATA COUNTS ---');
  console.log(`categories: ${categoriesCount}`);
  console.log(`subcategories: ${subcategoriesCount}`);
  console.log(`units: ${unitsCount}`);
  console.log(`products: ${productsCount}`);
  console.log(`product_pack_configurations: ${packConfigsCount}`);
  console.log(`product_prices: ${productPricesCount}`);

  console.log('\n--- CONFIG / WEBSITE COUNTS ---');
  console.log(`company_settings: ${companySettingsCount}`);
  console.log(`website_contents: ${websiteContentsCount}`);
  console.log(`gallery_items: ${galleryItemsCount}`);
  console.log(`users: ${usersCount}`);
  console.log(`customers: ${customersCount}`);

  console.log('\n--- TRANSACTIONAL / INVENTORY COUNTS ---');
  console.log(`stocks: ${stocksCount}`);
  console.log(`stock_movements: ${stockMovementsCount}`);
  console.log(`sales: ${salesCount}`);
  console.log(`sale_items: ${saleItemsCount}`);
  console.log(`payments: ${paymentsCount}`);
  console.log(`sales_returns: ${salesReturnsCount}`);
  console.log(`sales_return_items: ${salesReturnItemsCount}`);
  console.log(`production_entries: ${productionEntriesCount}`);
  console.log(`audit_logs: ${auditLogsCount}`);
  console.log(`refresh_tokens: ${refreshTokensCount}`);

  // Inspect ProductPrice.created_by
  const pricesWithUser = await prisma.productPrice.count({
    where: { createdById: { not: null } },
  });
  console.log(`\nproduct_prices with created_by != null: ${pricesWithUser}`);

  // Inspect ProductPackConfiguration usage in ProductPrice
  const pricesWithPack = await prisma.productPrice.count({
    where: { packConfigId: { not: null } },
  });
  const pricesLoose = await prisma.productPrice.count({
    where: { packConfigId: null },
  });
  console.log(`product_prices with packConfigId: ${pricesWithPack}`);
  console.log(`product_prices without packConfigId (loose): ${pricesLoose}`);

  // List all categories
  const categories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    select: { id: true, code: true, name: true, displayOrder: true, isActive: true },
  });
  console.log('\n--- CATEGORIES LIST ---');
  console.table(categories);

  // List all subcategories
  const subcategories = await prisma.subcategory.findMany({
    orderBy: { displayOrder: 'asc' },
    select: { id: true, categoryId: true, code: true, name: true, displayOrder: true, isActive: true },
  });
  console.log('\n--- SUBCATEGORIES LIST ---');
  console.table(subcategories);

  // List all units
  const units = await prisma.unit.findMany({
    select: { id: true, name: true, symbol: true, isWeightBased: true, conversionFactorToBase: true, isActive: true },
  });
  console.log('\n--- UNITS LIST ---');
  console.table(units);

  await prisma.$disconnect();
}

inspect().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
