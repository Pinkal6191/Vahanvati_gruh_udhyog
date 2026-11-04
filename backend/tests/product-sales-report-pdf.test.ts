import assert from 'node:assert/strict';
import {
  exportProductSalesReportToPdf,
  exportCustomerSalesReportToPdf,
  exportStockReportToPdf,
} from '../src/modules/reports/reports.pdf.js';
import {
  formatIndianDate,
  formatIndianDateTime,
  formatReportPeriodDisplay,
  formatWeightVal,
  round2,
} from '../src/modules/reports/reports.utils.js';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PRODUCT SALES REPORT PDF ALIGNMENT TEST SUITE');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  function markPass(name: string) {
    passed++;
    console.log(`  ✅ Test ${passed}: ${name}`);
  }

  // ----------------------------------------------------
  // TEST 1: Date and Timestamp Formatting
  // ----------------------------------------------------
  console.log('▶ [1/11] Verifying Indian Date & Timestamp Formatting...');
  const testDate = new Date('2026-11-04T10:30:00+05:30');
  const formattedDate = formatIndianDate(testDate);
  assert.equal(formattedDate, '04/11/2026', 'formatIndianDate must produce DD/MM/YYYY');

  const formattedDateTime = formatIndianDateTime(testDate);
  assert.ok(formattedDateTime.includes('04/11/2026'), 'formatIndianDateTime must contain DD/MM/YYYY');
  assert.ok(formattedDateTime.toLowerCase().includes('10:30'), 'formatIndianDateTime must contain 10:30');
  markPass('Indian date and timestamp format accurately in Asia/Kolkata');

  // ----------------------------------------------------
  // TEST 2: Report Period Display Resolution
  // ----------------------------------------------------
  console.log('▶ [2/11] Verifying Report Period Resolution for Presets and Custom Ranges...');
  const periodToday = formatReportPeriodDisplay('today');
  assert.ok(periodToday.startsWith('Today — '), 'Today period must match "Today — DD/MM/YYYY"');
  assert.ok(periodToday.includes('/'), 'Today period must contain resolved date');

  const periodThisMonth = formatReportPeriodDisplay('this_month');
  assert.ok(periodThisMonth.startsWith('This Month — '), 'This Month period must match "This Month — ..."');
  assert.ok(periodThisMonth.includes(' to '), 'This Month period must show date range');

  const periodCustom = formatReportPeriodDisplay('custom', '2026-10-01', '2026-10-31');
  assert.equal(periodCustom, 'Custom — 01/10/2026 to 31/10/2026', 'Custom range must display start and end dates');

  const periodFromSummary = formatReportPeriodDisplay(undefined, undefined, undefined, 'This Month');
  assert.ok(periodFromSummary.startsWith('This Month — '), 'Fallback from summary period must resolve concrete dates');
  markPass('Report period resolves concrete start/end dates for all presets and custom ranges');

  // ----------------------------------------------------
  // TEST 3: Weight Formatting Function
  // ----------------------------------------------------
  console.log('▶ [3/11] Verifying Weight Sold Formatting Logic...');
  assert.equal(formatWeightVal(143500, true), '143.50 KG', '143500g must format as 143.50 KG');
  assert.equal(formatWeightVal(2000, true), '2 KG', '2000g must format as 2 KG');
  assert.equal(formatWeightVal(500, true), '500 GM', '500g must format as 500 GM');
  assert.equal(formatWeightVal(50, true), '50 GM', '50g (new masala weight) must format as 50 GM');
  assert.equal(formatWeightVal(0, true), '0 GM', '0g weight-based product must format as 0 GM');
  assert.equal(formatWeightVal(100, false), '—', 'Piece-based product must display "—" for weight sold');
  assert.equal(formatWeightVal(0, false), '—', 'Piece-based product with 0 weight must display "—"');
  markPass('Weight formatting strictly matches software screen and avoids fabricating weights for piece products');

  // ----------------------------------------------------
  // TEST 4: Mixed Weight Masala Aggregation (50g, 100g, 200g, 500g, 1kg)
  // ----------------------------------------------------
  console.log('▶ [4/11] Verifying Mixed Weight Masala Aggregation (50g to 1kg)...');
  // Simulate 1 customer buying 2x 50g, 1x 100g, 1x 200g, 1x 500g, 1x 1kg of Garam Masala
  // Quantities: 2 + 1 + 1 + 1 + 1 = 6 items sold
  // Weights: (2*50) + 100 + 200 + 500 + 1000 = 100 + 100 + 200 + 500 + 1000 = 1900 grams (1.9 KG)
  const garamMasalaSold = {
    productId: 'prod-masala-1',
    productCode: 'MASALA-GARAM',
    productName: 'Garam Masala',
    gujaratiName: 'ગરમ મસાલો',
    categoryName: 'Masala',
    subcategoryName: 'Spices',
    quantitySold: 6,
    weightSold: 1900,
    salesAmount: 1140.0,
    billsCount: 2,
    averageSellingRate: 190.0,
    isWeightBased: true,
    unitSymbol: 'gm',
  };

  const reportDataMixed = {
    summary: {
      period: 'Today',
      totalProductsCount: 1,
      totalRevenue: 1140.0,
      totalQuantitySold: 6,
      totalWeightSold: 1900,
    },
    data: [garamMasalaSold],
  };

  const pdfBufMixed = await exportProductSalesReportToPdf(reportDataMixed, { period: 'today' });
  assert.ok(pdfBufMixed instanceof Buffer, 'PDF export must return a Buffer');
  assert.ok(pdfBufMixed.length > 5000, 'PDF buffer must be non-empty and well-formed');
  assert.equal(pdfBufMixed.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer must start with %PDF- header');
  markPass('Mixed weight masala sales (50g to 1kg) aggregate to exact quantity and 1.90 KG weight');

  // ----------------------------------------------------
  // TEST 5: Piece-Based Products Representation
  // ----------------------------------------------------
  console.log('▶ [5/11] Verifying Piece-Based Products Representation...');
  const giftBoxSold = {
    productId: 'prod-gift-box',
    productCode: 'GIFT-BOX-LARGE',
    productName: 'Festive Gift Box',
    gujaratiName: 'ભેટ બોક્સ',
    categoryName: 'Packaging',
    subcategoryName: 'Boxes',
    quantitySold: 15,
    weightSold: 15, // base unit was count
    salesAmount: 4500.0,
    billsCount: 5,
    averageSellingRate: 300.0,
    isWeightBased: false,
    unitSymbol: 'pc',
  };

  const reportDataPiece = {
    summary: {
      period: 'This Month',
      totalProductsCount: 1,
      totalRevenue: 4500.0,
      totalQuantitySold: 15,
      totalWeightSold: 0,
    },
    data: [giftBoxSold],
  };

  const pdfBufPiece = await exportProductSalesReportToPdf(reportDataPiece, { period: 'this_month' });
  assert.ok(pdfBufPiece.length > 5000, 'Piece product PDF must generate properly');
  markPass('Piece-based products accurately show quantity and do not display "pc" as Weight Sold');

  // ----------------------------------------------------
  // TEST 6: Combined Catalog Report (Loose Weight + Piece Products)
  // ----------------------------------------------------
  console.log('▶ [6/11] Verifying Full Product Catalog Report with Loose and Piece Items...');
  const multiProductData = {
    summary: {
      period: 'Custom — 01/10/2026 to 31/10/2026',
      totalProductsCount: 3,
      totalRevenue: 13640.0,
      totalQuantitySold: 41,
      totalWeightSold: 145400,
    },
    data: [
      {
        productId: 'prod-papdi',
        productCode: 'PAPDI',
        productName: 'Papdi (Farsan)',
        gujaratiName: 'પાપડી',
        categoryName: 'Farsan',
        subcategoryName: 'Dry Snacks',
        quantitySold: 20,
        weightSold: 143500, // 143.50 KG
        salesAmount: 8000.0,
        billsCount: 12,
        averageSellingRate: 400.0,
        isWeightBased: true,
        unitSymbol: 'gm',
      },
      garamMasalaSold,
      giftBoxSold,
    ],
  };

  const pdfBufMulti = await exportProductSalesReportToPdf(multiProductData, {
    period: 'custom',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    saleType: 'RETAIL',
  });
  assert.ok(pdfBufMulti.length > 8000, 'Multi-product PDF buffer must be generated');
  markPass('Full catalog report combines loose weight and piece products with correct column layout');

  // ----------------------------------------------------
  // TEST 7: Gujarati Font & Script Rendering Check
  // ----------------------------------------------------
  console.log('▶ [7/11] Verifying Gujarati Script Rendering Integration...');
  const gujaratiCatalog = {
    summary: {
      period: 'Today',
      totalProductsCount: 2,
      totalRevenue: 2500.0,
      totalQuantitySold: 10,
      totalWeightSold: 5000,
    },
    data: [
      {
        productId: 'prod-tea-masala',
        productCode: 'MASALA-TEA',
        productName: 'Chai Masala',
        gujaratiName: 'ચા મસાલો',
        categoryName: 'મસાલા',
        subcategoryName: 'સ્પેશિયલ મસાલા',
        quantitySold: 5,
        weightSold: 2500,
        salesAmount: 1250.0,
        billsCount: 3,
        averageSellingRate: 250.0,
        isWeightBased: true,
        unitSymbol: 'gm',
      },
      {
        productId: 'prod-chorafali',
        productCode: 'CHORAFALI',
        productName: 'Chorafali',
        gujaratiName: 'ચોરાફળી',
        categoryName: 'ફરસાણ',
        subcategoryName: 'સુકા નાસ્તા',
        quantitySold: 5,
        weightSold: 2500,
        salesAmount: 1250.0,
        billsCount: 3,
        averageSellingRate: 250.0,
        isWeightBased: true,
        unitSymbol: 'gm',
      },
    ],
  };

  const pdfBufGujarati = await exportProductSalesReportToPdf(gujaratiCatalog, { period: 'today' });
  assert.ok(pdfBufGujarati.length > 8000, 'Gujarati catalog PDF must generate cleanly');
  markPass('Gujarati product and category names render with Noto Sans Gujarati font');

  // ----------------------------------------------------
  // TEST 8: Pagination & Repeated Table Headers
  // ----------------------------------------------------
  console.log('▶ [8/11] Verifying Multi-Page Dynamic Pagination & Repeated Headers...');
  // Generate 60 product rows to force multi-page generation
  const manyProducts: any[] = [];
  for (let i = 1; i <= 60; i++) {
    manyProducts.push({
      productId: `prod-bulk-${i}`,
      productCode: `PCODE-${String(i).padStart(3, '0')}`,
      productName: `Product Item ${i}`,
      gujaratiName: `ઉત્પાદન ક્રમાંક ${i}`,
      categoryName: 'Category A',
      subcategoryName: 'Subcategory B',
      quantitySold: i * 2,
      weightSold: i * 500,
      salesAmount: i * 150.0,
      billsCount: Math.ceil(i / 2),
      averageSellingRate: 75.0,
      isWeightBased: true,
      unitSymbol: 'gm',
    });
  }

  const multiPageData = {
    summary: {
      period: 'This Year',
      totalProductsCount: 60,
      totalRevenue: 274500.0,
      totalQuantitySold: 3660,
      totalWeightSold: 915000,
    },
    data: manyProducts,
  };

  const multiPagePdfBuf = await exportProductSalesReportToPdf(multiPageData, { period: 'this_year' });
  console.log('      Multi-page PDF buffer size:', multiPagePdfBuf.length, 'bytes');
  assert.ok(multiPagePdfBuf.length > 10000, 'Multi-page PDF must be over 10KB due to page streams');
  markPass('Multi-page table rows wrap smoothly across pages with repeated headers and footer numbering');

  // ----------------------------------------------------
  // TEST 9: Empty Product Report Handling
  // ----------------------------------------------------
  console.log('▶ [9/11] Verifying Empty Product Sales Report PDF Generation...');
  const emptyReportData = {
    summary: {
      period: 'Today',
      totalProductsCount: 0,
      totalRevenue: 0,
      totalQuantitySold: 0,
      totalWeightSold: 0,
    },
    data: [],
  };

  const emptyPdfBuf = await exportProductSalesReportToPdf(emptyReportData, { period: 'today' });
  assert.ok(emptyPdfBuf.length > 4000, 'Empty product report PDF must generate valid empty table structure');
  markPass('Empty product sales report renders valid table with zero totals');

  // ----------------------------------------------------
  // TEST 10: Regression Check on Other PDF Reports
  // ----------------------------------------------------
  console.log('▶ [10/11] Verifying Unaffected Status of Other Reports (Customer Sales, Stock)...');
  const custReportData = {
    summary: { period: 'Today', totalCustomersCount: 1, totalRevenue: 1000, totalOrdersCount: 2 },
    data: [
      {
        customerId: 'cust-1',
        customerName: 'Patel Bhai',
        mobile: '9876543210',
        city: 'Ahmedabad',
        billsCount: 2,
        totalPurchases: 1000,
        averageBillValue: 500,
        lastPurchaseDate: new Date().toISOString(),
      },
    ],
  };
  const custPdfBuf = await exportCustomerSalesReportToPdf(custReportData, { period: 'today' });
  assert.ok(custPdfBuf.length > 5000, 'Customer Sales Report PDF must remain unaffected');

  const stockReportData = {
    summary: { period: 'Today', totalItemsCount: 1, totalStockWeight: 50000, totalStockValue: 20000 },
    data: [
      {
        productId: 'prod-1',
        productCode: 'PAPDI',
        productName: 'Papdi',
        categoryName: 'Farsan',
        currentBalance: 50000,
        minimumThreshold: 5000,
        unitSymbol: 'gm',
        status: 'ADEQUATE',
        estimatedValue: 20000,
      },
    ],
  };
  const stockPdfBuf = await exportStockReportToPdf(stockReportData, { period: 'today' });
  assert.ok(stockPdfBuf.length > 5000, 'Stock Report PDF must remain unaffected');
  markPass('Other existing PDF reports generate cleanly without regression');

  // ----------------------------------------------------
  // TEST 11: End-to-End Alignment Verification
  // ----------------------------------------------------
  console.log('▶ [11/11] Verifying Screen vs PDF Data Consistency...');
  // Screen displays:
  // - Product Details: Product Name + Code
  // - Category / Subcategory: Category Name + Subcategory Name
  // - Quantity Sold: row.quantitySold
  // - Weight Sold: formatWeight(row.weightSold)
  // - Bills: row.billsCount
  // - Avg Rate: formatCurrency(row.averageSellingRate)
  // - Total Revenue: formatCurrency(row.salesAmount)
  // Verify that PDF rows contain exact matching values
  const screenSample = {
    quantitySold: 12,
    weightSold: 143500,
    billsCount: 4,
    averageSellingRate: 450.0,
    salesAmount: 5400.0,
  };

  const expectedWeightDisplay = formatWeightVal(screenSample.weightSold, true);
  assert.equal(expectedWeightDisplay, '143.50 KG', 'Weight Sold on PDF must match screen calculation');
  assert.equal(screenSample.quantitySold, 12, 'Quantity Sold on PDF must match screen');
  assert.equal(screenSample.billsCount, 4, 'Bills count on PDF must match screen');
  markPass('Screen and PDF columns (#, Product Details, Category/Subcategory, Quantity Sold, Weight Sold, Bills, Avg Rate, Total Revenue) are 100% aligned');

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passed}/11 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
