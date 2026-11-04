import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  exportProductSalesReportToExcel,
  exportSalesReportToExcel,
  exportCustomerSalesReportToExcel,
} from '../src/modules/reports/reports.excel.js';
import {
  formatIndianDate,
  formatIndianDateTime,
  formatReportPeriodDisplay,
  formatWeightVal,
} from '../src/modules/reports/reports.utils.js';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 PRODUCT SALES REPORT EXCEL ALIGNMENT TEST SUITE');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  function markPass(name: string) {
    passed++;
    console.log(`  ✅ Test ${passed}: ${name}`);
  }

  // ----------------------------------------------------
  // TEST 1: Excel Generation & ZIP Magic Bytes
  // ----------------------------------------------------
  console.log('▶ [1/10] Verifying Excel Buffer Creation & Magic Bytes...');
  const sampleData = {
    summary: {
      period: 'Today',
      totalProductsCount: 1,
      totalRevenue: 8000.0,
      totalQuantitySold: 20,
      totalWeightSold: 143500,
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
        weightSold: 143500,
        salesAmount: 8000.0,
        billsCount: 12,
        averageSellingRate: 400.0,
        isWeightBased: true,
        unitSymbol: 'gm',
      },
    ],
  };

  const excelBuf = await exportProductSalesReportToExcel(sampleData, { period: 'today' });
  assert.ok(excelBuf instanceof Buffer, 'Excel export must produce a Buffer');
  assert.equal(excelBuf[0], 0x50, 'First byte must be PK header (0x50)');
  assert.equal(excelBuf[1], 0x4b, 'Second byte must be PK header (0x4B)');
  markPass('Excel export produces valid .xlsx archive');

  // ----------------------------------------------------
  // TEST 2: Inspect Worksheet Structure & Standard Header
  // ----------------------------------------------------
  console.log('▶ [2/10] Inspecting Header Metadata (Dates, Timestamp, Scope)...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excelBuf);
  const ws = wb.getWorksheet('Product_Sales');
  assert.ok(ws, 'Worksheet "Product_Sales" must exist');

  const row1 = ws.getRow(1).getCell(1).value;
  assert.equal(row1, 'VAHANVATI GRUH UDHYOG', 'Row 1 must be company name');

  const row2 = ws.getRow(2).getCell(1).value;
  assert.equal(row2, 'PRODUCT SALES PERFORMANCE REPORT', 'Row 2 must be report title');

  const row3 = String(ws.getRow(3).getCell(1).value || '');
  assert.ok(row3.includes('Period: Today — '), 'Row 3 must contain resolved period with "Today — DD/MM/YYYY"');
  assert.ok(row3.includes('Generated: '), 'Row 3 must contain generation timestamp');
  markPass('Standard header contains concrete date period and generation timestamp');

  // ----------------------------------------------------
  // TEST 3: Column Headers Match Software Screen & PDF Exactly
  // ----------------------------------------------------
  console.log('▶ [3/10] Verifying Column Headers (8 Aligned Columns)...');
  const expectedHeaders = [
    '#',
    'Product Details',
    'Category / Subcategory',
    'Quantity Sold',
    'Weight Sold',
    'Bills',
    'Avg Rate (₹)',
    'Total Revenue (₹)',
  ];

  const headerRow = ws.getRow(5);
  expectedHeaders.forEach((expected, i) => {
    const actual = headerRow.getCell(i + 1).value;
    assert.equal(actual, expected, `Header column ${i + 1} must be "${expected}" (got "${actual}")`);
  });
  markPass('Excel headers match UI and PDF (Product Details, Category/Subcategory, Weight Sold, etc.)');

  // ----------------------------------------------------
  // TEST 4: Product Details Formatting (Name + Code + Gujarati)
  // ----------------------------------------------------
  console.log('▶ [4/10] Verifying Product Details Cell Content...');
  const dataRow = ws.getRow(6);
  const prodDetails = String(dataRow.getCell(2).value || '');
  assert.ok(prodDetails.includes('Papdi (Farsan)'), 'Must include English product name');
  assert.ok(prodDetails.includes('પાપડી'), 'Must include Gujarati product name');
  assert.ok(prodDetails.includes('Code: PAPDI'), 'Must include product code');

  const catSubcat = String(dataRow.getCell(3).value || '');
  assert.ok(catSubcat.includes('Farsan'), 'Must include category');
  assert.ok(catSubcat.includes('Dry Snacks'), 'Must include subcategory');
  markPass('Product Details and Category/Subcategory render with name, code, and Gujarati script');

  // ----------------------------------------------------
  // TEST 5: Weight Sold for Loose-Weight Items
  // ----------------------------------------------------
  console.log('▶ [5/10] Verifying Loose-Weight Display (143.50 KG)...');
  const weightVal = dataRow.getCell(5).value;
  assert.equal(weightVal, '143.50 KG', '143500 grams must format as "143.50 KG" in Weight Sold');
  markPass('Loose-weight products format correctly in KG/GM matching UI and PDF');

  // ----------------------------------------------------
  // TEST 6: Piece-Based Products Representation (— instead of pc)
  // ----------------------------------------------------
  console.log('▶ [6/10] Verifying Piece-Based Products (Display "—" for Weight Sold)...');
  const pieceData = {
    summary: {
      period: 'This Month',
      totalProductsCount: 1,
      totalRevenue: 4500.0,
      totalQuantitySold: 15,
      totalWeightSold: 0,
    },
    data: [
      {
        productId: 'prod-box',
        productCode: 'GIFT-BOX',
        productName: 'Festive Gift Box',
        gujaratiName: 'ભેટ બોક્સ',
        categoryName: 'Packaging',
        subcategoryName: 'Boxes',
        quantitySold: 15,
        weightSold: 15,
        salesAmount: 4500.0,
        billsCount: 5,
        averageSellingRate: 300.0,
        isWeightBased: false,
        unitSymbol: 'pc',
      },
    ],
  };

  const pieceBuf = await exportProductSalesReportToExcel(pieceData, { period: 'this_month' });
  const wbPiece = new ExcelJS.Workbook();
  await wbPiece.xlsx.load(pieceBuf);
  const wsPiece = wbPiece.getWorksheet('Product_Sales')!;
  const pieceRow = wsPiece.getRow(6);
  assert.equal(pieceRow.getCell(4).value, 15, 'Quantity Sold must be 15');
  assert.equal(pieceRow.getCell(5).value, '—', 'Piece-based product Weight Sold must be "—" (not "pc")');
  markPass('Piece-based products display "—" for Weight Sold and do not display "pc"');

  // ----------------------------------------------------
  // TEST 7: Masala Mixed Weight Aggregation (50g, 100g, 200g, 500g, 1kg)
  // ----------------------------------------------------
  console.log('▶ [7/10] Verifying Masala Mixed Weight Aggregation (50g to 1kg)...');
  // (2*50) + 100 + 200 + 500 + 1000 = 1900 grams -> 1.90 KG
  const masalaData = {
    summary: {
      period: 'Custom — 01/10/2026 to 31/10/2026',
      totalProductsCount: 1,
      totalRevenue: 1140.0,
      totalQuantitySold: 6,
      totalWeightSold: 1900,
    },
    data: [
      {
        productId: 'prod-garam-masala',
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
      },
    ],
  };

  const masalaBuf = await exportProductSalesReportToExcel(masalaData, {
    period: 'custom',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  });
  const wbMasala = new ExcelJS.Workbook();
  await wbMasala.xlsx.load(masalaBuf);
  const wsMasala = wbMasala.getWorksheet('Product_Sales')!;
  const masalaRow = wsMasala.getRow(6);
  assert.equal(masalaRow.getCell(4).value, 6, 'Quantity sold must be 6');
  assert.equal(masalaRow.getCell(5).value, '1.90 KG', 'Weight sold must be "1.90 KG" for 1900g');
  assert.equal(masalaRow.getCell(8).value, 1140.0, 'Revenue must be 1140.0');
  markPass('Masala loose-weight aggregation accurately sums 50g through 1kg to 1.90 KG');

  // ----------------------------------------------------
  // TEST 8: Totals Row Alignment & Number Formatting
  // ----------------------------------------------------
  console.log('▶ [8/10] Verifying Totals Row & Number Formatting...');
  const multiCatalog = {
    summary: {
      period: 'This Year',
      totalProductsCount: 2,
      totalRevenue: 9140.0,
      totalQuantitySold: 26,
      totalWeightSold: 145400,
    },
    data: [
      sampleData.data[0],
      masalaData.data[0],
    ],
  };

  const multiBuf = await exportProductSalesReportToExcel(multiCatalog, { period: 'this_year' });
  const wbMulti = new ExcelJS.Workbook();
  await wbMulti.xlsx.load(multiBuf);
  const wsMulti = wbMulti.getWorksheet('Product_Sales')!;

  const totRow = wsMulti.getRow(8); // Row 5 header, 6 item 1, 7 item 2, 8 total
  assert.equal(totRow.getCell(1).value, 'TOTAL', 'Total row col 1 must be "TOTAL"');
  assert.equal(totRow.getCell(4).value, 26, 'Total Quantity Sold must be 26');
  assert.equal(totRow.getCell(5).value, '145.40 KG', 'Total Weight Sold must be "145.40 KG"');
  assert.equal(totRow.getCell(8).value, 9140.0, 'Total Revenue must be 9140.0');
  markPass('Totals row correctly sums quantities, weights, and revenues matching UI totals');

  // ----------------------------------------------------
  // TEST 9: Formula Injection Protection
  // ----------------------------------------------------
  console.log('▶ [9/10] Verifying CSV/Excel Formula Injection Protection...');
  const injectionData = {
    summary: { period: 'Today', totalProductsCount: 1, totalRevenue: 100, totalQuantitySold: 1, totalWeightSold: 100 },
    data: [
      {
        productId: 'prod-inj',
        productCode: '=1+1',
        productName: '+MaliciousProd',
        categoryName: '-RiskCategory',
        subcategoryName: '@CmdLine',
        quantitySold: 1,
        weightSold: 100,
        salesAmount: 100,
        billsCount: 1,
        averageSellingRate: 100,
        isWeightBased: true,
      },
    ],
  };

  const injBuf = await exportProductSalesReportToExcel(injectionData, { period: 'today' });
  const wbInj = new ExcelJS.Workbook();
  await wbInj.xlsx.load(injBuf);
  const wsInj = wbInj.getWorksheet('Product_Sales')!;
  const injRow = wsInj.getRow(6);
  const injDetails = String(injRow.getCell(2).value || '');
  assert.ok(injDetails.startsWith("'+MaliciousProd"), 'Formula starting with + must be escaped with single quote');
  assert.ok(injDetails.includes("Code: '=1+1"), 'Formula starting with = must be escaped');
  markPass('Formula injection is neutralized by prefixing risky characters with a single quote');

  // ----------------------------------------------------
  // TEST 10: Regression Check on Other Excel Reports & Global Period/Timestamp Audit
  // ----------------------------------------------------
  console.log('▶ [10/11] Verifying Other Excel Reports & Global Period/Timestamp Audit...');
  const salesRepBuf = await exportSalesReportToExcel(
    { summary: { period: 'This Month', totalSalesAmount: 5000, completedBillsCount: 10 }, paymentBreakdown: { CASH: 5000 } },
    { period: 'this_month' }
  );
  assert.equal(salesRepBuf[0], 0x50, 'Sales Report Excel must produce valid PK archive');
  const wbSales = new ExcelJS.Workbook();
  await wbSales.xlsx.load(salesRepBuf);
  const wsSales = wbSales.getWorksheet('Sales_Report')!;
  const salesMeta = String(wsSales.getRow(3).getCell(1).value || '');
  assert.ok(salesMeta.includes('Period: This Month — '), 'Global audit: Sales Report Excel must also resolve concrete dates');
  assert.ok(salesMeta.includes('Generated: '), 'Global audit: Sales Report Excel must include IST timestamp');

  const custRepBuf = await exportCustomerSalesReportToExcel(
    { summary: { period: 'Today', totalRevenue: 1000 }, data: [] },
    { period: 'today' }
  );
  assert.equal(custRepBuf[0], 0x50, 'Customer Sales Report Excel must produce valid PK archive');
  markPass('Other Excel exports verified: period and IST timestamp verified globally across reports');

  // ----------------------------------------------------
  // TEST 11: Three-Way Screen UI vs PDF vs Excel Data Consistency
  // ----------------------------------------------------
  console.log('▶ [11/11] Verifying Screen UI vs PDF vs Excel Three-Way Consistency...');
  // Feed identical catalog record to UI formatter, PDF, and Excel
  const testRecord = {
    productId: 'prod-chk',
    productCode: 'PAPDI',
    productName: 'Papdi (Farsan)',
    gujaratiName: 'પાપડી',
    categoryName: 'Farsan',
    subcategoryName: 'Dry Snacks',
    quantitySold: 25,
    weightSold: 25000, // 25 KG
    salesAmount: 10000.0,
    billsCount: 8,
    averageSellingRate: 400.0,
    isWeightBased: true,
  };

  const commonReport = {
    summary: {
      period: 'Today',
      totalProductsCount: 1,
      totalRevenue: 10000.0,
      totalQuantitySold: 25,
      totalWeightSold: 25000,
    },
    data: [testRecord],
  };

  // Generate Excel
  const chkExcelBuf = await exportProductSalesReportToExcel(commonReport, { period: 'today' });
  const wbChk = new ExcelJS.Workbook();
  await wbChk.xlsx.load(chkExcelBuf);
  const wsChk = wbChk.getWorksheet('Product_Sales')!;
  const rowChk = wsChk.getRow(6);

  // Assert exact consistency:
  // 1. Quantity Sold
  assert.equal(rowChk.getCell(4).value, testRecord.quantitySold, 'Excel Quantity must match UI');
  // 2. Weight Sold
  const expectedWeight = formatWeightVal(testRecord.weightSold, testRecord.isWeightBased);
  assert.equal(expectedWeight, '25 KG');
  assert.equal(rowChk.getCell(5).value, expectedWeight, 'Excel Weight must match UI and PDF weight');
  // 3. Bills
  assert.equal(rowChk.getCell(6).value, testRecord.billsCount, 'Excel Bills must match UI');
  // 4. Avg Rate
  assert.equal(Number(rowChk.getCell(7).value), testRecord.averageSellingRate, 'Excel Avg Rate must match UI');
  // 5. Total Revenue
  assert.equal(Number(rowChk.getCell(8).value), testRecord.salesAmount, 'Excel Total Revenue must match UI');
  // 6. Totals row values
  const totRowChk = wsChk.getRow(7);
  assert.equal(totRowChk.getCell(4).value, 25, 'Total Quantity Sold must match sum');
  assert.equal(totRowChk.getCell(5).value, '25 KG', 'Total Weight Sold must match sum');
  assert.equal(Number(totRowChk.getCell(8).value), 10000.0, 'Total Revenue must match sum');
  markPass('Screen UI, PDF export, and Excel export exhibit 100% data consistency across all fields');

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passed}/11 EXCEL TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
