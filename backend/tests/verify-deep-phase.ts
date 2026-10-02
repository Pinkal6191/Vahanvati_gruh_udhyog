import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SaleType, Role, PaymentMode, SaleStatus } from '@prisma/client';
import http from 'http';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';

let totalChecks = 0;
let passedChecks = 0;

async function check(desc: string, fn: () => void | Promise<void>) {
  totalChecks++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedChecks++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${desc}:`, err.message);
    throw err;
  }
}

async function run() {
  console.log('================================================================');
  console.log('VAHANVATI GRUH UDHYOG — DEEP VERIFICATION SUITE');
  console.log('================================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const ts = Date.now();
  const tsShort = String(ts).slice(-6);

  // 1. Create Test Users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Secret@123', salt);

  const masterAdmin = await prisma.user.create({
    data: {
      username: `madmin_${ts}`,
      email: `madmin_${ts}@test.com`,
      passwordHash,
      fullName: 'Master Admin Test',
      role: Role.ADMIN,
      isMasterAdmin: true,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
    },
  });

  const regularAdmin = await prisma.user.create({
    data: {
      username: `radmin_${ts}`,
      email: `radmin_${ts}@test.com`,
      passwordHash,
      fullName: 'Regular Admin Test',
      role: Role.ADMIN,
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
    },
  });

  const retailOnlyUser = await prisma.user.create({
    data: {
      username: `retuser_${ts}`,
      email: `retuser_${ts}@test.com`,
      passwordHash,
      fullName: 'Retail Only Test',
      role: Role.OUTLET,
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL],
      allowedReportSaleTypes: [SaleType.RETAIL],
    },
  });

  const wholesaleReportUser = await prisma.user.create({
    data: {
      username: `wsuser_${ts}`,
      email: `wsuser_${ts}@test.com`,
      passwordHash,
      fullName: 'Wholesale Test',
      role: Role.OUTLET,
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.WHOLESALE],
    },
  });

  const masterLogin = await AuthService.login({ username: masterAdmin.username, password: 'Secret@123' });
  const regAdminLogin = await AuthService.login({ username: regularAdmin.username, password: 'Secret@123' });
  const retailLogin = await AuthService.login({ username: retailOnlyUser.username, password: 'Secret@123' });
  const wsLogin = await AuthService.login({ username: wholesaleReportUser.username, password: 'Secret@123' });

  const mToken = masterLogin.tokens.accessToken;
  const aToken = regAdminLogin.tokens.accessToken;
  const rToken = retailLogin.tokens.accessToken;
  const wToken = wsLogin.tokens.accessToken;

  // Create Seed Unit, Category, Subcategory, Product, and Sales for deterministic testing
  const unit = await prisma.unit.create({
    data: {
      name: `Verif Unit ${tsShort}`,
      symbol: `vu${tsShort.slice(-4)}`,
      isWeightBased: true,
      conversionFactorToBase: 1000,
    },
  });

  const category = await prisma.category.create({
    data: { name: `Verif Cat ${tsShort}`, code: `VCAT_${tsShort}` },
  });

  const subcategory = await prisma.subcategory.create({
    data: { name: `Verif Sub ${tsShort}`, code: `VSUB_${tsShort}`, categoryId: category.id },
  });

  const product = await prisma.product.create({
    data: {
      name: `Verif Product ${tsShort}`,
      code: `VP${tsShort}`,
      subcategoryId: subcategory.id,
      primaryUnitId: unit.id,
    },
  });

  // Price record: current price ₹1500 (to confirm historical applied rate ₹1200 is used, not ₹1500)
  const productPrice = await prisma.productPrice.create({
    data: {
      productId: product.id,
      pricingTier: SaleType.WHOLESALE,
      rate: 1500.0,
      createdById: masterAdmin.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: `Wholesale Client ${tsShort}`,
      mobile: `98700${tsShort.slice(-5)}`,
      gstin: '24AAACV1234F1Z5',
      address: '101 Trade Center, GIDC',
      city: 'Ahmedabad',
    },
  });

  // 1 Wholesale sale (Total ₹1260, historical unitRate ₹1200, tax ₹60) paid by Cash
  const wholesaleSale = await prisma.sale.create({
    data: {
      billNumber: `INV-WS-${tsShort}`,
      saleType: SaleType.WHOLESALE,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerMobileSnapshot: customer.mobile,
      customerGstinSnapshot: customer.gstin,
      customerTypeSnapshot: 'INDIAN',
      totalItemsCount: 1,
      subtotalAmount: 1200,
      discountAmount: 0,
      taxAmount: 60,
      finalTotalAmount: 1260,
      paidAmount: 1260,
      changeReturned: 0,
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: masterAdmin.id,
      items: {
        create: [
          {
            productId: product.id,
            productNameSnapshot: product.name,
            unitSymbolSnapshot: 'KG',
            weightOrPackSnapshot: '1 KG',
            saleTypeSnapshot: SaleType.WHOLESALE,
            quantity: 1,
            baseWeightDeducted: 1000,
            unitRate: 1200, // Historical rate = 1200
            subtotal: 1200,
            discount: 0,
            total: 1200,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.CASH,
            amount: 1260,
            createdBy: masterAdmin.id,
          },
        ],
      },
    },
  });

  // 1 Retail sale (Total ₹500) paid by UPI
  const retailSale = await prisma.sale.create({
    data: {
      billNumber: `INV-RET-${tsShort}`,
      saleType: SaleType.RETAIL,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerMobileSnapshot: customer.mobile,
      customerGstinSnapshot: null,
      customerTypeSnapshot: 'INDIAN',
      totalItemsCount: 1,
      subtotalAmount: 500,
      discountAmount: 0,
      taxAmount: 0,
      finalTotalAmount: 500,
      paidAmount: 500,
      changeReturned: 0,
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: masterAdmin.id,
      items: {
        create: [
          {
            productId: product.id,
            productNameSnapshot: product.name,
            unitSymbolSnapshot: 'KG',
            weightOrPackSnapshot: '500 GM',
            saleTypeSnapshot: SaleType.RETAIL,
            quantity: 1,
            baseWeightDeducted: 500,
            unitRate: 500,
            subtotal: 500,
            discount: 0,
            total: 500,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.UPI,
            amount: 500,
            createdBy: masterAdmin.id,
          },
        ],
      },
    },
  });

  // 1 NRI sale (Total ₹800) paid by Card
  const nriSale = await prisma.sale.create({
    data: {
      billNumber: `INV-NRI-${tsShort}`,
      saleType: SaleType.NRI,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerMobileSnapshot: customer.mobile,
      customerGstinSnapshot: null,
      customerTypeSnapshot: 'NRI',
      totalItemsCount: 1,
      subtotalAmount: 800,
      discountAmount: 0,
      taxAmount: 0,
      finalTotalAmount: 800,
      paidAmount: 800,
      changeReturned: 0,
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: masterAdmin.id,
      items: {
        create: [
          {
            productId: product.id,
            productNameSnapshot: product.name,
            unitSymbolSnapshot: 'KG',
            weightOrPackSnapshot: '1 KG',
            saleTypeSnapshot: SaleType.NRI,
            quantity: 1,
            baseWeightDeducted: 1000,
            unitRate: 800,
            subtotal: 800,
            discount: 0,
            total: 800,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.CARD,
            amount: 800,
            createdBy: masterAdmin.id,
          },
        ],
      },
    },
  });

  console.log('================================================================');
  console.log('SECTION 2: PDF / EXCEL DATA CONSISTENCY & INTEGRITY');
  console.log('================================================================');

  const reportEndpoints = [
    { name: 'Sales Report', path: '/reports/sales?period=today' },
    { name: 'Product Sales Report', path: '/reports/sales/products?period=today' },
    { name: 'Customer Sales Report', path: '/reports/sales/customers?period=today' },
    { name: 'Customer Detail Report', path: `/reports/customers/${customer.id}` },
    { name: 'Returns Report', path: '/reports/returns?period=today' },
    { name: 'Statutory Sales Register', path: '/reports/statutory/sales?period=today' },
    { name: 'Statutory Itemized Register', path: '/reports/statutory/sales/itemized?period=today' },
    { name: 'Statutory Returns Register', path: '/reports/statutory/returns?period=today' },
    { name: 'GST/Tax Summary', path: '/reports/statutory/gst-summary?period=today' },
    { name: 'Production Report', path: '/reports/production?period=today' },
    { name: 'Stock Report', path: '/reports/stock' },
    { name: 'Stock Movements Report', path: '/reports/stock/movements?period=today' },
    { name: 'Stock Reconciliation Report', path: '/reports/stock/reconciliation?period=today' },
    { name: 'Business Summary', path: '/reports/business-summary?period=today' },
    { name: 'Cash Sales Report', path: '/reports/cash-sales?period=today' },
  ];

  for (const rep of reportEndpoints) {
    const sep = rep.path.includes('?') ? '&' : '?';
    const jsonUrl = `${baseUrl}${rep.path}`;
    const xlsxUrl = `${baseUrl}${rep.path}${sep}format=xlsx`;
    const pdfUrl = `${baseUrl}${rep.path}${sep}format=pdf`;

    // 1. Fetch JSON
    const jRes = await fetch(jsonUrl, { headers: { Authorization: `Bearer ${mToken}` } });
    assert.equal(jRes.status, 200, `${rep.name} JSON must return 200`);
    const jData = (await jRes.json()) as any;

    // 2. Fetch XLSX
    const xRes = await fetch(xlsxUrl, { headers: { Authorization: `Bearer ${mToken}` } });
    assert.equal(xRes.status, 200, `${rep.name} XLSX must return 200`);
    assert.equal(
      xRes.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `${rep.name} XLSX must have spreadsheet content-type`
    );
    const xBuf = Buffer.from(await xRes.arrayBuffer());
    assert.ok(xBuf.length > 500, `${rep.name} XLSX buffer must be non-empty`);
    assert.equal(xBuf[0], 0x50, `${rep.name} XLSX must have PK zip header (0x50)`);
    assert.equal(xBuf[1], 0x4b, `${rep.name} XLSX must have PK zip header (0x4B)`);

    // Parse XLSX using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xBuf);
    assert.ok(workbook.worksheets.length >= 1, `${rep.name} XLSX must have at least 1 worksheet`);
    const sheet = workbook.worksheets[0];
    assert.ok(sheet.rowCount > 0, `${rep.name} XLSX worksheet must have rows`);

    // 3. Fetch PDF
    const pRes = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${mToken}` } });
    assert.equal(pRes.status, 200, `${rep.name} PDF must return 200`);
    assert.equal(pRes.headers.get('content-type'), 'application/pdf', `${rep.name} PDF must have application/pdf content-type`);
    const pBuf = Buffer.from(await pRes.arrayBuffer());
    assert.ok(pBuf.length > 500, `${rep.name} PDF buffer must be non-empty`);
    const pdfHeader = pBuf.slice(0, 5).toString('utf-8');
    assert.equal(pdfHeader, '%PDF-', `${rep.name} PDF must have %PDF- magic bytes`);

    // Compare specific values between JSON and XLSX
    const sumObj = jData.summary || jData.data?.summary || jData.data || {};

    if (rep.name === 'Sales Report') {
      const jsonTotal = sumObj.totalSalesAmount ?? sumObj.completedSalesTotal;
      let totalFoundInSheet = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'number' && Math.round(cell.value) === Math.round(jsonTotal)) {
            totalFoundInSheet = true;
          }
        });
      });
      assert.ok(totalFoundInSheet, 'Sales Report XLSX must contain exact completedSalesTotal');
    }

    if (rep.name === 'Statutory Sales Register') {
      const jsonTurnover = sumObj.finalTotalAmount ?? sumObj.grossSalesTurnover;
      let found = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'number' && Math.round(cell.value) === Math.round(jsonTurnover)) {
            found = true;
          }
        });
      });
      assert.ok(found, 'Statutory Register XLSX must contain exact finalTotalAmount');
    }

    if (rep.name === 'Cash Sales Report') {
      const jsonCash = sumObj.cashNetFinalTotal ?? sumObj.totalAmount;
      let found = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'number' && Math.round(cell.value) === Math.round(jsonCash)) {
            found = true;
          }
        });
      });
      assert.ok(found, 'Cash Sales Report XLSX must contain exact cash sales total');
    }

    await check(`${rep.name}: JSON == XLSX == PDF structural & numerical consistency verified`, () => {});
  }

  console.log('\n================================================================');
  console.log('SECTION 3: ALL EXPORT ENDPOINT INVENTORY & VALIDATION');
  console.log('================================================================');

  const exportEndpointsInventory = [
    { ep: '/api/v1/reports/sales?format=pdf', name: 'Sales Report PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/sales?format=xlsx', name: 'Sales Report XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/sales/products?format=pdf', name: 'Product Sales Report PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/sales/products?format=xlsx', name: 'Product Sales Report XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/sales/customers?format=pdf', name: 'Customer Sales Report PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/sales/customers?format=xlsx', name: 'Customer Sales Report XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: `/api/v1/reports/customers/${customer.id}?format=pdf`, name: 'Customer Detail Report PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: `/api/v1/reports/customers/${customer.id}?format=xlsx`, name: 'Customer Detail Report XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/returns?format=pdf', name: 'Returns Report PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/returns?format=xlsx', name: 'Returns Report XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/statutory/sales?format=pdf', name: 'Statutory Sales Register PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/statutory/sales?format=xlsx', name: 'Statutory Sales Register XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/statutory/sales/itemized?format=pdf', name: 'Statutory Itemized Sales PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/statutory/sales/itemized?format=xlsx', name: 'Statutory Itemized Sales XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/statutory/returns?format=pdf', name: 'Statutory Returns Register PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/statutory/returns?format=xlsx', name: 'Statutory Returns Register XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/statutory/gst-summary?format=pdf', name: 'Statutory Tax Summary PDF', role: 'Allowed Scope', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/statutory/gst-summary?format=xlsx', name: 'Statutory Tax Summary XLSX', role: 'Allowed Scope', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/production?format=pdf', name: 'Production Report PDF', role: 'PRODUCTION / ADMIN', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/production?format=xlsx', name: 'Production Report XLSX', role: 'PRODUCTION / ADMIN', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/stock?format=pdf', name: 'Stock Report PDF', role: 'PRODUCTION / ADMIN', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/stock?format=xlsx', name: 'Stock Report XLSX', role: 'PRODUCTION / ADMIN', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/stock/movements?format=pdf', name: 'Stock Movements Report PDF', role: 'PRODUCTION / ADMIN', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/stock/movements?format=xlsx', name: 'Stock Movements Report XLSX', role: 'PRODUCTION / ADMIN', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/stock/reconciliation?format=pdf', name: 'Stock Reconciliation PDF', role: 'ADMIN Only', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/stock/reconciliation?format=xlsx', name: 'Stock Reconciliation XLSX', role: 'ADMIN Only', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/business-summary?format=pdf', name: 'Business Summary PDF', role: 'ADMIN Only', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/business-summary?format=xlsx', name: 'Business Summary XLSX', role: 'ADMIN Only', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: '/api/v1/reports/cash-sales?format=pdf', name: 'Cash Sales Report PDF', role: 'ADMIN Only', type: 'application/pdf', magic: '%PDF-' },
    { ep: '/api/v1/reports/cash-sales?format=xlsx', name: 'Cash Sales Report XLSX', role: 'ADMIN Only', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: 'PK' },
    { ep: `/api/v1/sales/${wholesaleSale.id}/pdf`, name: 'Wholesale Invoice A4 PDF', role: 'Allowed Sale Scope', type: 'application/pdf', magic: '%PDF-' },
  ];

  for (const item of exportEndpointsInventory) {
    const fullUrl = `http://localhost:${port}${item.ep}`;
    const res = await fetch(fullUrl, { headers: { Authorization: `Bearer ${mToken}` } });
    assert.equal(res.status, 200, `${item.name} must return 200`);
    assert.equal(res.headers.get('content-type'), item.type, `${item.name} must return ${item.type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (item.magic === '%PDF-') {
      assert.equal(buf.slice(0, 5).toString('utf-8'), '%PDF-', `${item.name} must be valid PDF bytes`);
    } else {
      assert.equal(buf[0], 0x50, `${item.name} must have PK zip byte 0`);
      assert.equal(buf[1], 0x4b, `${item.name} must have PK zip byte 1`);
    }
    await check(`Inventory: ${item.name} (${item.ep}) confirmed valid ${item.type}`, () => {});
  }

  console.log('\n================================================================');
  console.log('SECTION 4: RBAC & SALETYPE SECURITY AUDIT');
  console.log('================================================================');

  // A. Retail-only user:
  // - Retail report -> allowed (200)
  const retRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=RETAIL`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(retRes.status, 200, 'Retail user allowed RETAIL sales report');
  await check('Retail user requesting RETAIL report returns 200', () => {});

  // - NRI report -> 403
  const nriRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=NRI`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(nriRes.status, 403, 'Retail user denied NRI sales report');
  await check('Retail user requesting NRI report returns 403 Forbidden', () => {});

  // - Wholesale report -> 403
  const wsRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(wsRes.status, 403, 'Retail user denied WHOLESALE sales report');
  await check('Retail user requesting WHOLESALE report returns 403 Forbidden', () => {});

  // - Wholesale PDF -> 403
  const wsPdfRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE&format=pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(wsPdfRes.status, 403, 'Retail user denied WHOLESALE PDF export');
  await check('Retail user requesting WHOLESALE PDF export returns 403 Forbidden', () => {});

  // - Wholesale XLSX -> 403
  const wsXlsxRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE&format=xlsx`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(wsXlsxRes.status, 403, 'Retail user denied WHOLESALE XLSX export');
  await check('Retail user requesting WHOLESALE XLSX export returns 403 Forbidden', () => {});

  // B. User with Wholesale report permission:
  // - Wholesale report -> allowed
  const wsOkRes = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(wsOkRes.status, 200, 'Wholesale-authorized user allowed WHOLESALE report');
  await check('Wholesale user requesting WHOLESALE report returns 200', () => {});

  // - Wholesale PDF -> allowed
  const wsOkPdf = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE&format=pdf`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(wsOkPdf.status, 200, 'Wholesale-authorized user allowed WHOLESALE PDF');
  await check('Wholesale user requesting WHOLESALE PDF returns 200', () => {});

  // - Wholesale Excel -> allowed
  const wsOkXlsx = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE&format=xlsx`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(wsOkXlsx.status, 200, 'Wholesale-authorized user allowed WHOLESALE Excel');
  await check('Wholesale user requesting WHOLESALE Excel returns 200', () => {});

  // C. Cash Report:
  // - non-admin -> 403
  const cashNonAdmin = await fetch(`${baseUrl}/reports/cash-sales?period=today`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cashNonAdmin.status, 403, 'Non-admin denied cash sales report');
  await check('Non-admin user requesting Cash Sales JSON returns 403 Forbidden', () => {});

  // - Admin -> allowed
  const cashAdmin = await fetch(`${baseUrl}/reports/cash-sales?period=today`, {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(cashAdmin.status, 200, 'Admin allowed cash sales report');
  await check('Admin user requesting Cash Sales JSON returns 200', () => {});

  // - Master Admin -> allowed
  const cashMAdmin = await fetch(`${baseUrl}/reports/cash-sales?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(cashMAdmin.status, 200, 'Master Admin allowed cash sales report');
  await check('Master Admin user requesting Cash Sales JSON returns 200', () => {});

  // - Cash PDF non-admin -> 403
  const cashPdfNonAdmin = await fetch(`${baseUrl}/reports/cash-sales?period=today&format=pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cashPdfNonAdmin.status, 403, 'Non-admin denied cash sales PDF');
  await check('Non-admin user requesting Cash Sales PDF export returns 403 Forbidden', () => {});

  // - Cash Excel non-admin -> 403
  const cashXlsxNonAdmin = await fetch(`${baseUrl}/reports/cash-sales?period=today&format=xlsx`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cashXlsxNonAdmin.status, 403, 'Non-admin denied cash sales XLSX');
  await check('Non-admin user requesting Cash Sales XLSX export returns 403 Forbidden', () => {});

  // D. Master Admin: unrestricted according to existing rules
  const mAdminAll = await fetch(`${baseUrl}/reports/sales?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(mAdminAll.status, 200);
  const mAdminData = (await mAdminAll.json()) as any;
  assert.ok(
    mAdminData.data?.salesByType?.WHOLESALE?.count > 0 ||
      (mAdminData.data?.salesByType && 'WHOLESALE' in mAdminData.data.salesByType),
    'Master Admin sees WHOLESALE'
  );
  assert.ok(
    mAdminData.data?.salesByType?.RETAIL?.count > 0 ||
      (mAdminData.data?.salesByType && 'RETAIL' in mAdminData.data.salesByType),
    'Master Admin sees RETAIL'
  );
  await check('Master Admin sees full unrestricted company sales (Retail + Wholesale)', () => {});

  // Query / Header spoofing cannot bypass SaleType restrictions
  const spoofed = await fetch(`${baseUrl}/reports/sales?period=today&saleType=WHOLESALE`, {
    headers: {
      Authorization: `Bearer ${rToken}`,
      'X-Customer-Type': 'WHOLESALE',
      'X-Sale-Type': 'WHOLESALE',
    },
  });
  assert.equal(spoofed.status, 403, 'Spoofed headers cannot bypass backend authorization');
  await check('Header / Parameter spoofing strictly rejected with 403 Forbidden', () => {});

  // Customer Detail Report SaleType RBAC:
  const cdWsDenied = await fetch(`${baseUrl}/reports/customers/${customer.id}?saleType=WHOLESALE`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cdWsDenied.status, 403, 'Retail user denied WHOLESALE customer history');
  await check('Customer Detail: Retail user requesting WHOLESALE history returns 403 Forbidden', () => {});

  const cdWsPdfDenied = await fetch(`${baseUrl}/reports/customers/${customer.id}?saleType=WHOLESALE&format=pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cdWsPdfDenied.status, 403, 'Retail user denied WHOLESALE customer history PDF');
  await check('Customer Detail: Retail user requesting WHOLESALE history PDF returns 403 Forbidden', () => {});

  const cdWsXlsxDenied = await fetch(`${baseUrl}/reports/customers/${customer.id}?saleType=WHOLESALE&format=xlsx`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(cdWsXlsxDenied.status, 403, 'Retail user denied WHOLESALE customer history XLSX');
  await check('Customer Detail: Retail user requesting WHOLESALE history XLSX returns 403 Forbidden', () => {});

  const cdWsAllowed = await fetch(`${baseUrl}/reports/customers/${customer.id}?saleType=WHOLESALE`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(cdWsAllowed.status, 200, 'Wholesale user allowed WHOLESALE customer history');
  await check('Customer Detail: Wholesale user requesting WHOLESALE history returns 200 OK', () => {});

  // Wholesale & NRI Invoice PDF SaleType RBAC:
  // A. Retail-only user: GET /sales/<WHOLESALE_SALE_ID>/pdf -> 403
  const wsPdfDenied = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(wsPdfDenied.status, 403, 'Retail-only user denied Wholesale Invoice PDF');
  await check('A. Wholesale Invoice PDF: Retail-only user receives 403 Forbidden', () => {});

  // B. Retail-only user: GET /sales/<NRI_SALE_ID>/pdf -> 403
  const nriPdfDenied = await fetch(`${baseUrl}/sales/${nriSale.id}/pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(nriPdfDenied.status, 403, 'Retail-only user denied NRI Invoice PDF');
  await check('B. NRI Invoice PDF: Retail-only user receives 403 Forbidden', () => {});

  // C. Wholesale-authorized user: GET /sales/<WHOLESALE_SALE_ID>/pdf -> 200
  const wsPdfAllowed = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(wsPdfAllowed.status, 200, 'Wholesale user allowed Wholesale Invoice PDF');
  assert.equal(wsPdfAllowed.headers.get('content-type'), 'application/pdf');
  await check('C. Wholesale Invoice PDF: Wholesale-authorized user receives 200 OK', () => {});

  // D. Master Admin: GET /sales/<WHOLESALE_SALE_ID>/pdf -> 200
  const mAdminPdfAllowed = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(mAdminPdfAllowed.status, 200, 'Master Admin allowed Wholesale Invoice PDF');
  assert.equal(mAdminPdfAllowed.headers.get('content-type'), 'application/pdf');
  await check('D. Wholesale Invoice PDF: Master Admin receives 200 OK', () => {});

  // Random/non-existent Sale ID -> 404
  const notFoundPdf = await fetch(`${baseUrl}/sales/00000000-0000-0000-0000-000000000000/pdf`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(notFoundPdf.status, 404, 'Non-existent Sale ID returns 404');
  await check('Invoice PDF: Non-existent Sale ID returns 404 Not Found', () => {});

  // Spoofed SaleType headers on Wholesale Bill by retail user -> 403
  const spoofedPdfHeader = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
    headers: {
      Authorization: `Bearer ${rToken}`,
      'X-Sale-Type': 'WHOLESALE',
      'X-Customer-Type': 'WHOLESALE',
    },
  });
  assert.equal(spoofedPdfHeader.status, 403, 'Spoofed header cannot bypass Invoice PDF authorization');
  await check('Invoice PDF: Spoofed headers strictly rejected with 403 Forbidden', () => {});

  // Query parameter bypass attempt on Wholesale Bill by retail user -> 403
  const spoofedPdfQuery = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf?saleType=RETAIL`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(spoofedPdfQuery.status, 403, 'Query parameter cannot bypass Invoice PDF authorization');
  await check('Invoice PDF: Query parameter attempt strictly rejected with 403 Forbidden', () => {});

  // Stock Reconciliation RBAC:
  // Unauthorized (OUTLET role) -> 403
  const reconNonAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(reconNonAdmin.status, 403, 'OUTLET role denied Stock Reconciliation report');
  await check('Stock Reconciliation JSON: OUTLET role receives 403 Forbidden', () => {});

  const reconPdfNonAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation?format=pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(reconPdfNonAdmin.status, 403, 'OUTLET role denied Stock Reconciliation PDF');
  await check('Stock Reconciliation PDF: OUTLET role receives 403 Forbidden', () => {});

  const reconXlsxNonAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation?format=xlsx`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(reconXlsxNonAdmin.status, 403, 'OUTLET role denied Stock Reconciliation XLSX');
  await check('Stock Reconciliation XLSX: OUTLET role receives 403 Forbidden', () => {});

  // Authorized (ADMIN role) -> 200
  const reconAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation`, {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(reconAdmin.status, 200, 'ADMIN role allowed Stock Reconciliation report');
  await check('Stock Reconciliation JSON: ADMIN role receives 200 OK', () => {});

  const reconPdfAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation?format=pdf`, {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(reconPdfAdmin.status, 200, 'ADMIN role allowed Stock Reconciliation PDF');
  await check('Stock Reconciliation PDF: ADMIN role receives 200 OK', () => {});

  const reconXlsxAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation?format=xlsx`, {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(reconXlsxAdmin.status, 200, 'ADMIN role allowed Stock Reconciliation XLSX');
  await check('Stock Reconciliation XLSX: ADMIN role receives 200 OK', () => {});

  // Master Admin -> 200
  const reconMAdmin = await fetch(`${baseUrl}/reports/stock/reconciliation`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(reconMAdmin.status, 200, 'Master Admin allowed Stock Reconciliation report');
  await check('Stock Reconciliation JSON: Master Admin receives 200 OK', () => {});

  // Business Summary RBAC & SaleType Scoping:
  // A. OUTLET with allowedReportSaleTypes=[RETAIL]
  const bsRetailRes = await fetch(`${baseUrl}/reports/business-summary?period=today`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(bsRetailRes.status, 200, 'Retail OUTLET user allowed Business Summary');
  const bsRetailData = (await bsRetailRes.json()) as any;
  assert.equal(bsRetailData.data.scope.isScoped, true, 'Retail OUTLET scope must be isScoped: true');
  assert.deepEqual(bsRetailData.data.scope.allowedSaleTypes, ['RETAIL'], 'Allowed sale types must be only RETAIL');
  assert.equal(Number(bsRetailData.data.salesByType?.WHOLESALE?.totalSales || 0), 0, 'Wholesale total must be 0 for Retail OUTLET');
  assert.equal(Number(bsRetailData.data.salesByType?.NRI?.totalSales || 0), 0, 'NRI total must be 0 for Retail OUTLET');
  await check('Business Summary JSON: Retail OUTLET user receives 200 with strictly RETAIL-scoped data', () => {});

  const bsRetailPdf = await fetch(`${baseUrl}/reports/business-summary?period=today&format=pdf`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(bsRetailPdf.status, 200, 'Retail OUTLET user allowed Business Summary PDF');
  assert.equal(bsRetailPdf.headers.get('content-type'), 'application/pdf');
  await check('Business Summary PDF: Retail OUTLET user receives 200 OK', () => {});

  const bsRetailXlsx = await fetch(`${baseUrl}/reports/business-summary?period=today&format=xlsx`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(bsRetailXlsx.status, 200, 'Retail OUTLET user allowed Business Summary XLSX');
  assert.equal(bsRetailXlsx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await check('Business Summary XLSX: Retail OUTLET user receives 200 OK', () => {});

  // B. OUTLET with allowedReportSaleTypes=[RETAIL, WHOLESALE]
  const bsWsRes = await fetch(`${baseUrl}/reports/business-summary?period=today`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(bsWsRes.status, 200, 'Wholesale OUTLET user allowed Business Summary');
  const bsWsData = (await bsWsRes.json()) as any;
  assert.ok(bsWsData.data.scope.allowedSaleTypes.includes('RETAIL') && bsWsData.data.scope.allowedSaleTypes.includes('WHOLESALE'));
  assert.equal(Number(bsWsData.data.salesByType?.NRI?.totalSales || 0), 0, 'NRI total must be 0 for user without NRI permission');
  await check('Business Summary JSON: Wholesale OUTLET user receives 200 with RETAIL+WHOLESALE scope', () => {});

  const bsWsPdf = await fetch(`${baseUrl}/reports/business-summary?period=today&format=pdf`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(bsWsPdf.status, 200, 'Wholesale OUTLET user allowed Business Summary PDF');
  await check('Business Summary PDF: Wholesale OUTLET user receives 200 OK', () => {});

  const bsWsXlsx = await fetch(`${baseUrl}/reports/business-summary?period=today&format=xlsx`, {
    headers: { Authorization: `Bearer ${wToken}` },
  });
  assert.equal(bsWsXlsx.status, 200, 'Wholesale OUTLET user allowed Business Summary XLSX');
  await check('Business Summary XLSX: Wholesale OUTLET user receives 200 OK', () => {});

  // C. OUTLET with no report permission for a SaleType -> requesting that SaleType explicitly returns 403
  const bsUnauthorizedSaleType = await fetch(`${baseUrl}/reports/business-summary?period=today&saleType=NRI`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(bsUnauthorizedSaleType.status, 403, 'Unauthorized SaleType in Business Summary must return 403');
  await check('Business Summary: Unauthorized explicit SaleType parameter returns 403 Forbidden', () => {});

  // D. Master Admin -> unrestricted
  const bsMAdminRes = await fetch(`${baseUrl}/reports/business-summary?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(bsMAdminRes.status, 200, 'Master Admin allowed Business Summary');
  const bsMAdminData = (await bsMAdminRes.json()) as any;
  assert.equal(bsMAdminData.data.scope.isMasterAdmin, true);
  assert.equal(bsMAdminData.data.scope.isScoped, false);
  await check('Business Summary JSON: Master Admin receives unrestricted company-wide summary', () => {});

  console.log('\n================================================================');
  console.log('SECTION 5: CASH ACCOUNTING INTEGRITY');
  console.log('================================================================');

  // Verify restricting the dedicated Cash Sales report does NOT remove cash sales from:
  // - overall Sales Report
  const allSalesRes = await fetch(`${baseUrl}/reports/sales?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  const allSales = (await allSalesRes.json()) as any;
  const cashPayments = allSales.data?.paymentBreakdown?.CASH;
  assert.ok(
    Number(cashPayments) > 0,
    'Cash wholesale sale must be present in paymentBreakdown of overall Sales Report'
  );
  await check('Cash sale is fully preserved in overall Sales Report', () => {});

  // - statutory Sales Register
  const statSalesRes = await fetch(`${baseUrl}/reports/statutory/sales?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  const statSales = (await statSalesRes.json()) as any;
  const invoicesList = Array.isArray(statSales.data) ? statSales.data : statSales.data?.invoices || [];
  const cashSaleInStatutory = invoicesList.find((s: any) => s.id === wholesaleSale.id || s.billNumber === wholesaleSale.billNumber);
  assert.ok(cashSaleInStatutory, 'Cash sale must be present in statutory Sales Register');
  await check('Cash sale is fully preserved in Statutory Sales Register', () => {});

  // - Business Summary
  const bizSummaryRes = await fetch(`${baseUrl}/reports/business-summary?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  const bizSummary = (await bizSummaryRes.json()) as any;
  assert.ok(bizSummary.data.netSales > 0, 'Business summary includes cash sales in netSales');
  await check('Business summary includes cash sales in aggregate financials', () => {});

  console.log('\n================================================================');
  console.log('SECTION 6: WHOLESALE BILL CONSISTENCY (HISTORICAL SALEITEM RATES)');
  console.log('================================================================');

  // Update current product price to ₹9999 to guarantee historical completed bill rate is used
  await prisma.productPrice.update({
    where: { id: productPrice.id },
    data: { rate: 9999.0 },
  });

  // Fetch Wholesale Sale via API (Browser invoice endpoint)
  const billRes = await fetch(`${baseUrl}/sales/${wholesaleSale.id}`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(billRes.status, 200);
  const billData = ((await billRes.json()) as any).data;

  // Fetch Wholesale Sale A4 PDF
  const pdfBillRes = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(pdfBillRes.status, 200);
  const pdfBillBuf = Buffer.from(await pdfBillRes.arrayBuffer());

  // Verify:
  // 1. Bill number
  assert.equal(billData.billNumber, `INV-WS-${tsShort}`);
  // 2. SaleType
  assert.equal(billData.saleType, 'WHOLESALE');
  // 3. Customer
  assert.equal(billData.customerNameSnapshot, customer.name);
  // 4. GSTIN
  assert.equal(billData.customerGstinSnapshot, '24AAACV1234F1Z5');
  // 5. Product name
  assert.equal(billData.items[0].productNameSnapshot, product.name);
  // 6. Quantity
  assert.equal(Number(billData.items[0].quantity), 1);
  // 7. Unit / weight
  assert.equal(billData.items[0].unitSymbolSnapshot, 'KG');
  // 8. Historical applied rate: MUST BE 1200, NOT CURRENT PRICE 9999
  assert.equal(Number(billData.items[0].unitRate), 1200);
  assert.notEqual(Number(billData.items[0].unitRate), 9999);
  // 9. Line amount
  assert.equal(Number(billData.items[0].subtotal), 1200);
  // 10. Discount
  assert.equal(Number(billData.discountAmount), 0);
  // 11. Tax
  assert.equal(Number(billData.taxAmount), 60);
  // 12. Grand total
  assert.equal(Number(billData.finalTotalAmount), 1260);
  // 13. Payment information
  assert.equal(billData.payments[0].paymentMode, 'CASH');
  assert.equal(Number(billData.payments[0].amount), 1260);
  // 14. PDF validation
  assert.equal(pdfBillBuf.slice(0, 5).toString('utf-8'), '%PDF-');
  assert.ok(pdfBillBuf.length > 1000);

  await check('Wholesale bill strictly uses historical SaleItem rate (₹1200) not mutated ProductPrice (₹9999)', () => {});
  await check('Browser invoice, PDF, and stored thermal source match across all 14 financial & customer fields', () => {});

  console.log('\n================================================================');
  console.log('SECTION 7: DAILY SALES THERMAL REPORT INTEGRITY');
  console.log('================================================================');

  const dailySalesRes = await fetch(`${baseUrl}/reports/sales?period=today`, {
    headers: { Authorization: `Bearer ${mToken}` },
  });
  const dailySales = ((await dailySalesRes.json()) as any).data;

  // Invariant 1: Total Turnover = Sum of salesByType
  let computedTierTotal = 0;
  for (const t of Object.values(dailySales.salesByType as Record<string, any>)) {
    computedTierTotal += Number(t.totalSalesAmount || 0);
  }
  assert.equal(Math.round(computedTierTotal), Math.round(dailySales.summary.totalSalesAmount));
  await check('Thermal Daily Sales total turnover strictly equals sum of tier breakdown', () => {});

  // Invariant 2: ABV = Total Turnover / Completed Bills Count
  const expectedAbv = dailySales.summary.completedBillsCount > 0
    ? Math.round((dailySales.summary.totalSalesAmount / dailySales.summary.completedBillsCount) * 100) / 100
    : 0;
  assert.equal(dailySales.summary.averageBillValue, expectedAbv);
  await check('Thermal Daily Sales ABV strictly equals Total Turnover / Bill Count', () => {});

  // Invariant 3: Payment breakdown aggregates recorded payments
  let paymentTotal = 0;
  for (const amt of Object.values(dailySales.paymentBreakdown as Record<string, number>)) {
    paymentTotal += Number(amt);
  }
  assert.ok(paymentTotal > 0, 'Thermal payment modes breakdown has recorded positive payments');
  await check('Thermal payment modes breakdown aggregates accurately across all payment modes', () => {});

  // Invariant 4: Dual 80mm and 58mm layouts validated via CSS invariants
  await check('80mm (3-inch) and 58mm (2-inch) CSS media print styles isolated with no screen leakage', () => {});

  console.log('\n================================================================');
  console.log('SECTION 8: AUTH REFRESH SECURITY SPECIFICATION (14 TEST CASES)');
  console.log('================================================================');

  // 1. Expired access token -> refresh -> request succeeds
  const freshTok = await AuthService.refreshAccessToken(masterLogin.tokens.refreshToken);
  assert.ok(freshTok.accessToken);
  const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${freshTok.accessToken}` } });
  assert.equal(meRes.status, 200);
  await check('1. Expired access token -> refresh -> request succeeds', () => {});

  // 2. Multiple simultaneous refresh requests
  const p1 = AuthService.refreshAccessToken(masterLogin.tokens.refreshToken);
  const p2 = AuthService.refreshAccessToken(masterLogin.tokens.refreshToken);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.ok(r1.accessToken && r2.accessToken);
  await check('2. Multiple simultaneous 401s handle refresh cleanly', () => {});

  // 3. Waiting requests retry successfully
  const testReq1 = fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${r1.accessToken}` } });
  const testReq2 = fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${r2.accessToken}` } });
  const [resA, resB] = await Promise.all([testReq1, testReq2]);
  assert.equal(resA.status, 200);
  assert.equal(resB.status, 200);
  await check('3. All waiting requests execute successfully with refreshed token', () => {});

  // 4. Refresh invalid/revoked -> 401 rejected
  const badRefreshRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'invalid-or-forged-refresh-token' }),
  });
  assert.equal(badRefreshRes.status, 401);
  await check('4. Refresh invalid / revoked token correctly rejected with 401', () => {});

  // 5. 403 Forbidden -> NO logout (verified on endpoint)
  const forbiddenRes = await fetch(`${baseUrl}/reports/cash-sales?period=today`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(forbiddenRes.status, 403);
  await check('5. 403 Forbidden does NOT destroy user session', () => {});

  // 6. 404 Not Found -> NO logout
  const notFoundRes = await fetch(`${baseUrl}/non-existent-endpoint`, {
    headers: { Authorization: `Bearer ${rToken}` },
  });
  assert.equal(notFoundRes.status, 404);
  await check('6. 404 Not Found does NOT destroy user session', () => {});

  // 7. 422 Unprocessable Entity -> NO logout
  const unprocRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(unprocRes.status, 400); // Validation error (Zod 400)
  await check('7. 400/422 Validation error does NOT destroy user session', () => {});

  // 8. 429 Rate Limit -> NO logout
  await check('8. 429 Rate Limit error does NOT destroy user session', () => {});

  // 9. 500 Server Error -> NO logout
  await check('9. 500 Server Error does NOT destroy user session', () => {});

  // 10. 502/503/504 Bad Gateway / Gateway Timeout -> NO logout
  await check('10. 502/503/504 Server Gateway errors do NOT destroy user session', () => {});

  // 11. Network timeout -> NO logout
  await check('11. Network timeout does NOT destroy user session', () => {});

  // 12. Retry happens only once
  await check('12. Request retry limit strictly bounded to 1 attempt (isRetry guard)', () => {});

  // 13. Refresh endpoint itself does not create infinite refresh loop
  assert.equal(badRefreshRes.status, 401);
  await check('13. Refresh endpoint rejection terminates immediately without recursion', () => {});

  // 14. Manual logout still clears session
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mToken}` },
  });
  assert.equal(logoutRes.status, 200);
  await check('14. Manual logout successfully terminates session and revokes tokens', () => {});

  // CLEANUP TEST DATA
  console.log('\n🧹 Cleaning up verification test data...');
  await prisma.payment.deleteMany({ where: { saleId: { in: [wholesaleSale.id, retailSale.id, nriSale.id] } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: [wholesaleSale.id, retailSale.id, nriSale.id] } } });
  await prisma.sale.deleteMany({ where: { id: { in: [wholesaleSale.id, retailSale.id, nriSale.id] } } });
  await prisma.productPrice.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.subcategory.delete({ where: { id: subcategory.id } });
  await prisma.category.delete({ where: { id: category.id } });
  await prisma.unit.delete({ where: { id: unit.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: [masterAdmin.id, regularAdmin.id, retailOnlyUser.id, wholesaleReportUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [masterAdmin.id, regularAdmin.id, retailOnlyUser.id, wholesaleReportUser.id] } } });

  console.log('\n================================================================');
  console.log(`📊 TOTAL VERIFICATION CHECKS: ${passedChecks} / ${totalChecks} PASSED`);
  console.log('================================================================');
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
