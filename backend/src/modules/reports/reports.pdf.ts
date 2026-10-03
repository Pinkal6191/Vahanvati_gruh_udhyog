import path from 'path';
import fs from 'fs';
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

function getGujaratiFonts(): { regular: string | null; bold: string | null } {
  const candidatesRegular = [
    path.resolve(process.cwd(), 'assets/fonts/NotoSansGujarati-Regular.ttf'),
    path.resolve(__dirname, '../../../../assets/fonts/NotoSansGujarati-Regular.ttf'),
    path.resolve(__dirname, '../../../assets/fonts/NotoSansGujarati-Regular.ttf'),
    path.resolve(__dirname, '../../assets/fonts/NotoSansGujarati-Regular.ttf'),
    path.resolve(__dirname, '../assets/fonts/NotoSansGujarati-Regular.ttf'),
  ];

  const candidatesBold = [
    path.resolve(process.cwd(), 'assets/fonts/NotoSansGujarati-Bold.ttf'),
    path.resolve(__dirname, '../../../../assets/fonts/NotoSansGujarati-Bold.ttf'),
    path.resolve(__dirname, '../../../assets/fonts/NotoSansGujarati-Bold.ttf'),
    path.resolve(__dirname, '../../assets/fonts/NotoSansGujarati-Bold.ttf'),
    path.resolve(__dirname, '../assets/fonts/NotoSansGujarati-Bold.ttf'),
  ];

  let regular: string | null = null;
  let bold: string | null = null;

  for (const p of candidatesRegular) {
    if (fs.existsSync(p)) {
      regular = p;
      break;
    }
  }
  for (const p of candidatesBold) {
    if (fs.existsSync(p)) {
      bold = p;
      break;
    }
  }

  return { regular, bold };
}

export class PdfBuilder {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];
  private landscape: boolean;
  private startX: number = 36;
  private currentY: number = 36;
  private maxY: number;
  public regularFont: string = 'Helvetica';
  public boldFont: string = 'Helvetica-Bold';

  constructor(options: PdfReportOptions) {
    this.landscape = Boolean(options.landscape);
    this.doc = new PDFDocument({
      size: 'A4',
      layout: this.landscape ? 'landscape' : 'portrait',
      margin: 36,
      bufferPages: true,
    });

    const fonts = getGujaratiFonts();
    if (fonts.regular) {
      try {
        this.doc.registerFont('GujaratiRegular', fonts.regular);
        this.regularFont = 'GujaratiRegular';
      } catch (err) {
        console.warn('Failed to register regular Gujarati font:', err);
      }
    }
    if (fonts.bold) {
      try {
        this.doc.registerFont('GujaratiBold', fonts.bold);
        this.boldFont = 'GujaratiBold';
      } catch (err) {
        console.warn('Failed to register bold Gujarati font:', err);
      }
    } else if (this.regularFont !== 'Helvetica') {
      this.boldFont = this.regularFont;
    }

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
    this.doc.font(this.boldFont).fontSize(16).fillColor('#1e3a8a');
    this.doc.text('VAHANVATI GRUH UDHYOG', 36, 38);

    // Subtitle / Tagline
    this.doc.font(this.regularFont).fontSize(8.5).fillColor('#64748b');
    this.doc.text('Authentic Traditional Taste & Quality  |  Business Management System', 36, 56);

    // Report Title
    this.doc.font(this.boldFont).fontSize(12).fillColor('#0f172a');
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

    this.doc.font(this.regularFont).fontSize(8).fillColor('#475569');
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
      this.doc.font(this.regularFont).fontSize(7.5).fillColor('#64748b').text(card.label.toUpperCase(), x + 6, this.currentY + 5, {
        width: cardWidth - 12,
        align: 'left',
      });
      this.doc.font(this.boldFont).fontSize(10).fillColor('#0f172a').text(String(card.value), x + 6, this.currentY + 18, {
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

    const renderHeaders = () => {
      this.doc.rect(this.startX, this.currentY, contentWidth, headerHeight).fill('#1e3a8a');
      let colX = this.startX;

      for (const col of columns) {
        this.doc.font(this.boldFont).fontSize(8).fillColor('#ffffff').text(
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
      this.doc.font(this.regularFont).fontSize(7.5);
      let maxCellHeight = 12;
      row.forEach((cellVal, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;
        const text = String(cellVal ?? '—');
        const h = this.doc.heightOfString(text, { width: col.width - 6 });
        if (h > maxCellHeight) maxCellHeight = h;
      });
      const currentRowHeight = Math.max(16, Math.ceil(maxCellHeight) + 6);

      if (this.currentY + currentRowHeight > this.maxY) {
        this.doc.addPage();
        this.currentY = 40;
        renderHeaders();
      }

      const isEven = rowIdx % 2 === 0;
      if (isEven) {
        this.doc.rect(this.startX, this.currentY, contentWidth, currentRowHeight).fill('#f8fafc');
      }

      let colX = this.startX;
      row.forEach((cellVal, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;

        this.doc.font(this.regularFont).fontSize(7.5).fillColor('#1e293b').text(
          String(cellVal ?? '—'),
          colX + 3,
          this.currentY + 4,
          { width: col.width - 6, align: col.align || 'left' }
        );
        colX += col.width;
      });

      // Bottom row divider
      this.doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(this.startX, this.currentY + currentRowHeight).lineTo(this.startX + contentWidth, this.currentY + currentRowHeight).stroke();
      this.currentY += currentRowHeight;
    });

    // Optional totals row
    if (totalRow) {
      this.doc.font(this.boldFont).fontSize(8);
      let maxTotalHeight = 14;
      totalRow.forEach((cellVal, cIdx) => {
        const col = columns[cIdx];
        if (!col) return;
        const text = String(cellVal ?? '');
        const h = this.doc.heightOfString(text, { width: col.width - 6 });
        if (h > maxTotalHeight) maxTotalHeight = h;
      });
      const totHeight = Math.max(18, Math.ceil(maxTotalHeight) + 6);

      if (this.currentY + totHeight > this.maxY) {
        this.doc.addPage();
        this.currentY = 40;
        renderHeaders();
      }

      this.doc.rect(this.startX, this.currentY, contentWidth, totHeight).fill('#e2e8f0');

      let colX = this.startX;
      let i = 0;

      // Span leading columns if totalRow[0] is TOTAL
      if (String(totalRow[0]).trim().toUpperCase() === 'TOTAL') {
        let spanWidth = columns[0]?.width || 0;
        let nextIdx = 1;
        while (nextIdx < totalRow.length && (totalRow[nextIdx] === '' || totalRow[nextIdx] === undefined || totalRow[nextIdx] === null)) {
          spanWidth += columns[nextIdx]?.width || 0;
          nextIdx++;
        }
        this.doc.font(this.boldFont).fontSize(8).fillColor('#0f172a').text(
          'TOTAL',
          colX + 4,
          this.currentY + 5,
          { width: spanWidth - 8, align: 'left' }
        );
        colX += spanWidth;
        i = nextIdx;
      }

      for (; i < totalRow.length; i++) {
        const col = columns[i];
        if (!col) continue;
        const cellVal = totalRow[i];
        if (cellVal !== '' && cellVal !== undefined && cellVal !== null) {
          this.doc.font(this.boldFont).fontSize(8).fillColor('#0f172a').text(
            String(cellVal),
            colX + 3,
            this.currentY + 5,
            { width: col.width - 6, align: col.align || 'left' }
          );
        }
        colX += col.width;
      }

      this.doc.strokeColor('#0f172a').lineWidth(1).moveTo(this.startX, this.currentY + totHeight).lineTo(this.startX + contentWidth, this.currentY + totHeight).stroke();
      this.currentY += totHeight + 8;
    }
  }

  public end(): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const pageWidth = this.landscape ? 841.89 : 595.28;
      const pageHeight = this.landscape ? 595.28 : 841.89;

      const origBottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      this.doc.font(this.regularFont).fontSize(7.5).fillColor('#94a3b8');
      this.doc.text(
        `Confidential - Internal Business Report  |  Page ${i + 1} of ${range.count}`,
        36,
        pageHeight - 20,
        { width: pageWidth - 72, align: 'center', lineBreak: false }
      );
      this.doc.page.margins.bottom = origBottom;
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
    { header: '#', width: 25, align: 'center' },
    { header: 'Code', width: 105, align: 'left' },
    { header: 'Product Name', width: 175, align: 'left' },
    { header: 'Category', width: 110, align: 'left' },
    { header: 'Unit', width: 38, align: 'center' },
    { header: 'Qty Sold', width: 62, align: 'right' },
    { header: 'Bills', width: 50, align: 'center' },
    { header: 'Avg Rate', width: 85, align: 'right' },
    { header: 'Total Revenue', width: 120, align: 'right' },
  ];

  let totalQty = 0;
  let totalRev = 0;

  const productList = Array.isArray(data.data) ? data.data : (data.products || []);
  const rows = productList.map((p: any, idx: number) => {
    const qty = Number(p.quantitySold || 0);
    const rev = Number(p.salesAmount ?? p.totalRevenue ?? 0);
    const avgRate = Number(p.averageSellingRate ?? p.averagePrice ?? (qty > 0 ? rev / qty : 0));
    totalQty += qty;
    totalRev += rev;
    return [
      idx + 1,
      p.productCode || p.code || '',
      p.productName || '',
      p.categoryName || '—',
      p.unitSymbol || p.primaryUnit || 'pc',
      qty,
      p.billsCount || 0,
      formatCurrencyVal(avgRate),
      formatCurrencyVal(rev),
    ];
  });

  if (data.summary?.totalQuantitySold !== undefined) totalQty = data.summary.totalQuantitySold;
  if (data.summary?.totalRevenue !== undefined) totalRev = data.summary.totalRevenue;

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

  const customerList = Array.isArray(data.data) ? data.data : (data.customers || []);
  const rows = customerList.map((c: any, idx: number) => {
    const purchases = Number(c.totalPurchases || 0);
    const bills = Number(c.billsCount ?? c.totalBills ?? 0);
    totalSpend += purchases;
    totalBills += bills;
    return [
      idx + 1,
      c.customerName || c.name || 'Walk-in Customer',
      c.mobile || '—',
      c.city || '—',
      c.customerType || 'INDIAN',
      bills,
      formatCurrencyVal(c.averageBillValue ?? (bills > 0 ? purchases / bills : 0)),
      c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('en-IN') : '—',
      formatCurrencyVal(purchases),
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
  const salesList = Array.isArray(data.data) ? data.data : (data.sales || []);
  const rows = salesList.map((s: any) => {
    const amt = Number(s.finalTotalAmount ?? s.totalAmount ?? 0);
    total += amt;
    const paymentModesStr = s.payments
      ? s.payments.map((p: any) => p.paymentMode).join(', ')
      : (Array.isArray(s.paymentModes) ? s.paymentModes.join(', ') : 'CASH');
    return [
      s.billNumber,
      new Date(s.createdAt || s.date).toLocaleString('en-IN'),
      s.saleType || 'RETAIL',
      paymentModesStr,
      s.totalItemsCount ?? s.itemsCount ?? 0,
      formatCurrencyVal(amt),
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
  const batchList = Array.isArray(data.productBreakdown)
    ? data.productBreakdown
    : (Array.isArray(data.batches) ? data.batches : (data.data || []));
  const rows = batchList.map((b: any) => {
    const qty = Number(b.completedQuantity ?? b.quantity ?? 0);
    totalQty += qty;
    return [
      b.batchNumber || b.productCode || '—',
      b.date ? new Date(b.date).toLocaleDateString('en-IN') : (data.summary?.period ? String(data.summary.period) : '—'),
      b.productName || '',
      qty,
      b.unit || 'Kg',
      b.status || 'COMPLETED',
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

  const stockList = Array.isArray(data.data) ? data.data : (data.stock || []);
  const rows = stockList.map((s: any, idx: number) => {
    const bal = Number(s.currentBalance || 0);
    const val = Number(s.stockValue || 0);
    totalBal += bal;
    totalVal += val;
    return [
      idx + 1,
      s.productCode || s.code || '',
      s.productName || '',
      s.categoryName || '—',
      bal,
      s.minimumThreshold ?? 0,
      s.unitSymbol || s.unit || 'Kg',
      s.stockStatus || s.status || 'IN_STOCK',
      formatCurrencyVal(val),
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

  const movementList = Array.isArray(data.data) ? data.data : (data.movements || []);
  const rows = movementList.map((m: any, idx: number) => [
    idx + 1,
    new Date(m.createdAt || m.date).toLocaleString('en-IN'),
    m.product?.name || m.productName || '',
    m.movementType,
    m.referenceType || '—',
    Number(m.quantityDelta || 0) > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
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

  const recList = Array.isArray(data.data) ? data.data : (data.items || []);
  const rows = recList.map((item: any, idx: number) => [
    idx + 1,
    item.productCode || item.code || '',
    item.productName || '',
    item.categoryName || '—',
    item.cachedBalance ?? item.theoreticalBalance ?? 0,
    item.ledgerTotal ?? item.physicalCount ?? item.theoreticalBalance ?? 0,
    item.discrepancy ?? item.difference ?? 0,
    item.unit || 'Kg',
    (item.discrepancy === 0 || item.isConsistent) ? 'MATCHED' : 'DISCREPANCY',
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
  const returnList = Array.isArray(data.returns)
    ? data.returns
    : (Array.isArray(data.data) ? data.data : (data.productBreakdown || []));
  const rows = returnList.map((r: any) => {
    const refundAmt = Number(r.refundAmount || 0);
    total += refundAmt;
    return [
      r.returnNumber || '—',
      r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—',
      r.billNumber || '—',
      r.customerName || 'Walk-in',
      r.refundPaymentMode || r.refundMode || 'CASH',
      formatCurrencyVal(refundAmt),
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
