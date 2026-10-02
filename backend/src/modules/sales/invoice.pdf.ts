import PDFDocument from 'pdfkit';

export function formatAmountInWords(amount: number): string {
  if (!amount || amount === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num: number): string {
    if (num === 0) return '';
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : ' ');
    if (num < 1000) return inWords(Math.floor(num / 100)) + 'Hundred ' + inWords(num % 100);
    if (num < 100000) return inWords(Math.floor(num / 1000)) + 'Thousand ' + inWords(num % 1000);
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + 'Lakh ' + inWords(num % 100000);
    return inWords(Math.floor(num / 10000000)) + 'Crore ' + inWords(num % 10000000);
  }

  const whole = Math.floor(Math.abs(amount));
  const fraction = Math.round((Math.abs(amount) - whole) * 100);

  let words = 'Rupees ' + inWords(whole).trim();
  if (fraction > 0) {
    words += ' and ' + inWords(fraction).trim() + ' Paise';
  }
  return words + ' Only';
}

function formatRs(num: number): string {
  return `Rs. ${Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateWholesaleInvoicePdf(payload: any): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  const contentWidth = 595.28 - 72; // 523.28
  const startX = 36;
  let currentY = 36;

  // 1. Top Decorative Bar
  doc.rect(startX, currentY, contentWidth, 3).fill('#1e3a8a');
  currentY += 8;

  // 2. Company Details (Left) vs Invoice Details (Right)
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a8a').text(payload.company.name.toUpperCase(), startX, currentY);
  currentY += 18;

  doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
  if (payload.company.tagline) {
    doc.text(payload.company.tagline, startX, currentY);
    currentY += 12;
  }
  if (payload.company.address) {
    doc.text(payload.company.address, startX, currentY, { width: 300 });
    currentY += 12;
  }
  const companyMeta: string[] = [];
  if (payload.company.phone) companyMeta.push(`Phone: ${payload.company.phone}`);
  if (payload.company.gstin) companyMeta.push(`GSTIN: ${payload.company.gstin}`);
  if (payload.company.fssaiLicense) companyMeta.push(`FSSAI: ${payload.company.fssaiLicense}`);
  doc.text(companyMeta.join('  |  '), startX, currentY);

  // Right Side Doc Badge & Metadata
  const rightX = 350;
  const docBadgeY = 44;
  doc.rect(rightX, docBadgeY, contentWidth - (rightX - startX), 18).fill('#1e3a8a');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('WHOLESALE TAX INVOICE', rightX, docBadgeY + 4, {
    width: contentWidth - (rightX - startX),
    align: 'center',
  });

  doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
  doc.text(`Invoice No:`, rightX, docBadgeY + 24);
  doc.font('Helvetica-Bold').text(payload.invoice.billNumber, rightX + 60, docBadgeY + 24);

  doc.font('Helvetica').text(`Date:`, rightX, docBadgeY + 36);
  doc.text(new Date(payload.invoice.date).toLocaleString('en-IN'), rightX + 60, docBadgeY + 36);

  doc.text(`Biller:`, rightX, docBadgeY + 48);
  doc.text(payload.invoice.billerName, rightX + 60, docBadgeY + 48);

  currentY = Math.max(currentY + 20, 116);
  doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
  currentY += 8;

  // 3. Buyer & Payment Cards (2-column box)
  const cardW = (contentWidth - 12) / 2;
  const cardH = 64;

  // Buyer Card
  doc.rect(startX, currentY, cardW, cardH).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a8a').text('BILLED TO (BUYER DETAILS)', startX + 8, currentY + 6);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(payload.invoice.customerName || 'Counter Walk-in Customer', startX + 8, currentY + 18);
  doc.font('Helvetica').fontSize(8).fillColor('#475569');
  let buyerSub = '';
  if (payload.invoice.customerAddress) buyerSub += payload.invoice.customerAddress;
  if (payload.invoice.customerCity) buyerSub += `, ${payload.invoice.customerCity}`;
  doc.text(buyerSub || 'Local Client', startX + 8, currentY + 30, { width: cardW - 16 });
  const buyerMeta = [];
  if (payload.invoice.customerMobile) buyerMeta.push(`Mobile: +91 ${payload.invoice.customerMobile}`);
  if (payload.invoice.customerGstin) buyerMeta.push(`GSTIN: ${payload.invoice.customerGstin}`);
  doc.text(buyerMeta.join('  |  '), startX + 8, currentY + 44);

  // Payment Settlement Card
  const payX = startX + cardW + 12;
  doc.rect(payX, currentY, cardW, cardH).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a8a').text('PAYMENT & SETTLEMENT', payX + 8, currentY + 6);
  doc.font('Helvetica').fontSize(8).fillColor('#334155');
  const modes = payload.payments.map((p: any) => p.mode).join(', ') || 'CASH';
  doc.text(`Payment Mode:`, payX + 8, currentY + 18);
  doc.font('Helvetica-Bold').text(modes, payX + 80, currentY + 18);

  doc.font('Helvetica').text(`Paid Amount:`, payX + 8, currentY + 30);
  doc.font('Helvetica-Bold').text(formatRs(payload.totals.paid), payX + 80, currentY + 30);

  if (payload.totals.change > 0) {
    doc.font('Helvetica').text(`Change Returned:`, payX + 8, currentY + 42);
    doc.text(formatRs(payload.totals.change), payX + 80, currentY + 42);
  }

  currentY += cardH + 12;

  // 4. Items Table
  const cols = [
    { header: '#', width: 25, align: 'center' as const },
    { header: 'Description of Goods', width: 200, align: 'left' as const },
    { header: 'Unit', width: 45, align: 'center' as const },
    { header: 'Qty', width: 45, align: 'right' as const },
    { header: 'Rate (Rs.)', width: 65, align: 'right' as const },
    { header: 'Disc (Rs.)', width: 65, align: 'right' as const },
    { header: 'Total (Rs.)', width: 78.28, align: 'right' as const },
  ];

  // Table Header
  doc.rect(startX, currentY, contentWidth, 18).fill('#1e3a8a');
  let colX = startX;
  for (const c of cols) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(c.header, colX + 2, currentY + 5, {
      width: c.width - 4,
      align: c.align,
    });
    colX += c.width;
  }
  currentY += 18;

  // Table Body Rows
  payload.items.forEach((item: any, idx: number) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.rect(startX, currentY, contentWidth, 16).fill('#f8fafc');
    }

    let cx = startX;
    const rowData = [
      idx + 1,
      item.variant ? `${item.name} (${item.variant})` : item.name,
      item.unit || 'Kg',
      item.qty,
      Number(item.rate).toFixed(2),
      item.discount > 0 ? `-${Number(item.discount).toFixed(2)}` : '—',
      Number(item.amount).toFixed(2),
    ];

    rowData.forEach((val, i) => {
      const col = cols[i];
      doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b').text(String(val), cx + 2, currentY + 4, {
        width: col.width - 4,
        align: col.align,
        lineBreak: false,
      });
      cx += col.width;
    });

    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY + 16).lineTo(startX + contentWidth, currentY + 16).stroke();
    currentY += 16;
  });

  currentY += 10;

  // 5. Amount in Words, Terms, and Totals Box
  const leftW = 310;
  const rightW = contentWidth - leftW - 14;
  const leftX = startX;
  const summaryRightX = startX + leftW + 14;

  // Amount in words box
  doc.rect(leftX, currentY, leftW, 36).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('AMOUNT IN WORDS:', leftX + 6, currentY + 5);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(formatAmountInWords(payload.totals.total), leftX + 6, currentY + 17, { width: leftW - 12 });

  // Right Totals Table
  const calcY = currentY;
  const calcRowH = 16;
  const drawCalcRow = (lbl: string, val: string, isTotal = false) => {
    if (isTotal) {
      doc.rect(summaryRightX, currentY, rightW, 20).fill('#1e3a8a');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(lbl, summaryRightX + 6, currentY + 5);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(val, summaryRightX + 6, currentY + 5, { width: rightW - 12, align: 'right' });
      currentY += 20;
    } else {
      doc.rect(summaryRightX, currentY, rightW, calcRowH).fillAndStroke('#ffffff', '#cbd5e1');
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(lbl, summaryRightX + 6, currentY + 4);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(val, summaryRightX + 6, currentY + 4, { width: rightW - 12, align: 'right' });
      currentY += calcRowH;
    }
  };

  currentY = calcY;
  drawCalcRow('Subtotal (Gross):', formatRs(payload.totals.subtotal));
  if (payload.totals.discount > 0) {
    drawCalcRow('Discount:', `-${formatRs(payload.totals.discount)}`);
  }
  if (payload.totals.tax > 0) {
    drawCalcRow('GST / Tax:', formatRs(payload.totals.tax));
  }
  drawCalcRow('FINAL TOTAL (Net):', formatRs(payload.totals.total), true);

  // Terms and Signature Box
  const footerBlockY = Math.max(currentY + 14, calcY + 60);
  if (payload.company.footerNotes) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('Terms & Conditions:', leftX, footerBlockY);
    doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(payload.company.footerNotes, leftX, footerBlockY + 10, { width: leftW });
  }

  // Signatory Box
  const signX = summaryRightX;
  doc.font('Helvetica').fontSize(8).fillColor('#475569').text(`For, ${payload.company.name}`, signX, footerBlockY + 10, { width: rightW, align: 'center' });
  doc.strokeColor('#94a3b8').lineWidth(0.75).moveTo(signX + 15, footerBlockY + 50).lineTo(signX + rightW - 15, footerBlockY + 50).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text('Authorized Signatory', signX, footerBlockY + 54, { width: rightW, align: 'center' });

  // Page numbering footer
  const pageRange = doc.bufferedPageRange();
  for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7.5).fillColor('#94a3b8').text(
      `Tax Invoice - Page ${i + 1} of ${pageRange.count}  |  This is a computer generated invoice`,
      36,
      841.89 - 26,
      { width: contentWidth, align: 'center' }
    );
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
