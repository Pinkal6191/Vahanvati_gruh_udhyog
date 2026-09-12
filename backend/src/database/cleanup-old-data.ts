import { PrismaClient, CustomerType } from '@prisma/client';

const prisma = new PrismaClient();

const OFFICIAL_CAT_CODES = [
  'CAT_REG_PAPDI',
  'CAT_SEV',
  'CAT_VADI',
  'CAT_CHAKRI',
  'CAT_MATHIYA_PAPAD',
  'CAT_FARALI',
  'CAT_MASALA',
];

async function cleanupOldData() {
  console.log('🧹 Starting cleanup of old test data, bills, and dummy items...');

  // 1. DELETE TRANSACTIONAL DATA
  const delReturnItems = await prisma.salesReturnItem.deleteMany({});
  console.log(`✅ Deleted ${delReturnItems.count} sales return line items.`);

  const delReturns = await prisma.salesReturn.deleteMany({});
  console.log(`✅ Deleted ${delReturns.count} sales return records.`);

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`✅ Deleted ${delPayments.count} payment records.`);

  const delSaleItems = await prisma.saleItem.deleteMany({});
  console.log(`✅ Deleted ${delSaleItems.count} sale line items.`);

  const delSales = await prisma.sale.deleteMany({});
  console.log(`✅ Deleted ${delSales.count} sales bills.`);

  const delProdEntries = await prisma.productionEntry.deleteMany({});
  console.log(`✅ Deleted ${delProdEntries.count} production entries.`);

  const delStockMovements = await prisma.stockMovement.deleteMany({});
  console.log(`✅ Deleted ${delStockMovements.count} stock movements.`);

  const delAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`✅ Deleted ${delAuditLogs.count} audit logs.`);

  // 2. IDENTIFY OFFICIAL CATEGORIES & SUBCATEGORIES
  const officialCategories = await prisma.category.findMany({
    where: { code: { in: OFFICIAL_CAT_CODES } },
    include: { subcategories: true },
  });

  const officialSubcategoryIds = officialCategories.flatMap((c) =>
    c.subcategories.map((s) => s.id)
  );

  console.log(
    `📋 Found ${officialCategories.length} official categories and ${officialSubcategoryIds.length} official subcategories.`
  );

  // 3. DELETE DUMMY PRODUCTS (products not in official subcategories or marked inactive)
  const dummyProducts = await prisma.product.findMany({
    where: {
      OR: [
        { subcategoryId: { notIn: officialSubcategoryIds } },
        { isActive: false },
      ],
    },
    select: { id: true, name: true, code: true },
  });

  const dummyProductIds = dummyProducts.map((p) => p.id);
  console.log(`Found ${dummyProducts.length} dummy/test products to remove.`);

  if (dummyProductIds.length > 0) {
    await prisma.productPrice.deleteMany({
      where: { productId: { in: dummyProductIds } },
    });
    await prisma.productPackConfiguration.deleteMany({
      where: { productId: { in: dummyProductIds } },
    });
    await prisma.stock.deleteMany({
      where: { productId: { in: dummyProductIds } },
    });
    const delProds = await prisma.product.deleteMany({
      where: { id: { in: dummyProductIds } },
    });
    console.log(`✅ Deleted ${delProds.count} dummy/test products.`);
  }

  // 4. DELETE DUMMY SUBCATEGORIES & CATEGORIES
  const delSubcats = await prisma.subcategory.deleteMany({
    where: { id: { notIn: officialSubcategoryIds } },
  });
  console.log(`✅ Deleted ${delSubcats.count} dummy subcategories.`);

  const officialCategoryIds = officialCategories.map((c) => c.id);
  const delCats = await prisma.category.deleteMany({
    where: { id: { notIn: officialCategoryIds } },
  });
  console.log(`✅ Deleted ${delCats.count} dummy categories.`);

  // 5. CLEAN TEST CUSTOMERS (keep only Walk-in Customer & NRI Walk-in Customer)
  const delCustomers = await prisma.customer.deleteMany({
    where: {
      name: { notIn: ['Walk-in Customer', 'NRI Walk-in Customer'] },
    },
  });
  console.log(`✅ Cleaned up ${delCustomers.count} test customer records.`);

  // 5.1 CLEAN UNUSED UNITS (keep ONLY Kilogram and Gram)
  const delUnits = await prisma.unit.deleteMany({
    where: {
      id: { notIn: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'] },
    },
  });
  console.log(`✅ Cleaned up ${delUnits.count} unused units (kept Kilogram & Gram only).`);

  // Ensure Walk-in customers exist
  const existingIndian = await prisma.customer.findFirst({
    where: { customerType: CustomerType.INDIAN, name: 'Walk-in Customer' },
  });
  if (!existingIndian) {
    await prisma.customer.create({
      data: {
        name: 'Walk-in Customer',
        customerType: CustomerType.INDIAN,
        mobile: '0000000000',
      },
    });
  }

  const existingNri = await prisma.customer.findFirst({
    where: { customerType: CustomerType.NRI, name: 'NRI Walk-in Customer' },
  });
  if (!existingNri) {
    await prisma.customer.create({
      data: {
        name: 'NRI Walk-in Customer',
        customerType: CustomerType.NRI,
        mobile: '0000000000',
      },
    });
  }
  console.log(`✅ Verified standard Indian & NRI Walk-in customers.`);

  // 6. RESET STOCK FOR ALL REMAINING OFFICIAL PRODUCTS
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  for (const prod of activeProducts) {
    await prisma.stock.upsert({
      where: { productId: prod.id },
      update: { currentBalance: 50000.0, minimumThreshold: 5000.0 }, // 50 KG opening stock in grams
      create: {
        productId: prod.id,
        currentBalance: 50000.0,
        minimumThreshold: 5000.0,
      },
    });
  }
  console.log(`✅ Reset stock to 50 KG opening balance for all ${activeProducts.length} authentic products.`);

  // 7. SUMMARY REPORT
  const totalProducts = await prisma.product.count({ where: { isActive: true } });
  const totalCategories = await prisma.category.count();
  const totalSales = await prisma.sale.count();
  const totalReturns = await prisma.salesReturn.count();

  console.log('\n=============================================');
  console.log('🎉 CLEANUP COMPLETE!');
  console.log(`📦 Active Authentic Products: ${totalProducts}`);
  console.log(`📂 Active Official Categories: ${totalCategories}`);
  console.log(`🧾 Sales Bills remaining: ${totalSales}`);
  console.log(`🔄 Sales Returns remaining: ${totalReturns}`);
  console.log('=============================================\n');
}

cleanupOldData()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
