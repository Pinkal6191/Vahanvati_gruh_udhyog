import { round2 } from './reports.utils.js';

/**
 * Pure TypeScript RFC 4180 compliant CSV cell sanitizer and generator.
 *
 * Requirements satisfied:
 * - Escapes commas, double quotes, and newlines per RFC 4180
 * - Double quotes escaped as ""
 * - UTF-8 Byte Order Mark (\uFEFF) prefixed to preserve Gujarati, Unicode, and INR symbols
 * - OWASP CSV Formula Injection protection:
 *   If a value begins with =, +, -, @ and is not a strictly standard numeric value,
 *   it is prefixed with a single quote (') to neutralize spreadsheet execution.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  let sanitized = str;

  // Formula injection mitigation (OWASP):
  // Check if string begins with formula trigger character (=, +, -, @)
  if (/^[\t\r ]*[=\+\-@]/.test(sanitized)) {
    // If it is a purely valid standard number (e.g. -100 or +50.25), spreadsheet software
    // treats it as numeric data rather than a formula command.
    // If it contains non-numeric characters (e.g. =SUM, @IMPORT, -cmd, +calc), neutralize it.
    if (!/^[+-]?\d+(\.\d+)?$/.test(sanitized.trim())) {
      sanitized = `'${sanitized}`;
    }
  }

  // RFC 4180 escaping: If cell contains comma, double quote, or newlines, wrap in quotes
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Builds an RFC 4180 compliant CSV string from headers and rows with UTF-8 BOM.
 */
export function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(h => sanitizeCsvCell(h)).join(',');
  const rowLines = rows.map(row => row.map(cell => sanitizeCsvCell(cell)).join(','));
  const content = [headerLine, ...rowLines].join('\r\n');
  return `\uFEFF${content}\r\n`;
}

/**
 * Formatter for Statutory Sales Register CSV
 */
export function statutorySalesToCsv(sales: any[]): string {
  const headers = [
    'Bill Number',
    'Date',
    'Sale Type',
    'Customer Name',
    'Customer Mobile',
    'Customer Type',
    'GSTIN',
    'Classification',
    'Subtotal (₹)',
    'Discount (₹)',
    'Taxable Amount (₹)',
    'Tax Amount (₹)',
    'Final Total (₹)',
    'Paid Amount (₹)',
    'Payment Status',
    'Payment Modes',
    'Sale Status',
    'Cancellation Reason',
    'Biller',
  ];

  const rows = sales.map((s) => {
    const isB2B = Boolean(s.customerGstinSnapshot && s.customerGstinSnapshot.trim().length > 0);
    const subtotal = Number(s.subtotalAmount);
    const discount = Number(s.discountAmount);
    const taxable = round2(subtotal - discount);
    const tax = Number(s.taxAmount);
    const finalTotal = Number(s.finalTotalAmount);
    const paid = Number(s.paidAmount);
    const pModes = Array.isArray(s.payments)
      ? Array.from(new Set(s.payments.map((p: any) => p.paymentMode))).join('; ')
      : '';
    const biller = s.user?.fullName || s.user?.username || '';
    const dateStr = s.createdAt ? new Date(s.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '';

    return [
      s.billNumber,
      dateStr,
      s.saleType,
      s.customerNameSnapshot,
      s.customerMobileSnapshot || '',
      s.customerTypeSnapshot,
      s.customerGstinSnapshot || '',
      isB2B ? 'B2B' : 'B2C',
      subtotal.toFixed(2),
      discount.toFixed(2),
      taxable.toFixed(2),
      tax.toFixed(2),
      finalTotal.toFixed(2),
      paid.toFixed(2),
      s.paymentStatus,
      pModes,
      s.saleStatus,
      s.cancellationReason || '',
      biller,
    ];
  });

  return buildCsv(headers, rows);
}

/**
 * Formatter for Statutory Itemized Sales Register CSV
 */
export function statutoryItemizedToCsv(items: any[]): string {
  const headers = [
    'Bill Number',
    'Date',
    'Sale Type',
    'Customer Name',
    'Customer Type',
    'GSTIN',
    'Classification',
    'Product Name',
    'Packing / Unit',
    'Quantity',
    'Unit Rate (₹)',
    'Subtotal (₹)',
    'Discount (₹)',
    'Total (₹)',
    'Sale Status',
    'Cancellation Reason',
  ];

  const rows = items.map((item) => {
    const sale = item.sale || {};
    const isB2B = Boolean(sale.customerGstinSnapshot && sale.customerGstinSnapshot.trim().length > 0);
    const packUnit = [item.weightOrPackSnapshot, item.unitSymbolSnapshot].filter(Boolean).join(' ');
    const dateStr = sale.createdAt ? new Date(sale.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '';

    return [
      sale.billNumber || '',
      dateStr,
      item.saleTypeSnapshot || sale.saleType || '',
      sale.customerNameSnapshot || '',
      sale.customerTypeSnapshot || '',
      sale.customerGstinSnapshot || '',
      isB2B ? 'B2B' : 'B2C',
      item.productNameSnapshot,
      packUnit,
      Number(item.quantity),
      Number(item.unitRate).toFixed(2),
      Number(item.subtotal).toFixed(2),
      Number(item.discount).toFixed(2),
      Number(item.total).toFixed(2),
      sale.saleStatus || 'COMPLETED',
      sale.cancellationReason || '',
    ];
  });

  return buildCsv(headers, rows);
}

/**
 * Formatter for Statutory Sales Returns Register CSV
 */
export function statutoryReturnsToCsv(returns: any[]): string {
  const headers = [
    'Return Number',
    'Original Bill Number',
    'Return Date',
    'Completed Date',
    'Customer Name',
    'Customer Type',
    'Sale Type',
    'Product Name',
    'Returned Quantity',
    'Unit Rate (₹)',
    'Item Refund (₹)',
    'Total Return (₹)',
    'Refund Mode',
    'Restock Condition',
    'Return Status',
    'Reason',
    'Cancellation Reason',
  ];

  const rows: any[][] = [];

  for (const ret of returns) {
    const origSale = ret.originalSale || {};
    const retDateStr = ret.createdAt ? new Date(ret.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '';
    const compDateStr = ret.completedAt ? new Date(ret.completedAt).toISOString().replace('T', ' ').substring(0, 19) : '';
    const custName = ret.customer?.name || origSale.customerNameSnapshot || '';
    const custType = origSale.customerTypeSnapshot || ret.customer?.customerType || '';

    if (ret.items && ret.items.length > 0) {
      for (const item of ret.items) {
        const prodName = item.saleItem?.productNameSnapshot || item.product?.name || 'Unknown Product';
        rows.push([
          ret.returnNumber,
          origSale.billNumber || '',
          retDateStr,
          compDateStr,
          custName,
          custType,
          ret.saleTypeSnapshot,
          prodName,
          Number(item.returnedQuantity),
          Number(item.unitRateSnapshot).toFixed(2),
          Number(item.refundAmount).toFixed(2),
          Number(ret.totalReturnAmount).toFixed(2),
          ret.refundPaymentMode,
          item.restockCondition,
          ret.status,
          ret.reason || '',
          ret.cancellationReason || '',
        ]);
      }
    } else {
      rows.push([
        ret.returnNumber,
        origSale.billNumber || '',
        retDateStr,
        compDateStr,
        custName,
        custType,
        ret.saleTypeSnapshot,
        '',
        '',
        '',
        '',
        Number(ret.totalReturnAmount).toFixed(2),
        ret.refundPaymentMode,
        '',
        ret.status,
        ret.reason || '',
        ret.cancellationReason || '',
      ]);
    }
  }

  return buildCsv(headers, rows);
}

/**
 * Formatter for GST / Tax Summary CSV
 */
export function statutoryGstSummaryToCsv(
  summary: any,
  bySaleType: Record<string, any>,
  byGstClassification: Record<string, any>
): string {
  const headers = [
    'Section',
    'Classification',
    'Completed Bills',
    'Gross Subtotal (₹)',
    'Discount (₹)',
    'Taxable Amount (₹)',
    'Tax Amount (₹)',
    'Gross Sales (₹)',
    'Completed Returns',
    'Return Amount (₹)',
    'Net Turnover (₹)',
    'Cancelled Bills',
    'Cancelled Amount (₹)',
  ];

  const rows: any[][] = [];

  // Section 1: By Commercial SaleType
  for (const [st, d] of Object.entries(bySaleType)) {
    rows.push([
      'By Commercial SaleType',
      st,
      d.billsCount,
      d.subtotalAmount.toFixed(2),
      d.discountAmount.toFixed(2),
      d.taxableAmount.toFixed(2),
      d.taxAmount.toFixed(2),
      d.finalTotalAmount.toFixed(2),
      d.returnsCount,
      d.returnAmount.toFixed(2),
      d.netAmount.toFixed(2),
      d.cancelledBillsCount,
      d.cancelledAmount.toFixed(2),
    ]);
  }

  // Section 2: By GST Classification (B2B vs B2C)
  for (const [cls, d] of Object.entries(byGstClassification)) {
    rows.push([
      'By GST Classification',
      cls,
      d.billsCount,
      d.subtotalAmount.toFixed(2),
      d.discountAmount.toFixed(2),
      d.taxableAmount.toFixed(2),
      d.taxAmount.toFixed(2),
      d.finalTotalAmount.toFixed(2),
      d.returnsCount,
      d.returnAmount.toFixed(2),
      d.netAmount.toFixed(2),
      d.cancelledBillsCount,
      d.cancelledAmount.toFixed(2),
    ]);
  }

  // Section 3: Total (Company Total / Visible Scoped Total)
  rows.push([
    summary.isScoped ? 'Visible Scoped Total' : 'Company Total',
    'ALL AUTHORIZED',
    summary.completedBills,
    summary.grossSubtotalAmount.toFixed(2),
    summary.discountAmount.toFixed(2),
    summary.taxableAmount.toFixed(2),
    summary.taxAmount.toFixed(2),
    summary.finalTotalAmount.toFixed(2),
    summary.completedReturns,
    summary.returnAmount.toFixed(2),
    summary.netFinalAmount.toFixed(2),
    summary.cancelledBills,
    summary.cancelledFinalAmount.toFixed(2),
  ]);

  return buildCsv(headers, rows);
}
