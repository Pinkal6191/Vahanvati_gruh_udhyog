import { PrismaClient, Role, CustomerType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Vahanvati Gruh Udhyog Database Seed...');

  // 1. Company Settings
  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        companyName: 'Vahanvati Gruh Udhyog',
        tagline: 'Authentic Traditional Taste & Quality',
        address: 'Main Bazaar, Ahmedabad, Gujarat, India',
        phone: '+91 98250 12345',
        gstin: '24AAAAA0000A1Z5',
        fssaiLicense: '10020000000000',
        invoicePrefix: 'VGU',
        invoiceFooterNotes: 'Thank you for your visit! No return on perishable food items after 48 hours.',
        printFormat: 'THERMAL_3INCH',
        allowNegativeStock: false,
      },
    });
    console.log('✅ Company settings created.');
  }

  // 2. Units
  const gram = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Gram',
      symbol: 'gm',
      isWeightBased: true,
      conversionFactorToBase: 1.0,
    },
  });

  const kg = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Kilogram',
      symbol: 'kg',
      isWeightBased: true,
      conversionFactorToBase: 1000.0,
    },
  });

  const pc = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Piece',
      symbol: 'pc',
      isWeightBased: false,
      conversionFactorToBase: 1.0,
    },
  });
  console.log('✅ Standard units seeded (Gram, KG, Piece).');

  // 3. System Default Walk-in Customer (BD-3 Approved)
  const walkInCustomer = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Walk-in Customer',
      customerType: CustomerType.INDIAN,
      mobile: '0000000000',
      city: 'Local',
      country: 'India',
      notes: 'System default counter customer',
    },
  });
  console.log(`✅ Default walk-in customer ready: ${walkInCustomer.name}`);

  // 4. Default Users
  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('admin123', salt);
  const outletPassword = await bcrypt.hash('outlet123', salt);
  const prodPassword = await bcrypt.hash('prod123', salt);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Super Administrator',
      email: 'admin@vahanvati.com',
      passwordHash: defaultPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { username: 'outlet' },
    update: {},
    create: {
      username: 'outlet',
      fullName: 'Counter Staff',
      email: 'counter@vahanvati.com',
      passwordHash: outletPassword,
      role: Role.OUTLET,
    },
  });

  await prisma.user.upsert({
    where: { username: 'production' },
    update: {},
    create: {
      username: 'production',
      fullName: 'Kitchen Production Manager',
      email: 'kitchen@vahanvati.com',
      passwordHash: prodPassword,
      role: Role.PRODUCTION,
    },
  });
  console.log('✅ Default users seeded (admin, outlet, production).');

  // 5. Initial Sample Product Category Hierarchy
  const farsanCategory = await prisma.category.upsert({
    where: { code: 'FARSAN' },
    update: {},
    create: {
      name: 'Farsan',
      code: 'FARSAN',
      displayOrder: 1,
    },
  });

  const drySnacksSubcategory = await prisma.subcategory.upsert({
    where: { code: 'DRY_SNACKS' },
    update: {},
    create: {
      categoryId: farsanCategory.id,
      name: 'Dry Snacks',
      code: 'DRY_SNACKS',
      displayOrder: 1,
    },
  });

  // 6. Products with Multi-Tier Pricing (Indian vs NRI)
  const papdi = await prisma.product.upsert({
    where: { code: 'PAPDI' },
    update: {},
    create: {
      subcategoryId: drySnacksSubcategory.id,
      primaryUnitId: gram.id,
      name: 'Papdi (Farsan)',
      gujaratiName: 'પાપડી',
      code: 'PAPDI',
      barcode: '890123456701',
      isLooseWeightAllowed: true,
      stock: {
        create: {
          currentBalance: 25000.0, // 25 KG in grams
          minimumThreshold: 5000.0,
        },
      },
    },
    include: { stock: true },
  });

  // Record opening balance movement in ledger
  const existingOpening = await prisma.stockMovement.findFirst({
    where: { productId: papdi.id, notes: 'Opening stock balance' },
  });
  if (!existingOpening && papdi.stock) {
    await prisma.stockMovement.create({
      data: {
        productId: papdi.id,
        movementType: 'ADJUSTMENT_IN',
        referenceType: 'MANUAL',
        referenceId: papdi.stock.id,
        quantityDelta: 25000.0,
        balanceAfter: 25000.0,
        notes: 'Opening stock balance',
      },
    });
  }

  // Pack Configs for Papdi
  const papdi500gm = await prisma.productPackConfiguration.create({
    data: {
      productId: papdi.id,
      packName: '500 GM Pack',
      weightInBaseUnits: 500.0,
      unitId: gram.id,
      displayOrder: 1,
    },
  });

  const papdi1kg = await prisma.productPackConfiguration.create({
    data: {
      productId: papdi.id,
      packName: '1 KG Pack',
      weightInBaseUnits: 1000.0,
      unitId: kg.id,
      displayOrder: 2,
    },
  });

  // Prices for Papdi:
  // Base rate (per KG): Indian ₹280, NRI ₹450
  await prisma.productPrice.createMany({
    data: [
      { productId: papdi.id, packConfigId: null, customerType: CustomerType.INDIAN, rate: 280.0 },
      { productId: papdi.id, packConfigId: null, customerType: CustomerType.NRI, rate: 450.0 },
      { productId: papdi.id, packConfigId: papdi500gm.id, customerType: CustomerType.INDIAN, rate: 140.0 },
      { productId: papdi.id, packConfigId: papdi500gm.id, customerType: CustomerType.NRI, rate: 225.0 },
      { productId: papdi.id, packConfigId: papdi1kg.id, customerType: CustomerType.INDIAN, rate: 280.0 },
      { productId: papdi.id, packConfigId: papdi1kg.id, customerType: CustomerType.NRI, rate: 450.0 },
    ],
  });

  console.log('✅ Seed finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
