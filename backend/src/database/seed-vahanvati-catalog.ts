import { PrismaClient, CustomerType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedVahanvatiCatalog() {
  console.log('🌱 Starting Vahanvati Real Business Data & Gujarati Catalog Seeding...');

  // 1. UPDATE COMPANY SETTINGS
  const settings = await prisma.companySettings.findFirst();
  const companyData = {
    companyName: 'Vahanvati Gruh Udhyog',
    tagline: 'હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર.',
    address: 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
    phone: '+91 97149 17851 / +91 97121 15118',
    gstin: '24BCIPP6428E1ZL',
    fssaiLicense: '10020000000000',
    invoicePrefix: 'VGU',
    invoiceFooterNotes: 'વેચેલો માલ પાછો લેવામાં આવશે નહીં. • ન્યાય ક્ષેત્ર આણંદ રહેશે.',
    printFormat: 'THERMAL_3INCH',
    allowNegativeStock: false,
  };

  if (settings) {
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: companyData,
    });
  } else {
    await prisma.companySettings.create({ data: companyData });
  }
  console.log('✅ Company Settings updated with authentic Padgol details & Gujarati tagline.');

  // 2. UNITS
  const gram = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Gram',
      symbol: 'gm',
      isWeightBased: true,
      conversionFactorToBase: 1.0,
      isActive: true,
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
      isActive: true,
    },
  });

  // 3. DEACTIVATE OLD TEST DUMMY PRODUCTS (with timestamps)
  await prisma.product.updateMany({
    where: {
      OR: [
        { code: { contains: '1788' } },
        { name: { contains: '1788' } },
        { name: { contains: 'Test' } },
        { name: { contains: 'Inactive' } },
      ],
    },
    data: { isActive: false },
  });
  console.log('✅ Deactivated old test-generated dummy products.');

  // 4. CATEGORIES IN GUJARATI
  const categoriesDef = [
    { code: 'CAT_REG_PAPDI', name: 'રેગ્યુલર પાપડી', displayOrder: 1 },
    { code: 'CAT_SEV', name: 'સેવ', displayOrder: 2 },
    { code: 'CAT_VADI', name: 'વડી', displayOrder: 3 },
    { code: 'CAT_CHAKRI', name: 'ચકરી', displayOrder: 4 },
    { code: 'CAT_MATHIYA_PAPAD', name: 'મઠીયા - પાપડ', displayOrder: 5 },
    { code: 'CAT_FARALI', name: 'ફરાળી આઈટમ', displayOrder: 6 },
    { code: 'CAT_MASALA', name: 'મસાલા', displayOrder: 7 },
  ];

  const catMap = new Map<string, string>();
  const subMap = new Map<string, string>();

  for (const c of categoriesDef) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, isActive: true, displayOrder: c.displayOrder },
      create: { code: c.code, name: c.name, isActive: true, displayOrder: c.displayOrder },
    });
    catMap.set(c.code, cat.id);

    // Default subcategory for each category
    const subCode = `SUB_${c.code}`;
    const sub = await prisma.subcategory.upsert({
      where: { code: subCode },
      update: { name: c.name, isActive: true, categoryId: cat.id },
      create: { code: subCode, name: c.name, isActive: true, categoryId: cat.id, displayOrder: 1 },
    });
    subMap.set(c.code, sub.id);
  }
  console.log('✅ Created 7 Gujarati Categories & Subcategories.');

  // 5. MASTER PRODUCT CATALOG & PRICING
  interface RawProductInput {
    catCode: string;
    code: string;
    gujaratiName: string;
    englishName: string;
    indianPricePerKg: number;
    nriPricePerKg?: number;
    isPackOnly?: boolean;
    packName?: string;
    packGrams?: number;
    packIndianPrice?: number;
    packNriPrice?: number;
  }

  const catalogItems: RawProductInput[] = [
    // --- 1. રેગ્યુલર પાપડી (Regular Papdi) ---
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_CHOKHA_MED', gujaratiName: 'ચોખાની પાપડી (મીડીયમ)', englishName: 'Chokhani Papdi (Medium)', indianPricePerKg: 160, nriPricePerKg: 320 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_CHOKHA_TIKHI', gujaratiName: 'ચોખાની પાપડી (તીખી)', englishName: 'Chokhani Papdi (Tikhi)', indianPricePerKg: 160, nriPricePerKg: 340 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_CHOKHA_OCHHU', gujaratiName: 'ચોખાની પાપડી (ઓછુ મરચુ)', englishName: 'Chokhani Papdi (Ochhu Marchu)', indianPricePerKg: 160, nriPricePerKg: 320 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_CHOKHA_PLAIN', gujaratiName: 'ચોખાની પાપડી (મરચા વગર)', englishName: 'Chokhani Papdi (Marcha Vagar)', indianPricePerKg: 160, nriPricePerKg: 320 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_KRISHNA_KAMOD', gujaratiName: 'ક્રિષ્ના કમોદ પાપડી', englishName: 'Krishna Kamod Papdi', indianPricePerKg: 300, nriPricePerKg: 460 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_KODRI', gujaratiName: 'કોદરી પાપડી', englishName: 'Kodri Papdi', indianPricePerKg: 240, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_LILA_LASAN', gujaratiName: 'લીલા લસણની પાપડી', englishName: 'Lila Lasanni Papdi', indianPricePerKg: 340, nriPricePerKg: 460 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_JUWAR', gujaratiName: 'જુવાર પાપડી', englishName: 'Juwar Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_MAKAI', gujaratiName: 'મકાઈ પાપડી', englishName: 'Makai Papdi', indianPricePerKg: 220, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_BAJRI', gujaratiName: 'બાજરી પાપડી', englishName: 'Bajri Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_GHAUN', gujaratiName: 'ઘઉંની પાપડી', englishName: 'Ghaunni Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_RAGI', gujaratiName: 'રાગીની પાપડી', englishName: 'Raginni Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_PUNJABI', gujaratiName: 'પંજાબી પાપડી', englishName: 'Punjabi Papdi', indianPricePerKg: 240, nriPricePerKg: 400 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_METHI', gujaratiName: 'મેથીની પાપડી', englishName: 'Methini Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_LILA_DHANA', gujaratiName: 'લીલા ધાણાની પાપડી', englishName: 'Lila Dhanani Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_FUDINA', gujaratiName: 'ફુદીનાની પાપડી', englishName: 'Fudinani Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },
    { catCode: 'CAT_REG_PAPDI', code: 'PAPDI_PALAK', gujaratiName: 'પાલકની પાપડી', englishName: 'Palakni Papdi', indianPricePerKg: 200, nriPricePerKg: 360 },

    // --- 2. સેવ (Sev) ---
    { catCode: 'CAT_SEV', code: 'SEV_CHOKHA', gujaratiName: 'ચોખાની સેવ', englishName: 'Chokhani Sev', indianPricePerKg: 200 },
    { catCode: 'CAT_SEV', code: 'SEV_KODRI', gujaratiName: 'કોદરીની સેવ', englishName: 'Kodrini Sev', indianPricePerKg: 260 },
    { catCode: 'CAT_SEV', code: 'SEV_KRISHNA_KAMOD', gujaratiName: 'ક્રિષ્ના કમોદ સેવ', englishName: 'Krishna Kamod Sev', indianPricePerKg: 340 },
    { catCode: 'CAT_SEV', code: 'SEV_PUNJABI', gujaratiName: 'પંજાબી સેવ', englishName: 'Punjabi Sev', indianPricePerKg: 300 },
    { catCode: 'CAT_SEV', code: 'SEV_LASAN', gujaratiName: 'લસણની સેવ', englishName: 'Lasanni Sev', indianPricePerKg: 360 },

    // --- 3. વડી (Vadi) ---
    { catCode: 'CAT_VADI', code: 'VADI_CHOKHA', gujaratiName: 'ચોખાની વડી', englishName: 'Chokhani Vadi', indianPricePerKg: 260 },
    { catCode: 'CAT_VADI', code: 'VADI_PUNJABI', gujaratiName: 'પંજાબી વડી', englishName: 'Punjabi Vadi', indianPricePerKg: 300 },
    { catCode: 'CAT_VADI', code: 'VADI_LASAN', gujaratiName: 'લસણની વડી', englishName: 'Lasanni Vadi', indianPricePerKg: 400 },

    // --- 4. ચકરી (Chakri & Lot) ---
    { catCode: 'CAT_CHAKRI', code: 'CHAKRI_CHOKHA', gujaratiName: 'ચોખાની ચકરી', englishName: 'Chokhani Chakri', indianPricePerKg: 240 },
    { catCode: 'CAT_CHAKRI', code: 'LOT_CHOKHA_INSTANT', gujaratiName: 'ચોખાનો ઈન્સ્ટન્ટ લોટ', englishName: 'Chokhano Instant Lot', indianPricePerKg: 160 },

    // --- 3. મઠીયા - પાપડ (Mathiya & Papad) ---
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'MATHIYA_TRADITIONAL', gujaratiName: 'મઠીયા', englishName: 'Mathiya', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'MATHIYA_LILA_MARCHA', gujaratiName: 'લીલા મરચાં મઠીયા', englishName: 'Lila Marcha Mathiya', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'CHORAFALI_TRADITIONAL', gujaratiName: 'ચોરાફળી', englishName: 'Chorafali', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_SINGLE_MARI', gujaratiName: 'સીંગલ મરી પાપડ', englishName: 'Single Mari Papad', indianPricePerKg: 240 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_DOUBLE_MARI', gujaratiName: 'ડબલ મરી પાપડ', englishName: 'Double Mari Papad', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_PUNJABI', gujaratiName: 'પંજાબી પાપડ', englishName: 'Punjabi Papad', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_LASAN', gujaratiName: 'લસણ પાપડ', englishName: 'Lasan Papad', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_MATH', gujaratiName: 'મઠ પાપડ', englishName: 'Math Papad', indianPricePerKg: 260 },
    { catCode: 'CAT_MATHIYA_PAPAD', code: 'PAPAD_CHORA', gujaratiName: 'ચોરા પાપડ', englishName: 'Chora Papad', indianPricePerKg: 260 },

    // --- 4. ફરાળી આઈટમ (Farali / Upvas Fasting Items) ---
    { catCode: 'CAT_FARALI', code: 'FARALI_MORAIYA_PAPDI', gujaratiName: 'મોરૈયાની પાપડી', englishName: 'Moraiyani Papdi', indianPricePerKg: 340, nriPricePerKg: 400 },
    { catCode: 'CAT_FARALI', code: 'FARALI_MORAIYA_SEV', gujaratiName: 'મોરૈયા સેવ', englishName: 'Moraiya Sev', indianPricePerKg: 400, nriPricePerKg: 450 },
    { catCode: 'CAT_FARALI', code: 'FARALI_SABUDANA_CHAKRI', gujaratiName: 'સાબુદાણા ચકરી', englishName: 'Sabudana Chakri', indianPricePerKg: 240, nriPricePerKg: 300 },
    { catCode: 'CAT_FARALI', code: 'FARALI_SABUDANA_CHAMCHA', gujaratiName: 'સાબુદાણા ચમચા', englishName: 'Sabudana Chamcha', indianPricePerKg: 240, nriPricePerKg: 300 },
    { catCode: 'CAT_FARALI', code: 'FARALI_SABUDANA_BATAKA_CHAKRI', gujaratiName: 'સાબુદાણા બટાકા ચકરી', englishName: 'Sabudana Bataka Chakri', indianPricePerKg: 300, nriPricePerKg: 360 },
    { catCode: 'CAT_FARALI', code: 'FARALI_BATAKA_KATRI', gujaratiName: 'બટાકાની કાતરી', englishName: 'Batakani Katri', indianPricePerKg: 400, nriPricePerKg: 480 },
    { catCode: 'CAT_FARALI', code: 'FARALI_RATALU_KATRI', gujaratiName: 'રતાળુની કાતરી', englishName: 'Rataluni Katri', indianPricePerKg: 400, nriPricePerKg: 480 },
    { catCode: 'CAT_FARALI', code: 'FARALI_BATAKA_WAFERS', gujaratiName: 'બટાકાની વેફર્સ', englishName: 'Batakani Wafers', indianPricePerKg: 400, nriPricePerKg: 480 },
    { catCode: 'CAT_FARALI', code: 'FARALI_BATAKA_JALI_WAFERS', gujaratiName: 'બટાકાની જાલી વેફર્સ', englishName: 'Batakani Jali Wafers', indianPricePerKg: 400, nriPricePerKg: 480 },
    { catCode: 'CAT_FARALI', code: 'FARALI_SABUDANA_BATAKA_PAPAD', gujaratiName: 'સાબુદાણા બટાકાના પાપડ', englishName: 'Sabudana Bataka Papad', indianPricePerKg: 360, nriPricePerKg: 420 },

    // --- 5. મસાલા (Authentic Homemade Masala - 100g pack & kg rate) ---
    { catCode: 'CAT_MASALA', code: 'MASALA_3IN1_GARAM', gujaratiName: '3 in 1 રજવાડી ગરમ મસાલો', englishName: '3 in 1 Rajwadi Garam Masalo', indianPricePerKg: 1000, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 100 },
    { catCode: 'CAT_MASALA', code: 'MASALA_VARAN_DAL', gujaratiName: 'સ્પે. વરણ દાળનો મસાલો', englishName: 'Spe. Varan Dalno Masalo', indianPricePerKg: 1000, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 100 },
    { catCode: 'CAT_MASALA', code: 'MASALA_KHICHDI_VAGHARELI', gujaratiName: 'વઘારેલી ખીચડી નો મસાલો', englishName: 'Vaghareli Khichdino Masalo', indianPricePerKg: 1400, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 140 },
    { catCode: 'CAT_MASALA', code: 'MASALA_CHA', gujaratiName: 'ચા મસાલો', englishName: 'Cha Masalo', indianPricePerKg: 1200, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 120 },
    { catCode: 'CAT_MASALA', code: 'MASALA_KADHI', gujaratiName: 'કઢી મસાલો', englishName: 'Kadhi Masalo', indianPricePerKg: 1200, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 120 },
    { catCode: 'CAT_MASALA', code: 'MASALA_SHAK', gujaratiName: 'શાક મસાલો', englishName: 'Shak Masalo', indianPricePerKg: 1200, packName: '100 GM Pack', packGrams: 100, packIndianPrice: 120 },
  ];

  let seededCount = 0;

  for (const item of catalogItems) {
    const subId = subMap.get(item.catCode)!;
    const nriRate = item.nriPricePerKg || Math.round(item.indianPricePerKg * 1.5);

    const prod = await prisma.product.upsert({
      where: { code: item.code },
      update: {
        name: item.gujaratiName,
        gujaratiName: item.gujaratiName,
        description: item.englishName,
        subcategoryId: subId,
        primaryUnitId: kg.id,
        isLooseWeightAllowed: !item.isPackOnly,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.gujaratiName,
        gujaratiName: item.gujaratiName,
        description: item.englishName,
        subcategoryId: subId,
        primaryUnitId: kg.id,
        isLooseWeightAllowed: !item.isPackOnly,
        isActive: true,
      },
      include: {
        stock: true,
      },
    });

    // Ensure Initial Stock
    if (!prod.stock) {
      await prisma.stock.create({
        data: {
          productId: prod.id,
          currentBalance: 50000.0, // 50 KG opening stock in grams
          minimumThreshold: 5000.0,
        },
      });
    }

    // Base Loose Prices (per KG)
    await prisma.productPrice.deleteMany({
      where: { productId: prod.id },
    });

    await prisma.productPrice.createMany({
      data: [
        {
          productId: prod.id,
          packConfigId: null,
          customerType: CustomerType.INDIAN,
          rate: item.indianPricePerKg,
          isActive: true,
        },
        {
          productId: prod.id,
          packConfigId: null,
          customerType: CustomerType.NRI,
          rate: nriRate,
          isActive: true,
        },
      ],
    });

    // If item has a specific pack configuration (e.g. Masala 100g)
    if (item.packName && item.packGrams && item.packIndianPrice) {
      const packConfig = await prisma.productPackConfiguration.create({
        data: {
          productId: prod.id,
          packName: item.packName,
          weightInBaseUnits: item.packGrams,
          unitId: gram.id,
          displayOrder: 1,
          isActive: true,
        },
      });

      await prisma.productPrice.createMany({
        data: [
          {
            productId: prod.id,
            packConfigId: packConfig.id,
            customerType: CustomerType.INDIAN,
            rate: item.packIndianPrice,
            isActive: true,
          },
          {
            productId: prod.id,
            packConfigId: packConfig.id,
            customerType: CustomerType.NRI,
            rate: Math.round(item.packIndianPrice * 1.5),
            isActive: true,
          },
        ],
      });
    }

    seededCount++;
  }

  console.log(`🎉 Successfully seeded ${seededCount} authentic Gujarati products with Indian & NRI prices!`);
}

seedVahanvatiCatalog()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
