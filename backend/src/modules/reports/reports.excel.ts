import ExcelJS from 'exceljs';
import { round2 } from './reports.utils.js';

// Prevent CSV/Excel Formula Injection by prefixing unsafe characters with a single quote
export function sanitizeCellValue(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${val}`;
    }
  }
  return val;
}

export function createBaseWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vahanvati Gruh Udhyog BMS';
  wb.lastModifiedBy = 'Vahanvati Gruh Udhyog BMS';
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

interface ReportHeaderOptions {
  title: string;
  period?: string;
  scope?: string;
  extraMeta?: Record<string, string>;
}

export function addStandardHeader(ws: ExcelJS.Worksheet, options: ReportHeaderOptions, colSpan: number = 6) {
  // Title 1: Company Name
  const row1 = ws.addRow(['VAHANVATI GRUH UDHYOG']);
  row1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  ws.mergeCells(1, 1, 1, Math.max(colSpan, 4));

  // Title 2: Report Title
  const row2 = ws.addRow([options.title.toUpperCase()]);
  row2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF334155' } };
  ws.mergeCells(2, 1, 2, Math.max(colSpan, 4));

  // Title 3: Metadata / Date Range / Scope
  const metaParts: string[] = [];
  if (options.period) metaParts.push(`Period: ${options.period}`);
  if (options.scope) metaParts.push(`Scope: ${options.scope}`);
  metaParts.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
  if (options.extraMeta) {
    for (const [k, v] of Object.entries(options.extraMeta)) {
      metaParts.push(`${k}: ${v}`);
    }
  }

  const row3 = ws.addRow([metaParts.join('  |  ')]);
  row3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  ws.mergeCells(3, 1, 3, Math.max(colSpan, 4));

  // Empty spacer row
  ws.addRow([]);
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });
  row.height = 24;
}

export function styleTotalRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    };
  });
  row.height = 20;
}

export function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 12, maxWidth = 40) {
  ws.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 3) return; // skip company title merges
      const val = cell.value ? String(cell.value) : '';
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    column.width = Math.min(Math.max(maxLen + 3, minWidth), maxWidth);
  });
}

// ============================================================
// 1. Sales Report Excel Export
// ============================================================
export async function exportSalesReportToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Sales_Report');

  addStandardHeader(ws, {
    title: 'Sales Summary & Trends Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 5);

  // Summary Metrics Table
  ws.addRow(['METRIC', 'VALUE']);
  styleHeaderRow(ws.lastRow!);

  ws.addRow(['Total Net Sales (₹)', Number(data.summary?.totalSalesAmount || 0)]);
  ws.addRow(['Completed Bills', Number(data.summary?.completedBillsCount || 0)]);
  ws.addRow(['Average Bill Value (₹)', Number(data.summary?.averageBillValue || 0)]);
  ws.addRow(['Total Quantity Sold', Number(data.summary?.totalQuantitySold || 0)]);
  ws.addRow(['Total Weight Sold (gm/kg)', Number(data.summary?.totalWeightSold || 0)]);
  ws.addRow(['Cancelled Bills Count', Number(data.summary?.cancelledBillsCount || 0)]);
  ws.addRow(['Cancelled Sales Amount (₹)', Number(data.summary?.cancelledAmount || 0)]);
  ws.addRow([]);

  // Payment Breakdown
  ws.addRow(['PAYMENT MODE', 'AMOUNT (₹)']);
  styleHeaderRow(ws.lastRow!);
  if (data.paymentBreakdown) {
    for (const [mode, amt] of Object.entries(data.paymentBreakdown)) {
      ws.addRow([mode, Number(amt)]);
    }
  }
  ws.addRow([]);

  // Time-Series
  if (data.timeSeries && data.timeSeries.length > 0) {
    ws.addRow(['PERIOD', 'BILLS', 'SALES AMOUNT (₹)', 'QUANTITY SOLD']);
    styleHeaderRow(ws.lastRow!);
    for (const ts of data.timeSeries) {
      ws.addRow([ts.periodKey, Number(ts.billsCount), Number(ts.salesAmount), Number(ts.quantitySold)]);
    }
  }

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 2. Product Sales Report Excel Export
// ============================================================
export async function exportProductSalesReportToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Product_Sales');

  addStandardHeader(ws, {
    title: 'Product Sales Performance Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 8);

  const headerRow = ws.addRow([
    '#',
    'Product Code',
    'Product Name',
    'Category',
    'Subcategory',
    'Unit',
    'Quantity Sold',
    'Bills Count',
    'Revenue (₹)',
    'Avg Price (₹)',
  ]);
  styleHeaderRow(headerRow);

  let totalQty = 0;
  let totalRev = 0;

  if (Array.isArray(data.products)) {
    data.products.forEach((p: any, idx: number) => {
      totalQty += Number(p.quantitySold || 0);
      totalRev += Number(p.totalRevenue || 0);

      ws.addRow([
        idx + 1,
        sanitizeCellValue(p.code || ''),
        sanitizeCellValue(p.productName || ''),
        sanitizeCellValue(p.categoryName || '—'),
        sanitizeCellValue(p.subcategoryName || '—'),
        sanitizeCellValue(p.primaryUnit || 'pc'),
        Number(p.quantitySold || 0),
        Number(p.billsCount || 0),
        Number(p.totalRevenue || 0),
        Number(p.averagePrice || 0),
      ]);
    });
  }

  const totRow = ws.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    round2(totalQty),
    '',
    round2(totalRev),
    '',
  ]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 3. Customer Sales Report Excel Export
// ============================================================
export async function exportCustomerSalesReportToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Customer_Sales');

  addStandardHeader(ws, {
    title: 'Customer Sales & Spending Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 8);

  const headerRow = ws.addRow([
    '#',
    'Customer Name',
    'Mobile',
    'City',
    'Customer Type',
    'Total Bills',
    'Total Purchases (₹)',
    'Avg Bill Value (₹)',
    'Last Purchase Date',
  ]);
  styleHeaderRow(headerRow);

  let totalSpend = 0;
  let totalBills = 0;

  if (Array.isArray(data.customers)) {
    data.customers.forEach((c: any, idx: number) => {
      totalSpend += Number(c.totalPurchases || 0);
      totalBills += Number(c.totalBills || 0);

      ws.addRow([
        idx + 1,
        sanitizeCellValue(c.name || 'Walk-in Customer'),
        sanitizeCellValue(c.mobile || '—'),
        sanitizeCellValue(c.city || '—'),
        sanitizeCellValue(c.customerType || 'INDIAN'),
        Number(c.totalBills || 0),
        Number(c.totalPurchases || 0),
        Number(c.averageBillValue || 0),
        c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('en-IN') : '—',
      ]);
    });
  }

  const totRow = ws.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    totalBills,
    round2(totalSpend),
    '',
    '',
  ]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 4. Customer Purchase History Excel Export
// ============================================================
export async function exportCustomerHistoryToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Customer_History');

  addStandardHeader(ws, {
    title: `Customer Purchase History - ${data.customer?.name || 'Customer'}`,
    extraMeta: {
      Mobile: data.customer?.mobile || '—',
      City: data.customer?.city || '—',
      Type: data.customer?.customerType || '—',
    },
  }, 6);

  const headerRow = ws.addRow([
    'Bill Number',
    'Date & Time',
    'Sale Type',
    'Payment Mode',
    'Items Count',
    'Total Amount (₹)',
  ]);
  styleHeaderRow(headerRow);

  let total = 0;
  if (Array.isArray(data.sales)) {
    data.sales.forEach((s: any) => {
      total += Number(s.totalAmount || 0);
      ws.addRow([
        sanitizeCellValue(s.billNumber),
        new Date(s.date).toLocaleString('en-IN'),
        s.saleType,
        Array.isArray(s.paymentModes) ? s.paymentModes.join(', ') : 'CASH',
        Number(s.itemsCount || 0),
        Number(s.totalAmount || 0),
      ]);
    });
  }

  const totRow = ws.addRow(['TOTAL', '', '', '', '', round2(total)]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 5. Production Report Excel Export
// ============================================================
export async function exportProductionReportToExcel(data: any, _query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Production_Report');

  addStandardHeader(ws, {
    title: 'Kitchen Production & Batch Report',
    period: data.summary?.period,
  }, 7);

  const headerRow = ws.addRow([
    'Batch #',
    'Date',
    'Product Code',
    'Product Name',
    'Quantity',
    'Unit',
    'Status',
    'Notes',
  ]);
  styleHeaderRow(headerRow);

  let totalQty = 0;
  if (Array.isArray(data.batches)) {
    data.batches.forEach((b: any) => {
      totalQty += Number(b.quantity || 0);
      ws.addRow([
        sanitizeCellValue(b.batchNumber),
        new Date(b.date).toLocaleDateString('en-IN'),
        sanitizeCellValue(b.productCode || ''),
        sanitizeCellValue(b.productName || ''),
        Number(b.quantity || 0),
        sanitizeCellValue(b.unit || 'Kg'),
        b.status,
        sanitizeCellValue(b.notes || ''),
      ]);
    });
  }

  const totRow = ws.addRow(['TOTAL', '', '', '', round2(totalQty), '', '', '']);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 6. Stock Report Excel Export
// ============================================================
export async function exportStockReportToExcel(data: any, _query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Current_Stock');

  addStandardHeader(ws, {
    title: 'Inventory Balance & Valuation Report',
  }, 9);

  const headerRow = ws.addRow([
    '#',
    'Code',
    'Product Name',
    'Category',
    'Subcategory',
    'Current Balance',
    'Min Threshold',
    'Unit',
    'Stock Status',
    'Stock Value (₹)',
  ]);
  styleHeaderRow(headerRow);

  let totalVal = 0;
  let totalBal = 0;

  if (Array.isArray(data.stock)) {
    data.stock.forEach((s: any, idx: number) => {
      totalBal += Number(s.currentBalance || 0);
      totalVal += Number(s.stockValue || 0);

      ws.addRow([
        idx + 1,
        sanitizeCellValue(s.code || ''),
        sanitizeCellValue(s.productName || ''),
        sanitizeCellValue(s.categoryName || '—'),
        sanitizeCellValue(s.subcategoryName || '—'),
        Number(s.currentBalance || 0),
        Number(s.minimumThreshold || 0),
        sanitizeCellValue(s.unit || 'Kg'),
        s.status,
        Number(s.stockValue || 0),
      ]);
    });
  }

  const totRow = ws.addRow(['TOTAL', '', '', '', '', round2(totalBal), '', '', '', round2(totalVal)]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 7. Stock Movements Report Excel Export
// ============================================================
export async function exportStockMovementsToExcel(data: any, _query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Stock_Movements');

  addStandardHeader(ws, {
    title: 'Inventory Movement & Audit Ledger',
    period: data.summary?.period,
  }, 9);

  const headerRow = ws.addRow([
    '#',
    'Date & Time',
    'Product Code',
    'Product Name',
    'Movement Type',
    'Reference Type',
    'Qty Change',
    'Balance After',
    'Unit',
    'Notes',
    'User',
  ]);
  styleHeaderRow(headerRow);

  if (Array.isArray(data.movements)) {
    data.movements.forEach((m: any, idx: number) => {
      ws.addRow([
        idx + 1,
        new Date(m.date).toLocaleString('en-IN'),
        sanitizeCellValue(m.code || ''),
        sanitizeCellValue(m.productName || ''),
        m.movementType,
        m.referenceType || '—',
        Number(m.quantityDelta || 0),
        Number(m.balanceAfter || 0),
        sanitizeCellValue(m.unit || 'Kg'),
        sanitizeCellValue(m.notes || ''),
        sanitizeCellValue(m.user?.fullName || m.user?.username || 'System'),
      ]);
    });
  }

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 8. Stock Reconciliation Report Excel Export
// ============================================================
export async function exportStockReconciliationToExcel(data: any, _query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Stock_Reconciliation');

  addStandardHeader(ws, {
    title: 'Stock Audit & Reconciliation Variance Report',
  }, 9);

  const headerRow = ws.addRow([
    '#',
    'Product Code',
    'Product Name',
    'Category',
    'System Balance',
    'Physical Count',
    'Variance / Discrepancy',
    'Unit',
    'Status',
    'Audit Date',
  ]);
  styleHeaderRow(headerRow);

  if (Array.isArray(data.items)) {
    data.items.forEach((item: any, idx: number) => {
      ws.addRow([
        idx + 1,
        sanitizeCellValue(item.code || ''),
        sanitizeCellValue(item.productName || ''),
        sanitizeCellValue(item.categoryName || '—'),
        Number(item.theoreticalBalance || 0),
        Number(item.physicalCount ?? item.theoreticalBalance ?? 0),
        Number(item.discrepancy || 0),
        sanitizeCellValue(item.unit || 'Kg'),
        item.discrepancy === 0 ? 'MATCHED' : 'DISCREPANCY',
        item.lastAuditedAt ? new Date(item.lastAuditedAt).toLocaleDateString('en-IN') : '—',
      ]);
    });
  }

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 9. Returns Report Excel Export
// ============================================================
export async function exportReturnsReportToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Sales_Returns');

  addStandardHeader(ws, {
    title: 'Sales Returns & Refunds Register',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 9);

  const headerRow = ws.addRow([
    'Return #',
    'Date & Time',
    'Original Bill #',
    'Customer Name',
    'Sale Type',
    'Refund Amount (₹)',
    'Refund Mode',
    'Return Reason',
    'Status',
  ]);
  styleHeaderRow(headerRow);

  let totalRefund = 0;
  if (Array.isArray(data.returns)) {
    data.returns.forEach((r: any) => {
      totalRefund += Number(r.refundAmount || 0);
      ws.addRow([
        sanitizeCellValue(r.returnNumber),
        new Date(r.date).toLocaleString('en-IN'),
        sanitizeCellValue(r.billNumber || '—'),
        sanitizeCellValue(r.customerName || 'Walk-in'),
        r.saleType || 'RETAIL',
        Number(r.refundAmount || 0),
        r.refundMode || 'CASH',
        sanitizeCellValue(r.reason || '—'),
        r.status || 'COMPLETED',
      ]);
    });
  }

  const totRow = ws.addRow(['TOTAL', '', '', '', '', round2(totalRefund), '', '', '']);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 10. Business Summary Excel Export
// ============================================================
export async function exportBusinessSummaryToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Business_Summary');

  addStandardHeader(ws, {
    title: 'Executive Business Summary Dashboard',
    period: query.period || 'today',
    scope: data.scope?.scopeLabel || (query.saleType ? `SaleType: ${query.saleType}` : undefined),
  }, 4);

  ws.addRow(['KEY BUSINESS METRIC', 'VALUE']);
  styleHeaderRow(ws.lastRow!);

  ws.addRow(['Total Sales Revenue (₹)', Number(data.today?.sales || data.summary?.totalSalesAmount || 0)]);
  ws.addRow(['Completed Invoices', Number(data.today?.bills || data.summary?.completedBillsCount || 0)]);
  ws.addRow(['Sales Returns Amount (₹)', Number(data.today?.returns || 0)]);
  ws.addRow(['Completed Production Batches', Number(data.today?.production || 0)]);
  ws.addRow([]);

  // SaleType Segment
  ws.addRow(['SALE TYPE', 'AMOUNT (₹)']);
  styleHeaderRow(ws.lastRow!);
  if (data.salesByType) {
    for (const [st, val] of Object.entries(data.salesByType)) {
      const amount = typeof val === 'object' && val !== null ? (val as any).totalSalesAmount : val;
      ws.addRow([st, Number(amount || 0)]);
    }
  }
  ws.addRow([]);

  // Payment Breakdown
  ws.addRow(['PAYMENT CHANNEL', 'TOTAL (₹)']);
  styleHeaderRow(ws.lastRow!);
  if (data.paymentModes || data.paymentBreakdown) {
    const pb = data.paymentModes || data.paymentBreakdown;
    for (const [mode, amt] of Object.entries(pb)) {
      ws.addRow([mode, Number(amt || 0)]);
    }
  }

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 11. Statutory Sales Register Excel Export
// ============================================================
export async function exportStatutorySalesToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Statutory_Sales_Register');

  addStandardHeader(ws, {
    title: 'Statutory Sales Register (CA / GST Compliance)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 14);

  const headerRow = ws.addRow([
    'Invoice #',
    'Date',
    'Customer Name',
    'GSTIN',
    'Customer Type',
    'Sale Type',
    'Payment Mode',
    'Gross (₹)',
    'Discount (₹)',
    'Taxable (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'Total Tax (₹)',
    'Net Total (₹)',
    'Status',
  ]);
  styleHeaderRow(headerRow);

  let totalGross = 0;
  let totalDisc = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalTax = 0;
  let totalNet = 0;

  const invoices = Array.isArray(data.data) ? data.data : Array.isArray(data.invoices) ? data.invoices : [];
  invoices.forEach((inv: any) => {
    const isCancelled = (inv.saleStatus || inv.status) === 'CANCELLED';
    const subtotal = Number(inv.subtotalAmount ?? inv.subtotal ?? 0);
    const discount = Number(inv.discountAmount ?? inv.discount ?? 0);
    const taxable = Number(inv.taxableAmount ?? inv.taxable ?? (subtotal - discount));
    const tax = Number(inv.taxAmount ?? inv.totalTax ?? 0);
    const cgst = Number(inv.cgst ?? round2(tax / 2));
    const sgst = Number(inv.sgst ?? round2(tax / 2));
    const grandTotal = Number(inv.finalTotalAmount ?? inv.grandTotal ?? 0);
    const pMode = Array.isArray(inv.paymentModes) ? inv.paymentModes.join(', ') : inv.paymentMode || 'CASH';

    if (!isCancelled) {
      totalGross += subtotal;
      totalDisc += discount;
      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalTax += tax;
      totalNet += grandTotal;
    }

    ws.addRow([
      sanitizeCellValue(inv.billNumber),
      new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN'),
      sanitizeCellValue(inv.customerName || 'Walk-in'),
      sanitizeCellValue(inv.customerGstin || '—'),
      inv.customerType || 'INDIAN',
      inv.saleType || 'RETAIL',
      pMode,
      subtotal,
      discount,
      taxable,
      cgst,
      sgst,
      tax,
      grandTotal,
      inv.saleStatus || inv.status || 'COMPLETED',
    ]);
  });

  const totRow = ws.addRow([
    'TOTAL (Active)',
    '',
    '',
    '',
    '',
    '',
    '',
    round2(totalGross),
    round2(totalDisc),
    round2(totalTaxable),
    round2(totalCgst),
    round2(totalSgst),
    round2(totalTax),
    round2(totalNet),
    '',
  ]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 12. Statutory Itemized Sales Register Excel Export
// ============================================================
export async function exportStatutoryItemizedToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Statutory_Itemized');

  addStandardHeader(ws, {
    title: 'Statutory Itemized Sales Register (Line-Level GST)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 14);

  const headerRow = ws.addRow([
    'Invoice #',
    'Date',
    'Customer Name',
    'GSTIN',
    'Sale Type',
    'Product Name',
    'HSN Code',
    'Quantity',
    'Unit',
    'Unit Rate (₹)',
    'Taxable (₹)',
    'GST Rate (%)',
    'Tax (₹)',
    'Total (₹)',
    'Status',
  ]);
  styleHeaderRow(headerRow);

  let totalQty = 0;
  let totalTaxable = 0;
  let totalTax = 0;
  let totalAmt = 0;

  const items = Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : [];
  items.forEach((item: any) => {
    const isCancelled = (item.saleStatus || item.status) === 'CANCELLED';
    const qty = Number(item.quantity || 0);
    const taxable = Number(item.taxableAmount ?? item.taxable ?? item.subtotal ?? 0);
    const tax = Number(item.taxAmount ?? 0);
    const total = Number(item.totalAmount ?? item.total ?? 0);

    if (!isCancelled) {
      totalQty += qty;
      totalTaxable += taxable;
      totalTax += tax;
      totalAmt += total;
    }

    ws.addRow([
      sanitizeCellValue(item.billNumber),
      new Date(item.date || item.createdAt).toLocaleDateString('en-IN'),
      sanitizeCellValue(item.customerName || 'Walk-in'),
      sanitizeCellValue(item.customerGstin || '—'),
      item.saleType || 'RETAIL',
      sanitizeCellValue(item.productName),
      sanitizeCellValue(item.hsnCode || '21069099'),
      qty,
      sanitizeCellValue(item.unit || item.unitSymbol || 'Kg'),
      Number(item.unitRateSnapshot ?? item.unitRate ?? 0),
      taxable,
      Number(item.taxRate || 0),
      tax,
      total,
      item.saleStatus || item.status || 'COMPLETED',
    ]);
  });

  const totRow = ws.addRow([
    'TOTAL (Active)',
    '',
    '',
    '',
    '',
    '',
    '',
    round2(totalQty),
    '',
    '',
    round2(totalTaxable),
    '',
    round2(totalTax),
    round2(totalAmt),
    '',
  ]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 13. Statutory Returns Register Excel Export
// ============================================================
export async function exportStatutoryReturnsToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Statutory_Returns');

  addStandardHeader(ws, {
    title: 'Statutory Sales Returns Register (Credit Notes)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 9);

  const headerRow = ws.addRow([
    'Return #',
    'Date',
    'Original Bill #',
    'Customer Name',
    'GSTIN',
    'Sale Type',
    'Refund Mode',
    'Refund Amount (₹)',
    'Status',
  ]);
  styleHeaderRow(headerRow);

  let total = 0;
  const returns = Array.isArray(data.data) ? data.data : Array.isArray(data.returns) ? data.returns : [];
  returns.forEach((r: any) => {
    const refund = Number(r.totalReturnAmount ?? r.refundAmount ?? 0);
    total += refund;
    ws.addRow([
      sanitizeCellValue(r.returnNumber),
      new Date(r.date || r.createdAt).toLocaleDateString('en-IN'),
      sanitizeCellValue(r.originalBillNumber || r.billNumber || '—'),
      sanitizeCellValue(r.customerName || 'Walk-in'),
      sanitizeCellValue(r.customerGstin || '—'),
      r.saleType || r.saleTypeSnapshot || 'RETAIL',
      r.refundPaymentMode || r.refundMode || 'CASH',
      refund,
      r.status || 'COMPLETED',
    ]);
  });

  const totRow = ws.addRow(['TOTAL', '', '', '', '', '', '', round2(total), '']);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 14. Statutory GST Summary Excel Export
// ============================================================
export async function exportStatutoryGstSummaryToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('GST_Summary');

  addStandardHeader(ws, {
    title: 'Statutory GST Rate-Wise Summary Report',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
  }, 7);

  const headerRow = ws.addRow([
    'GST Rate Slab (%)',
    'Taxable Value (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'IGST (₹)',
    'Total Tax (₹)',
    'Invoice Count',
  ]);
  styleHeaderRow(headerRow);

  if (Array.isArray(data.rateSlabs)) {
    data.rateSlabs.forEach((s: any) => {
      ws.addRow([
        `${s.taxRate}%`,
        Number(s.taxableAmount || 0),
        Number(s.cgst || 0),
        Number(s.sgst || 0),
        Number(s.igst || 0),
        Number(s.totalTax || 0),
        Number(s.invoiceCount || 0),
      ]);
    });
  }

  if (data.totals) {
    const totRow = ws.addRow([
      'TOTAL',
      Number(data.totals.taxableAmount || 0),
      Number(data.totals.cgst || 0),
      Number(data.totals.sgst || 0),
      Number(data.totals.igst || 0),
      Number(data.totals.totalTax || 0),
      Number(data.totals.invoiceCount || 0),
    ]);
    styleTotalRow(totRow);
  }

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ============================================================
// 15. Cash Sales Report Excel Export (ADMIN ONLY)
// ============================================================
export async function exportCashSalesToExcel(data: any, query: any): Promise<Buffer> {
  const wb = createBaseWorkbook();
  const ws = wb.addWorksheet('Cash_Bills');

  addStandardHeader(ws, {
    title: 'Cash Sales & Cash Drawer Register (ADMIN AUDIT)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
  }, 10);

  const headerRow = ws.addRow([
    'Bill #',
    'Date & Time',
    'Customer Name',
    'Mobile',
    'Sale Type',
    'Items',
    'Subtotal (₹)',
    'Discount (₹)',
    'Net Cash (₹)',
    'Tender Paid (₹)',
    'Change (₹)',
    'Biller',
  ]);
  styleHeaderRow(headerRow);

  let totalSub = 0;
  let totalDisc = 0;
  let totalNet = 0;
  let totalPaid = 0;
  let totalChange = 0;

  const salesList = Array.isArray(data.items) ? data.items : Array.isArray(data.sales) ? data.sales : [];
  salesList.forEach((s: any) => {
    const subtotal = Number(s.subtotalAmount ?? s.subtotal ?? 0);
    const discount = Number(s.discountAmount ?? s.discount ?? 0);
    const finalTotal = Number(s.finalTotalAmount ?? s.finalTotal ?? 0);
    const paidAmount = Number(s.paidAmount ?? 0);
    const changeReturned = Number(s.changeReturned ?? 0);
    const itemsCount = Number(s.totalItemsCount ?? s.itemsCount ?? 0);
    const dateVal = s.createdAt ?? s.date;

    totalSub += subtotal;
    totalDisc += discount;
    totalNet += finalTotal;
    totalPaid += paidAmount;
    totalChange += changeReturned;

    ws.addRow([
      sanitizeCellValue(s.billNumber),
      new Date(dateVal).toLocaleString('en-IN'),
      sanitizeCellValue(s.customerName || 'Walk-in'),
      sanitizeCellValue(s.customerMobile || '—'),
      s.saleType || 'RETAIL',
      itemsCount,
      subtotal,
      discount,
      finalTotal,
      paidAmount,
      changeReturned,
      sanitizeCellValue(s.billerName || 'Staff'),
    ]);
  });

  const totRow = ws.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    round2(totalSub),
    round2(totalDisc),
    round2(totalNet),
    round2(totalPaid),
    round2(totalChange),
    '',
  ]);
  styleTotalRow(totRow);

  autoFitColumns(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
