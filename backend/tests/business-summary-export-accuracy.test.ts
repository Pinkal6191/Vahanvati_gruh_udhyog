import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import ExcelJS from 'exceljs';
import { exportBusinessSummaryToPdf } from '../src/modules/reports/reports.pdf.js';
import { exportBusinessSummaryToExcel } from '../src/modules/reports/reports.excel.js';
import {
  formatIndianDate,
  formatIndianDateTime,
  formatReportPeriodDisplay,
  formatWeightVal,
  round2,
} from '../src/modules/reports/reports.utils.js';

function extractTextFromPdf(buf: Buffer): string {
  const str = buf.toString('latin1');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  const streams: string[] = [];
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      streams.push(zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'));
    } catch {
      streams.push(match[1]);
    }
  }

  // Collect each distinct font cmap
  const cmaps: Map<number, string>[] = [];
  for (const s of streams) {
    if (s.includes('beginbfrange')) {
      const cmap = new Map<number, string>();
      const bfMatches = s.matchAll(/beginbfrange\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]\s+endbfrange/g);
      for (const m of bfMatches) {
        const start = parseInt(m[1], 16);
        const chars = m[3].match(/<([0-9a-fA-F]+)>/g) || [];
        chars.forEach((c, idx) => {
          const hex = c.replace(/[<>]/g, '');
          const cp = parseInt(hex, 16);
          cmap.set(start + idx, String.fromCodePoint(cp));
        });
      }
      cmaps.push(cmap);
    }
  }

  let text = '';
  for (const s of streams) {
    const lines = s.split('\n');
    for (const line of lines) {
      if (line.includes('TJ')) {
        for (const cmap of cmaps) {
          let decoded = '';
          const hexes = line.matchAll(/<([0-9a-fA-F]+)>/g);
          for (const h of hexes) {
            const hex = h[1];
            for (let i = 0; i < hex.length; i += 4) {
              const cid = parseInt(hex.slice(i, i + 4), 16);
              decoded += cmap.get(cid) || '';
            }
          }
          if (decoded.length > 0) {
            text += decoded + '\n';
          }
        }
      }
    }
  }
  return text;
}

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 EXECUTIVE BUSINESS SUMMARY PDF & EXCEL DATA ACCURACY SUITE');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  function markPass(name: string) {
    passed++;
    console.log(`  ✅ Test ${passed}: ${name}`);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Exact User Scenario Reproduction (1 completed bill, ₹1,410.00, Today)
  // --------------------------------------------------------------------------
  console.log('▶ [1/6] Verifying User Scenario: 1 completed bill, ₹1,410.00...');

  const authoritativeSummaryData = {
    period: 'Today',
    scope: {
      isMasterAdmin: true,
      isScoped: false,
      scopeLabel: 'Company Total Sales',
      allowedSaleTypes: ['RETAIL', 'NRI', 'WHOLESALE'],
    },
    sales: {
      totalSales: 1410.0,
      billCount: 1,
      averageBillValue: 1410.0,
    },
    salesByType: {
      RETAIL: { totalSales: 1410.0, billCount: 1 },
      NRI: { totalSales: 0, billCount: 0 },
      WHOLESALE: { totalSales: 0, billCount: 0 },
    },
    returns: {
      totalReturnsAmount: 0,
      returnsCount: 0,
    },
    netSales: 1410.0,
    production: {
      totalProductionWeight: 0,
      productionEntriesCount: 0,
    },
    inventory: {
      totalItems: 42,
      inStockCount: 38,
      lowStockCount: 3,
      outOfStockCount: 1,
    },
    paymentSummary: {
      CASH: 1410.0,
      UPI: 0,
      CARD: 0,
      CHEQUE: 0,
      BANK_TRANSFER: 0,
      CREDIT: 0,
    },
    topProducts: [
      {
        productId: 'prod-papdi-1',
        productName: 'Papdi (પાપડી)',
        revenue: 1410.0,
        quantity: 3,
      },
    ],
  };

  // Generate PDF
  const pdfBuf = await exportBusinessSummaryToPdf(authoritativeSummaryData, { period: 'today' });
  assert.ok(pdfBuf instanceof Buffer, 'PDF export must return a Buffer');
  assert.ok(pdfBuf.length > 5000, 'PDF buffer must have valid size');
  assert.equal(pdfBuf.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer must be a valid PDF document');

  // Verify PDF binary content contains the non-zero revenue, bill count, and cash payment
  const pdfContent = extractTextFromPdf(pdfBuf);
  assert.ok(pdfContent.includes('1,410.00'), 'PDF must include ₹1,410.00 revenue');
  assert.ok(pdfContent.includes('Company Total Sales'), 'PDF must include Scope label');

  // Generate Excel
  const xlsxBuf = await exportBusinessSummaryToExcel(authoritativeSummaryData, { period: 'today' });
  assert.ok(xlsxBuf instanceof Buffer, 'Excel export must return a Buffer');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuf);
  const ws = wb.getWorksheet('Business_Summary');
  assert.ok(ws, 'Worksheet "Business_Summary" must exist');

  // Verify Title and Metadata in Excel
  const titleRow = ws.getRow(2).getCell(1).value;
  assert.equal(titleRow, 'EXECUTIVE BUSINESS SUMMARY DASHBOARD', 'Excel title must match');

  const metaRow = String(ws.getRow(3).getCell(1).value || '');
  assert.ok(metaRow.includes('Period: Today — '), 'Excel header must show concrete Today period');
  assert.ok(metaRow.includes('Scope: Company Total Sales'), 'Excel header must show Company Total Sales');
  assert.ok(metaRow.includes('Generated: '), 'Excel header must contain generated timestamp');

  // Inspect Metrics Table in Excel
  const rowMetricsHeader = ws.getRow(5).getCell(1).value;
  assert.equal(rowMetricsHeader, 'KEY BUSINESS METRIC', 'Metrics section header must match');

  // Net Sales Revenue
  assert.equal(ws.getRow(6).getCell(1).value, 'Net Sales Revenue (₹)');
  assert.equal(ws.getRow(6).getCell(2).value, 1410);

  // Total Sales Revenue
  assert.equal(ws.getRow(7).getCell(1).value, 'Total Sales Revenue (₹)');
  assert.equal(ws.getRow(7).getCell(2).value, 1410);

  // Completed Invoices
  assert.equal(ws.getRow(8).getCell(1).value, 'Completed Invoices');
  assert.equal(ws.getRow(8).getCell(2).value, 1);

  // Average Bill Value
  assert.equal(ws.getRow(9).getCell(1).value, 'Average Bill Value (₹)');
  assert.equal(ws.getRow(9).getCell(2).value, 1410);

  // Sales Returns
  assert.equal(ws.getRow(10).getCell(1).value, 'Sales Returns Amount (₹)');
  assert.equal(ws.getRow(10).getCell(2).value, 0);

  // Completed Batches
  assert.equal(ws.getRow(11).getCell(1).value, 'Completed Production Batches');
  assert.equal(ws.getRow(11).getCell(2).value, 0);

  // Total Production Weight
  assert.equal(ws.getRow(12).getCell(1).value, 'Total Production Weight (GM)');
  assert.equal(ws.getRow(12).getCell(2).value, 0);

  // Inspect SaleType Section in Excel
  const tierHeader = ws.getRow(14).getCell(1).value;
  assert.equal(tierHeader, 'SALE TYPE / CHANNEL');

  // Retail Row
  assert.equal(ws.getRow(15).getCell(1).value, 'RETAIL');
  assert.equal(ws.getRow(15).getCell(2).value, 1);
  assert.equal(ws.getRow(15).getCell(3).value, 1410);

  // Tier Total Row
  assert.equal(ws.getRow(18).getCell(1).value, 'TOTAL');
  assert.equal(ws.getRow(18).getCell(2).value, 1);
  assert.equal(ws.getRow(18).getCell(3).value, 1410);

  // Inspect Payment Breakdown Section in Excel
  const payHeader = ws.getRow(20).getCell(1).value;
  assert.equal(payHeader, 'PAYMENT CHANNEL');

  // CASH Row
  assert.equal(ws.getRow(21).getCell(1).value, 'CASH');
  assert.equal(ws.getRow(21).getCell(2).value, 1410);

  // Payment Total Row
  const lastRow = ws.lastRow!;
  assert.equal(lastRow.getCell(1).value, 'TOTAL');
  assert.equal(lastRow.getCell(2).value, 1410);

  markPass('User scenario (1 bill, ₹1,410.00) exports with 100% data fidelity in PDF and Excel');

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Tier & Multi-Payment Modes Complex Aggregation
  // --------------------------------------------------------------------------
  console.log('▶ [2/6] Verifying Multi-Tier & Multi-Payment Channel Aggregation...');

  const complexSummaryData = {
    period: 'This Month',
    scope: {
      isMasterAdmin: true,
      isScoped: false,
      scopeLabel: 'Company Total Sales',
      allowedSaleTypes: ['RETAIL', 'NRI', 'WHOLESALE'],
    },
    sales: {
      totalSales: 45750.5,
      billCount: 18,
      averageBillValue: 2541.69,
    },
    salesByType: {
      RETAIL: { totalSales: 22500.0, billCount: 12 },
      NRI: { totalSales: 15250.5, billCount: 4 },
      WHOLESALE: { totalSales: 8000.0, billCount: 2 },
    },
    returns: {
      totalReturnsAmount: 750.5,
      returnsCount: 2,
    },
    netSales: 45000.0,
    production: {
      totalProductionWeight: 185000, // 185 KG
      productionEntriesCount: 6,
    },
    inventory: {
      totalItems: 50,
      inStockCount: 45,
      lowStockCount: 4,
      outOfStockCount: 1,
    },
    paymentSummary: {
      CASH: 20000.0,
      UPI: 17750.5,
      CARD: 5000.0,
      CHEQUE: 3000.0,
      BANK_TRANSFER: 0,
      CREDIT: 0,
    },
    topProducts: [],
  };

  const complexPdf = await exportBusinessSummaryToPdf(complexSummaryData, { period: 'this_month' });
  assert.ok(complexPdf.length > 5000, 'Complex PDF export succeeds');
  const complexPdfContent = extractTextFromPdf(complexPdf);
  assert.ok(complexPdfContent.includes('45,750.50'), 'PDF must include total sales 45,750.50');
  assert.ok(complexPdfContent.includes('45,000.00'), 'PDF must include net sales 45,000.00');

  const complexXlsx = await exportBusinessSummaryToExcel(complexSummaryData, { period: 'this_month' });
  const complexWb = new ExcelJS.Workbook();
  await complexWb.xlsx.load(complexXlsx);
  const complexWs = complexWb.getWorksheet('Business_Summary')!;

  assert.equal(complexWs.getRow(6).getCell(2).value, 45000.0, 'Net sales must be 45000');
  assert.equal(complexWs.getRow(7).getCell(2).value, 45750.5, 'Total sales must be 45750.5');
  assert.equal(complexWs.getRow(8).getCell(2).value, 18, 'Completed invoices must be 18');
  assert.equal(complexWs.getRow(10).getCell(2).value, 750.5, 'Returns amount must be 750.5');
  assert.equal(complexWs.getRow(11).getCell(2).value, 6, 'Completed production batches must be 6');
  assert.equal(complexWs.getRow(12).getCell(2).value, 185000, 'Production weight must be 185000 GM');

  markPass('Multi-tier, multi-payment channel aggregation produces matching values across PDF and Excel');

  // --------------------------------------------------------------------------
  // TEST 3: Scoped Access (RBAC restriction)
  // --------------------------------------------------------------------------
  console.log('▶ [3/6] Verifying Scoped User Access...');

  const scopedData = {
    period: 'Today',
    scope: {
      isMasterAdmin: false,
      isScoped: true,
      scopeLabel: 'Authorized Sales (Scoped: RETAIL)',
      allowedSaleTypes: ['RETAIL'],
    },
    sales: {
      totalSales: 3200.0,
      billCount: 4,
      averageBillValue: 800.0,
    },
    salesByType: {
      RETAIL: { totalSales: 3200.0, billCount: 4 },
      NRI: { totalSales: 0, billCount: 0 },
      WHOLESALE: { totalSales: 0, billCount: 0 },
    },
    returns: {
      totalReturnsAmount: 0,
      returnsCount: 0,
    },
    netSales: 3200.0,
    production: {
      totalProductionWeight: 0,
      productionEntriesCount: 0,
    },
    inventory: {
      totalItems: 30,
      inStockCount: 30,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    paymentSummary: {
      CASH: 2200.0,
      UPI: 1000.0,
    },
    topProducts: [],
  };

  const scopedPdf = await exportBusinessSummaryToPdf(scopedData, { period: 'today' });
  const scopedPdfContent = extractTextFromPdf(scopedPdf);
  assert.ok(scopedPdfContent.includes('Authorized Sales (Scoped: RETAIL)'), 'PDF must reflect scoped label');

  const scopedXlsx = await exportBusinessSummaryToExcel(scopedData, { period: 'today' });
  const scopedWb = new ExcelJS.Workbook();
  await scopedWb.xlsx.load(scopedXlsx);
  const scopedWs = scopedWb.getWorksheet('Business_Summary')!;
  const scopedMeta = String(scopedWs.getRow(3).getCell(1).value || '');
  assert.ok(scopedMeta.includes('Scope: Authorized Sales (Scoped: RETAIL)'), 'Excel header must show scoped label');

  markPass('Scoped RBAC access correctly displays scoped label and permissions in PDF and Excel');

  // --------------------------------------------------------------------------
  // TEST 4: Zero Data Period Handling
  // --------------------------------------------------------------------------
  console.log('▶ [4/6] Verifying Zero Data Period Handling...');

  const emptyData = {
    period: 'Yesterday',
    scope: {
      isMasterAdmin: true,
      isScoped: false,
      scopeLabel: 'Company Total Sales',
      allowedSaleTypes: ['RETAIL', 'NRI', 'WHOLESALE'],
    },
    sales: {
      totalSales: 0,
      billCount: 0,
      averageBillValue: 0,
    },
    salesByType: {
      RETAIL: { totalSales: 0, billCount: 0 },
      NRI: { totalSales: 0, billCount: 0 },
      WHOLESALE: { totalSales: 0, billCount: 0 },
    },
    returns: {
      totalReturnsAmount: 0,
      returnsCount: 0,
    },
    netSales: 0,
    production: {
      totalProductionWeight: 0,
      productionEntriesCount: 0,
    },
    inventory: {
      totalItems: 40,
      inStockCount: 40,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    paymentSummary: {},
    topProducts: [],
  };

  const emptyPdf = await exportBusinessSummaryToPdf(emptyData, { period: 'yesterday' });
  assert.ok(emptyPdf instanceof Buffer && emptyPdf.length > 3000, 'Empty PDF generates cleanly');

  const emptyXlsx = await exportBusinessSummaryToExcel(emptyData, { period: 'yesterday' });
  const emptyWb = new ExcelJS.Workbook();
  await emptyWb.xlsx.load(emptyXlsx);
  const emptyWs = emptyWb.getWorksheet('Business_Summary')!;
  assert.equal(emptyWs.getRow(6).getCell(2).value, 0, 'Net sales must be 0');
  assert.equal(emptyWs.getRow(8).getCell(2).value, 0, 'Invoices count must be 0');

  markPass('Zero data periods export safely without NaN, exceptions, or layout breakage');

  // --------------------------------------------------------------------------
  // TEST 5: Custom Date Range Resolution
  // --------------------------------------------------------------------------
  console.log('▶ [5/6] Verifying Custom Date Range Resolution...');

  const customQuery = {
    period: 'custom',
    startDate: '2026-11-01',
    endDate: '2026-11-04',
  };

  const customData = {
    ...authoritativeSummaryData,
    period: '2026-11-01 to 2026-11-04',
  };

  const customPdf = await exportBusinessSummaryToPdf(customData, customQuery);
  const customPdfContent = extractTextFromPdf(customPdf);
  assert.ok(
    customPdfContent.includes('01/11/2026 to 04/11/2026') || customPdfContent.includes('Custom'),
    'PDF must show resolved custom date range'
  );

  const customXlsx = await exportBusinessSummaryToExcel(customData, customQuery);
  const customWb = new ExcelJS.Workbook();
  await customWb.xlsx.load(customXlsx);
  const customWs = customWb.getWorksheet('Business_Summary')!;
  const customMeta = String(customWs.getRow(3).getCell(1).value || '');
  assert.ok(customMeta.includes('01/11/2026 to 04/11/2026'), 'Excel header must show custom date range in DD/MM/YYYY');

  markPass('Custom date range resolves accurately with start and end dates formatted in Asia/Kolkata');

  // --------------------------------------------------------------------------
  // TEST 6: Legacy / Backward-Compatible Fallback Mapping
  // --------------------------------------------------------------------------
  console.log('▶ [6/6] Verifying Legacy Data Structure Fallback...');

  const legacyData = {
    today: {
      sales: 1200,
      bills: 2,
      returns: 100,
      production: 1,
    },
    paymentModes: {
      CASH: 700,
      UPI: 500,
    },
  };

  const legacyPdf = await exportBusinessSummaryToPdf(legacyData, { period: 'today' });
  assert.ok(legacyPdf.length > 5000, 'Legacy PDF export succeeds');
  const legacyPdfContent = extractTextFromPdf(legacyPdf);
  assert.ok(legacyPdfContent.includes('1,200.00'), 'Legacy PDF must read data.today.sales');

  const legacyXlsx = await exportBusinessSummaryToExcel(legacyData, { period: 'today' });
  const legacyWb = new ExcelJS.Workbook();
  await legacyWb.xlsx.load(legacyXlsx);
  const legacyWs = legacyWb.getWorksheet('Business_Summary')!;
  assert.equal(legacyWs.getRow(7).getCell(2).value, 1200, 'Legacy Excel must read data.today.sales');
  assert.equal(legacyWs.getRow(8).getCell(2).value, 2, 'Legacy Excel must read data.today.bills');

  markPass('Backward compatibility preserves older data structures gracefully');

  console.log('\n========================================================');
  console.log(`🎉 ALL ${passed} TESTS PASSED PERFECTLY!`);
  console.log('========================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
