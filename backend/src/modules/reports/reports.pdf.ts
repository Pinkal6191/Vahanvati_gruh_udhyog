import PDFDocument from 'pdfkit';
import { round2 } from './reports.utils.js';

interface ColumnDef {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

interface PdfReportOptions {
  title: string;
  period?: string;
  scope?: string;
  landscape?: boolean;
  extraMeta?: Record<string, string>;
}

function formatCurrencyVal(val: number): string {
  return `Rs. ${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export class PdfBuilder {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];
  private landscape: boolean;
  private startX: number = 36;
  private currentY: number = 36;
  private maxY: number;

  constructor(options: PdfReportOptions) {
    this.landscape = Boolean(options.landscape);
    this.doc = new PDFDocument({
      size: 'A4',
      layout: this.landscape ? 'landscape' : 'portrait',
      margin: 36,
      bufferPages: true,
    });

    this.maxY = this.landscape ? 540 : 770;
    this.doc.on('data', (chunk) => this.chunks.push(chunk));

    this.drawHeader(options);
  }

  private drawHeader(options: PdfReportOptions) {
    const pageWidth = this.landscape ? 841.89 : 595.28;
    const contentWidth = pageWidth - 72;

    // Header Background Accent Bar
    this.doc.rect(36, 28, contentWidth, 3).fill('#1e3a8a');

    // Title: Vahanvati Gruh Udhyog
    this.doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a8a');
    this.doc.text('VAHANVATI GRUH UDHYOG', 36, 38);

    // Subtitle / Tagline
    this.doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
    this.doc.text('Authentic Traditional Taste & Quality  |  Business Management System', 36, 56);

    // Report Title
    this.doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
    this.doc.text(options.title.toUpperCase(), 36, 70);

    // Meta: Period, Scope, Timestamp
    const metaParts = [];
    if (options.period) metaParts.push(`Period: ${options.period}`);
    if (options.scope) metaParts.push(`Scope: ${options.scope}`);
    metaParts.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
    if (options.extraMeta) {
      for (const [k, v] of Object.entries(options.extraMeta)) {
        metaParts.push(`${k}: ${v}`);
      }
    }

    this.doc.font('Helvetica').fontSize(8).fillColor('#475569');
    this.doc.text(metaParts.join('   |   '), 36, 85);

    // Divider
    this.doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(36, 97).lineTo(36 + contentWidth, 97).stroke();

    this.currentY = 105;
  }

  public drawSummaryCards(cards: Array<{ label: string; value: string | number }>) {
    const cardWidth = this.landscape ? 140 : 120;
    const cardHeight = 36;
    let x = this.startX;

    for (const card of cards) {
      if (x + cardWidth > (this.landscape ? 805 : 559)) {
        x = this.startX;
        this.currentY += cardHeight + 8;
      }

      this.doc.rect(x, this.currentY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#cbd5e1');
      this.doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(card.label.toUpperCase(), x + 6, this.currentY + 5, {
        width: cardWidth - 12,
        align: 'left',
      });
      this.doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(String(card.value), x + 6, this.currentY + 18, {
        width: cardWidth - 12,
        align: 'left',
      });

      x += cardWidth + 8;
    }

    this.currentY += cardHeight + 14;
  }

  public drawTable(columns: ColumnDef[], rows: any[][], totalRow?: any[]) {
    const contentWidth = (this.landscape ? 841.89 : 595.28) - 72;
    const headerHeight = 20;
    const rowHeight = 16;

    const renderHeaders = () => {
      this.doc.rect(this.startX, this.currentY, contentWidth, headerHeight).fill('#1e3a8a');
      let colX = this.startX;

      for (const col of columns) {
        this.doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(
          col.header,
          colX + 3,
          this.currentY + 6,
          { width: col.width - 6, align: col.align || 'left', lineBreak: false }
        );
        colX += col.width;
      }
      this.currentY += headerHeight;
    };

    renderHeaders();

    // Data rows
    rows.forEach((row, rowIdx) => {
      if (this.currentY + rowHeight > this.maxY) {
        this.doc.addPage();
        this.currentY = 40;
        renderHeaders();
      }

      const isEven = rowIdx % 2 === 0;
      if (isEven) {
        this.doc.rect(this.startX, this.currentY, contentWidth, rowHeight).fill('#f8fafc');
      }

      let colX = this.startX;
      row.forEach((cellVal, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;

        this.doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b').text(
          String(cellVal ?? '—'),
          colX + 3,
          this.currentY + 4,
          { width: col.width - 6, align: col.align || 'left', lineBreak: false }
        );
        colX += col.width;
      });

      // Bottom row divider
      this.doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(this.startX, this.currentY + rowHeight).lineTo(this.startX + contentWidth, this.currentY + rowHeight).stroke();
      this.currentY += rowHeight;
    });

    // Optional totals row
    if (totalRow) {
      if (this.currentY + rowHeight > this.maxY) {
        this.doc.addPage();
        this.currentY = 40;
        renderHeaders();
      }

      this.doc.rect(this.startX, this.currentY, contentWidth, rowHeight).fill('#e2e8f0');
      let colX = this.startX;
      totalRow.forEach((cellVal, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;

        this.doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(
          String(cellVal ?? ''),
          colX + 3,
          this.currentY + 4,
          { width: col.width - 6, align: col.align || 'left', lineBreak: false }
        );
        colX += col.width;
      });

      this.doc.strokeColor('#0f172a').lineWidth(1).moveTo(this.startX, this.currentY + rowHeight).lineTo(this.startX + contentWidth, this.currentY + rowHeight).stroke();
      this.currentY += rowHeight + 8;
    }
  }

  public end(): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const pageWidth = this.landscape ? 841.89 : 595.28;
      const pageHeight = this.landscape ? 595.28 : 841.89;

      this.doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8');
      this.doc.text(
        `Confidential - Internal Business Report  |  Page ${i + 1} of ${range.count}`,
        36,
        pageHeight - 26,
        { width: pageWidth - 72, align: 'center' }
      );
    }

    this.doc.end();

    return new Promise((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });
  }
}

// ============================================================
// Report-Specific PDF Exporters
// ============================================================

export async function exportSalesReportToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Sales Summary & Trends Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: false,
  });

  builder.drawSummaryCards([
    { label: 'Total Net Sales', value: formatCurrencyVal(data.summary?.totalSalesAmount) },
    { label: 'Completed Bills', value: data.summary?.completedBillsCount || 0 },
    { label: 'Avg Bill Value', value: formatCurrencyVal(data.summary?.averageBillValue) },
    { label: 'Qty Sold', value: data.summary?.totalQuantitySold || 0 },
  ]);

  const columns: ColumnDef[] = [
    { header: 'Period / Date', width: 140, align: 'left' },
    { header: 'Bills', width: 80, align: 'center' },
    { header: 'Qty Sold', width: 100, align: 'center' },
    { header: 'Net Sales Amount', width: 200, align: 'right' },
  ];

  const rows = (data.timeSeries || []).map((ts: any) => [
    ts.periodKey,
    ts.billsCount,
    ts.quantitySold,
    formatCurrencyVal(ts.salesAmount),
  ]);

  const totalRow = [
    'TOTAL',
    data.summary?.completedBillsCount || 0,
    data.summary?.totalQuantitySold || 0,
    formatCurrencyVal(data.summary?.totalSalesAmount),
  ];

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportProductSalesReportToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Product Sales Performance Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: '#', width: 30, align: 'center' },
    { header: 'Code', width: 60, align: 'left' },
    { header: 'Product Name', width: 180, align: 'left' },
    { header: 'Category', width: 100, align: 'left' },
    { header: 'Unit', width: 50, align: 'center' },
    { header: 'Qty Sold', width: 70, align: 'right' },
    { header: 'Bills', width: 60, align: 'center' },
    { header: 'Avg Rate', width: 80, align: 'right' },
    { header: 'Total Revenue', width: 130, align: 'right' },
  ];

  let totalQty = 0;
  let totalRev = 0;

  const rows = (data.products || []).map((p: any, idx: number) => {
    totalQty += Number(p.quantitySold || 0);
    totalRev += Number(p.totalRevenue || 0);
    return [
      idx + 1,
      p.code || '',
      p.productName || '',
      p.categoryName || '—',
      p.primaryUnit || 'pc',
      p.quantitySold || 0,
      p.billsCount || 0,
      formatCurrencyVal(p.averagePrice),
      formatCurrencyVal(p.totalRevenue),
    ];
  });

  const totalRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    round2(totalQty),
    '',
    '',
    formatCurrencyVal(totalRev),
  ];

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportCustomerSalesReportToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Customer Sales & Spending Report',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: '#', width: 30, align: 'center' },
    { header: 'Customer Name', width: 180, align: 'left' },
    { header: 'Mobile', width: 90, align: 'left' },
    { header: 'City', width: 90, align: 'left' },
    { header: 'Type', width: 70, align: 'center' },
    { header: 'Bills', width: 60, align: 'center' },
    { header: 'Avg Bill', width: 90, align: 'right' },
    { header: 'Last Visit', width: 70, align: 'center' },
    { header: 'Total Purchases', width: 80, align: 'right' },
  ];

  let totalSpend = 0;
  let totalBills = 0;

  const rows = (data.customers || []).map((c: any, idx: number) => {
    totalSpend += Number(c.totalPurchases || 0);
    totalBills += Number(c.totalBills || 0);
    return [
      idx + 1,
      c.name || 'Walk-in Customer',
      c.mobile || '—',
      c.city || '—',
      c.customerType || 'INDIAN',
      c.totalBills || 0,
      formatCurrencyVal(c.averageBillValue),
      c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('en-IN') : '—',
      formatCurrencyVal(c.totalPurchases),
    ];
  });

  const totalRow = ['TOTAL', '', '', '', '', totalBills, '', '', formatCurrencyVal(totalSpend)];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportCustomerHistoryToPdf(data: any, _query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: `Customer Purchase History - ${data.customer?.name || 'Customer'}`,
    extraMeta: {
      Mobile: data.customer?.mobile || '—',
      City: data.customer?.city || '—',
    },
    landscape: false,
  });

  const columns: ColumnDef[] = [
    { header: 'Bill Number', width: 110, align: 'left' },
    { header: 'Date & Time', width: 110, align: 'left' },
    { header: 'Sale Type', width: 80, align: 'center' },
    { header: 'Payment Mode', width: 90, align: 'center' },
    { header: 'Items', width: 40, align: 'center' },
    { header: 'Total (Rs.)', width: 90, align: 'right' },
  ];

  let total = 0;
  const rows = (data.sales || []).map((s: any) => {
    total += Number(s.totalAmount || 0);
    return [
      s.billNumber,
      new Date(s.date).toLocaleString('en-IN'),
      s.saleType,
      Array.isArray(s.paymentModes) ? s.paymentModes.join(', ') : 'CASH',
      s.itemsCount || 0,
      formatCurrencyVal(s.totalAmount),
    ];
  });

  const totalRow = ['TOTAL', '', '', '', '', formatCurrencyVal(total)];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportProductionReportToPdf(data: any, _query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Kitchen Production & Batch Report',
    period: data.summary?.period,
    landscape: false,
  });

  const columns: ColumnDef[] = [
    { header: 'Batch #', width: 90, align: 'left' },
    { header: 'Date', width: 70, align: 'left' },
    { header: 'Product Name', width: 180, align: 'left' },
    { header: 'Quantity', width: 60, align: 'right' },
    { header: 'Unit', width: 40, align: 'center' },
    { header: 'Status', width: 80, align: 'center' },
  ];

  let totalQty = 0;
  const rows = (data.batches || []).map((b: any) => {
    totalQty += Number(b.quantity || 0);
    return [
      b.batchNumber,
      new Date(b.date).toLocaleDateString('en-IN'),
      b.productName || '',
      b.quantity || 0,
      b.unit || 'Kg',
      b.status,
    ];
  });

  const totalRow = ['TOTAL', '', '', round2(totalQty), '', ''];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportStockReportToPdf(data: any, _query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Inventory Balance & Valuation Report',
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: '#', width: 30, align: 'center' },
    { header: 'Code', width: 60, align: 'left' },
    { header: 'Product Name', width: 220, align: 'left' },
    { header: 'Category', width: 110, align: 'left' },
    { header: 'Balance', width: 70, align: 'right' },
    { header: 'Min Level', width: 70, align: 'right' },
    { header: 'Unit', width: 40, align: 'center' },
    { header: 'Status', width: 80, align: 'center' },
    { header: 'Stock Value', width: 80, align: 'right' },
  ];

  let totalVal = 0;
  let totalBal = 0;

  const rows = (data.stock || []).map((s: any, idx: number) => {
    totalBal += Number(s.currentBalance || 0);
    totalVal += Number(s.stockValue || 0);
    return [
      idx + 1,
      s.code || '',
      s.productName || '',
      s.categoryName || '—',
      s.currentBalance || 0,
      s.minimumThreshold || 0,
      s.unit || 'Kg',
      s.status,
      formatCurrencyVal(s.stockValue),
    ];
  });

  const totalRow = ['TOTAL', '', '', '', round2(totalBal), '', '', '', formatCurrencyVal(totalVal)];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportStockMovementsToPdf(data: any, _query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Inventory Movement & Audit Ledger',
    period: data.summary?.period,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: '#', width: 30, align: 'center' },
    { header: 'Date & Time', width: 110, align: 'left' },
    { header: 'Product Name', width: 180, align: 'left' },
    { header: 'Type', width: 90, align: 'center' },
    { header: 'Ref Type', width: 80, align: 'center' },
    { header: 'Delta', width: 60, align: 'right' },
    { header: 'Balance', width: 60, align: 'right' },
    { header: 'Unit', width: 40, align: 'center' },
    { header: 'User', width: 110, align: 'left' },
  ];

  const rows = (data.movements || []).map((m: any, idx: number) => [
    idx + 1,
    new Date(m.date).toLocaleString('en-IN'),
    m.productName || '',
    m.movementType,
    m.referenceType || '—',
    m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
    m.balanceAfter,
    m.unit || 'Kg',
    m.user?.fullName || m.user?.username || 'System',
  ]);

  builder.drawTable(columns, rows);
  return builder.end();
}

export async function exportStockReconciliationToPdf(data: any, _query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Stock Audit & Reconciliation Variance Report',
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: '#', width: 30, align: 'center' },
    { header: 'Code', width: 60, align: 'left' },
    { header: 'Product Name', width: 220, align: 'left' },
    { header: 'Category', width: 110, align: 'left' },
    { header: 'System Bal', width: 75, align: 'right' },
    { header: 'Physical', width: 75, align: 'right' },
    { header: 'Variance', width: 75, align: 'right' },
    { header: 'Unit', width: 40, align: 'center' },
    { header: 'Audit Status', width: 75, align: 'center' },
  ];

  const rows = (data.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.code || '',
    item.productName || '',
    item.categoryName || '—',
    item.theoreticalBalance || 0,
    item.physicalCount ?? item.theoreticalBalance ?? 0,
    item.discrepancy || 0,
    item.unit || 'Kg',
    item.discrepancy === 0 ? 'MATCHED' : 'DISCREPANCY',
  ]);

  builder.drawTable(columns, rows);
  return builder.end();
}

export async function exportReturnsReportToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Sales Returns & Refunds Register',
    period: data.summary?.period,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: false,
  });

  const columns: ColumnDef[] = [
    { header: 'Return #', width: 90, align: 'left' },
    { header: 'Date', width: 70, align: 'left' },
    { header: 'Bill #', width: 80, align: 'left' },
    { header: 'Customer', width: 110, align: 'left' },
    { header: 'Mode', width: 60, align: 'center' },
    { header: 'Refund (Rs.)', width: 110, align: 'right' },
  ];

  let total = 0;
  const rows = (data.returns || []).map((r: any) => {
    total += Number(r.refundAmount || 0);
    return [
      r.returnNumber,
      new Date(r.date).toLocaleDateString('en-IN'),
      r.billNumber || '—',
      r.customerName || 'Walk-in',
      r.refundMode || 'CASH',
      formatCurrencyVal(r.refundAmount),
    ];
  });

  const totalRow = ['TOTAL', '', '', '', '', formatCurrencyVal(total)];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportBusinessSummaryToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Executive Business Summary Dashboard',
    period: query.period || 'today',
    scope: data.scope?.scopeLabel || (query.saleType ? `SaleType: ${query.saleType}` : undefined),
    landscape: false,
  });

  builder.drawSummaryCards([
    { label: 'Total Revenue', value: formatCurrencyVal(data.today?.sales || 0) },
    { label: 'Total Invoices', value: data.today?.bills || 0 },
    { label: 'Total Refunds', value: formatCurrencyVal(data.today?.returns || 0) },
    { label: 'Production Batches', value: data.today?.production || 0 },
  ]);

  // Payment Breakdown Table
  const columns: ColumnDef[] = [
    { header: 'Channel / Payment Mode', width: 250, align: 'left' },
    { header: 'Total Collected (Rs.)', width: 270, align: 'right' },
  ];

  const rows: any[][] = [];
  const pb = data.paymentModes || data.paymentBreakdown || {};
  let totalPay = 0;
  for (const [mode, amt] of Object.entries(pb)) {
    totalPay += Number(amt || 0);
    rows.push([mode, formatCurrencyVal(Number(amt || 0))]);
  }

  const totalRow = ['TOTAL', formatCurrencyVal(totalPay)];
  builder.drawTable(columns, rows, totalRow);

  return builder.end();
}

export async function exportStatutorySalesToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Statutory Sales Register (CA / GST Compliance)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: 'Invoice #', width: 75, align: 'left' },
    { header: 'Date', width: 55, align: 'left' },
    { header: 'Customer', width: 110, align: 'left' },
    { header: 'GSTIN', width: 85, align: 'left' },
    { header: 'Type', width: 50, align: 'center' },
    { header: 'Taxable (Rs.)', width: 75, align: 'right' },
    { header: 'CGST (Rs.)', width: 65, align: 'right' },
    { header: 'SGST (Rs.)', width: 65, align: 'right' },
    { header: 'Tax (Rs.)', width: 65, align: 'right' },
    { header: 'Grand Total', width: 75, align: 'right' },
    { header: 'Status', width: 50, align: 'center' },
  ];

  let totalTaxable = 0;
  let totalTax = 0;
  let totalNet = 0;

  const invoiceList = Array.isArray(data.data) ? data.data : (data.invoices || []);
  const rows = invoiceList.map((inv: any) => {
    const status = inv.saleStatus ?? inv.status ?? 'COMPLETED';
    const taxable = Number(inv.taxableAmount ?? inv.taxable ?? 0);
    const cgst = Number(inv.cgstAmount ?? inv.cgst ?? 0);
    const sgst = Number(inv.sgstAmount ?? inv.sgst ?? 0);
    const tTax = Number(inv.taxAmount ?? inv.totalTax ?? (cgst + sgst));
    const grandTotal = Number(inv.finalTotalAmount ?? inv.grandTotal ?? (taxable + tTax));

    if (status !== 'CANCELLED') {
      totalTaxable += taxable;
      totalTax += tTax;
      totalNet += grandTotal;
    }
    return [
      inv.billNumber,
      new Date(inv.date).toLocaleDateString('en-IN'),
      inv.customerName || 'Walk-in',
      inv.customerGstin || '—',
      inv.saleType || 'RETAIL',
      formatCurrencyVal(taxable),
      formatCurrencyVal(cgst),
      formatCurrencyVal(sgst),
      formatCurrencyVal(tTax),
      formatCurrencyVal(grandTotal),
      status,
    ];
  });

  const totalRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    formatCurrencyVal(totalTaxable),
    '',
    '',
    formatCurrencyVal(totalTax),
    formatCurrencyVal(totalNet),
    '',
  ];

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportStatutoryItemizedToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Statutory Itemized Sales Register (Line-Level GST)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: 'Invoice #', width: 75, align: 'left' },
    { header: 'Date', width: 55, align: 'left' },
    { header: 'Customer', width: 100, align: 'left' },
    { header: 'Product Name', width: 140, align: 'left' },
    { header: 'HSN', width: 55, align: 'center' },
    { header: 'Qty', width: 45, align: 'right' },
    { header: 'Taxable', width: 65, align: 'right' },
    { header: 'GST%', width: 45, align: 'center' },
    { header: 'Tax Amt', width: 60, align: 'right' },
    { header: 'Total (Rs.)', width: 80, align: 'right' },
  ];

  let totalTaxable = 0;
  let totalTax = 0;
  let totalAmt = 0;

  const itemList = Array.isArray(data.data) ? data.data : (data.items || []);
  const rows = itemList.map((item: any) => {
    const status = item.saleStatus ?? item.status ?? 'COMPLETED';
    const taxable = Number(item.taxableAmount ?? item.taxable ?? 0);
    const taxAmt = Number(item.taxAmount ?? 0);
    const totalAmount = Number(item.totalAmount ?? (taxable + taxAmt));

    if (status !== 'CANCELLED') {
      totalTaxable += taxable;
      totalTax += taxAmt;
      totalAmt += totalAmount;
    }
    return [
      item.billNumber,
      new Date(item.date).toLocaleDateString('en-IN'),
      item.customerName || 'Walk-in',
      item.productName,
      item.hsnCode || '21069099',
      item.quantity,
      formatCurrencyVal(taxable),
      `${item.taxRate}%`,
      formatCurrencyVal(taxAmt),
      formatCurrencyVal(totalAmount),
    ];
  });

  const totalRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    formatCurrencyVal(totalTaxable),
    '',
    formatCurrencyVal(totalTax),
    formatCurrencyVal(totalAmt),
  ];

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportStatutoryReturnsToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Statutory Sales Returns Register (Credit Notes)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: false,
  });

  const columns: ColumnDef[] = [
    { header: 'Return #', width: 90, align: 'left' },
    { header: 'Date', width: 65, align: 'left' },
    { header: 'Original Bill #', width: 85, align: 'left' },
    { header: 'Customer', width: 110, align: 'left' },
    { header: 'Refund Mode', width: 75, align: 'center' },
    { header: 'Refund Amount', width: 95, align: 'right' },
  ];

  let total = 0;
  const returnList = Array.isArray(data.data) ? data.data : (data.returns || []);
  const rows = returnList.map((r: any) => {
    const refundAmount = Number(r.totalReturnAmount ?? r.refundAmount ?? 0);
    const refundMode = r.refundPaymentMode ?? r.refundMode ?? 'CASH';
    total += refundAmount;
    return [
      r.returnNumber,
      new Date(r.date).toLocaleDateString('en-IN'),
      r.originalBillNumber || '—',
      r.customerName || 'Walk-in',
      refundMode,
      formatCurrencyVal(refundAmount),
    ];
  });

  const totalRow = ['TOTAL', '', '', '', '', formatCurrencyVal(total)];
  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportStatutoryGstSummaryToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Statutory GST Rate-Wise Summary Report',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    landscape: false,
  });

  const columns: ColumnDef[] = [
    { header: 'GST Rate Slab', width: 90, align: 'center' },
    { header: 'Taxable Value', width: 95, align: 'right' },
    { header: 'CGST', width: 80, align: 'right' },
    { header: 'SGST', width: 80, align: 'right' },
    { header: 'Total Tax', width: 90, align: 'right' },
    { header: 'Invoices', width: 85, align: 'center' },
  ];

  const rows = (data.rateSlabs || []).map((s: any) => [
    `${s.taxRate}%`,
    formatCurrencyVal(s.taxableAmount),
    formatCurrencyVal(s.cgst),
    formatCurrencyVal(s.sgst),
    formatCurrencyVal(s.totalTax),
    s.invoiceCount || 0,
  ]);

  const totalRow = data.totals
    ? [
        'TOTAL',
        formatCurrencyVal(data.totals.taxableAmount),
        formatCurrencyVal(data.totals.cgst),
        formatCurrencyVal(data.totals.sgst),
        formatCurrencyVal(data.totals.totalTax),
        data.totals.invoiceCount || 0,
      ]
    : undefined;

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}

export async function exportCashSalesToPdf(data: any, query: any): Promise<Buffer> {
  const builder = new PdfBuilder({
    title: 'Cash Sales & Cash Drawer Register (ADMIN AUDIT)',
    period: query.period || `${query.startDate || ''} to ${query.endDate || ''}`,
    scope: query.saleType ? `SaleType: ${query.saleType}` : undefined,
    landscape: true,
  });

  const columns: ColumnDef[] = [
    { header: 'Bill #', width: 85, align: 'left' },
    { header: 'Date & Time', width: 110, align: 'left' },
    { header: 'Customer', width: 110, align: 'left' },
    { header: 'Mobile', width: 80, align: 'left' },
    { header: 'Type', width: 55, align: 'center' },
    { header: 'Items', width: 45, align: 'center' },
    { header: 'Net Cash (Rs.)', width: 95, align: 'right' },
    { header: 'Tender Paid', width: 95, align: 'right' },
    { header: 'Biller', width: 95, align: 'left' },
  ];

  let totalNet = 0;
  let totalPaid = 0;

  const salesList = Array.isArray(data.items) ? data.items : Array.isArray(data.sales) ? data.sales : [];
  const rows = salesList.map((s: any) => {
    const finalTotal = Number(s.finalTotalAmount ?? s.finalTotal ?? 0);
    const paidAmount = Number(s.paidAmount ?? 0);
    const itemsCount = Number(s.totalItemsCount ?? s.itemsCount ?? 0);
    const dateVal = s.createdAt ?? s.date;

    totalNet += finalTotal;
    totalPaid += paidAmount;
    return [
      s.billNumber,
      new Date(dateVal).toLocaleString('en-IN'),
      s.customerName || 'Walk-in',
      s.customerMobile || '—',
      s.saleType || 'RETAIL',
      itemsCount,
      formatCurrencyVal(finalTotal),
      formatCurrencyVal(paidAmount),
      s.billerName || 'Staff',
    ];
  });

  const totalRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    formatCurrencyVal(totalNet),
    formatCurrencyVal(totalPaid),
    '',
  ];

  builder.drawTable(columns, rows, totalRow);
  return builder.end();
}
