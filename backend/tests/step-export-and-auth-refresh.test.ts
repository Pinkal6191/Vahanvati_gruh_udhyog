import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SaleStatus, PaymentMode, SaleType } from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

export async function runExportAndAuthRefreshTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 VERIFICATION: EXPORT ENGINE (15 REPORTS) + WHOLESALE A4 PDF + AUTH REFRESH');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  let passedTests = 0;
  let totalTests = 0;

  function markPass(name: string) {
    passedTests++;
    console.log(`  ✅ Test ${passedTests}: ${name}`);
  }

  // 1. Setup Express app on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('testpass123', salt);

  // 2. Create test users: Master Admin and Scoped Outlet
  const adminUser = await prisma.user.create({
    data: {
      username: `admin_exp_${ts}`,
      email: `admin_exp_${ts}@example.com`,
      passwordHash,
      fullName: `Admin Export Tester ${ts}`,
      role: 'ADMIN',
      isMasterAdmin: true,
      allowedBillingSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      allowedReportSaleTypes: [SaleType.RETAIL, SaleType.NRI, SaleType.WHOLESALE],
      isActive: true,
    },
  });

  const outletUser = await prisma.user.create({
    data: {
      username: `outlet_exp_${ts}`,
      email: `outlet_exp_${ts}@example.com`,
      passwordHash,
      fullName: `Outlet Export Tester ${ts}`,
      role: 'OUTLET',
      isMasterAdmin: false,
      allowedBillingSaleTypes: [SaleType.RETAIL],
      allowedReportSaleTypes: [SaleType.RETAIL],
      isActive: true,
    },
  });

  const adminAuth = await AuthService.login({ username: adminUser.username, password: 'testpass123' });
  const adminToken = adminAuth.tokens.accessToken;
  const adminRefreshToken = adminAuth.tokens.refreshToken;

  const outletAuth = await AuthService.login({ username: outletUser.username, password: 'testpass123' });
  const outletToken = outletAuth.tokens.accessToken;

  const tsShort = String(ts).slice(-4);
  // 3. Create sample master data and a wholesale sale
  const unit = await prisma.unit.create({
    data: { name: `Unit_${tsShort}`, symbol: `u${tsShort}` },
  });

  const category = await prisma.category.create({
    data: { name: `Cat_${tsShort}`, code: `CAT_${tsShort}` },
  });

  const subcategory = await prisma.subcategory.create({
    data: { name: `Sub_${tsShort}`, code: `SUB_${tsShort}`, categoryId: category.id },
  });

  const product = await prisma.product.create({
    data: {
      name: `Product ${tsShort}`,
      code: `P${tsShort}`,
      subcategory: { connect: { id: subcategory.id } },
      primaryUnit: { connect: { id: unit.id } },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: `Wholesale Mart ${ts}`,
      mobile: `98765${String(ts).slice(-5)}`,
      gstin: '24AAACV1234F1Z5',
      address: 'Shop 10, Central Market',
      city: 'Ahmedabad',
    },
  });

  // Create completed wholesale sale
  const wholesaleSale = await prisma.sale.create({
    data: {
      billNumber: `WS-${ts}`,
      saleType: SaleType.WHOLESALE,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerMobileSnapshot: customer.mobile,
      customerGstinSnapshot: customer.gstin,
      customerTypeSnapshot: 'INDIAN',
      totalItemsCount: 1,
      subtotalAmount: 1000,
      discountAmount: 100,
      taxAmount: 45,
      finalTotalAmount: 945,
      paidAmount: 945,
      changeReturned: 0,
      paymentStatus: 'PAID',
      saleStatus: SaleStatus.COMPLETED,
      createdBy: adminUser.id,
      items: {
        create: [
          {
            productId: product.id,
            productNameSnapshot: product.name,
            unitSymbolSnapshot: 'KG',
            weightOrPackSnapshot: '1 KG',
            quantity: 1,
            baseWeightDeducted: 1000,
            unitRate: 1000,
            subtotal: 1000,
            discount: 100,
            total: 900,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentMode: PaymentMode.CASH,
            amount: 945,
            createdBy: adminUser.id,
          },
        ],
      },
    },
  });

  try {
    // ========================================================
    // PART A: AUTH REFRESH & TOKEN LIFECYCLE
    // ========================================================
    console.log('▶ [1/4] Testing Auth Refresh Token Lifecycle & Resilience...');

    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    assert.equal(refreshRes.status, 200, 'POST /auth/refresh must succeed with HTTP 200');
    const refreshData = (await refreshRes.json()) as any;
    const newAdminToken = refreshData.data?.accessToken || refreshData.data?.tokens?.accessToken;
    assert.ok(newAdminToken, 'Must return new access token');
    markPass('Refresh token exchange produces new valid access token');

    // Test 2: New access token works for authenticated requests
    const profileRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${newAdminToken}` },
    });
    assert.equal(profileRes.status, 200, 'New access token must be authorized for /auth/me');
    markPass('New access token successfully accesses protected endpoints');

    // Test 3: Invalid / forged refresh token is rejected with 401
    const invalidRefreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid.jwt.token' }),
    });
    assert.equal(invalidRefreshRes.status, 401, 'Invalid refresh token must return HTTP 401');
    markPass('Invalid / forged refresh token is rejected with 401');

    // ========================================================
    // PART B: PDF & EXCEL EXPORTS ACROSS ALL 15 REPORTS
    // ========================================================
    console.log('\n▶ [2/4] Testing Excel (.xlsx) and PDF (.pdf) for all 15 Reports...');

    const reportsToTest = [
      { name: 'Sales Report', path: '/reports/sales' },
      { name: 'Product Sales Report', path: '/reports/sales/products' },
      { name: 'Customer Sales Report', path: '/reports/sales/customers' },
      { name: 'Customer History Report', path: `/reports/customers/${customer.id}` },
      { name: 'Production Report', path: '/reports/production' },
      { name: 'Stock Report', path: '/reports/stock' },
      { name: 'Stock Movements Report', path: '/reports/stock/movements' },
      { name: 'Stock Reconciliation Report', path: '/reports/stock/reconciliation' },
      { name: 'Returns Report', path: '/reports/returns' },
      { name: 'Business Summary Report', path: '/reports/business-summary' },
      { name: 'Statutory Sales Register', path: '/reports/statutory/sales' },
      { name: 'Statutory Itemized Sales', path: '/reports/statutory/sales/itemized' },
      { name: 'Statutory Sales Returns', path: '/reports/statutory/returns' },
      { name: 'Statutory GST Summary', path: '/reports/statutory/gst-summary' },
      { name: 'Cash Sales Report', path: '/reports/cash-sales' },
    ];

    for (const r of reportsToTest) {
      // Test Excel export
      const xlsxRes = await fetch(`${baseUrl}${r.path}${r.path.includes('?') ? '&' : '?'}format=xlsx`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(xlsxRes.status, 200, `${r.name} Excel export must return HTTP 200`);
      assert.ok(
        xlsxRes.headers.get('content-type')?.includes('spreadsheetml'),
        `${r.name} Excel Content-Type must be openxmlformats spreadsheet`
      );
      assert.ok(
        xlsxRes.headers.get('content-disposition')?.includes('.xlsx'),
        `${r.name} Content-Disposition must include .xlsx`
      );
      const xlsxBuffer = Buffer.from(await xlsxRes.arrayBuffer());
      // XLSX is a ZIP archive; magic bytes are PK (0x50, 0x4B)
      assert.equal(xlsxBuffer[0], 0x50, `${r.name} Excel buffer must begin with PK magic bytes`);
      assert.equal(xlsxBuffer[1], 0x4b, `${r.name} Excel buffer second byte must be 0x4B`);
      markPass(`${r.name} exported valid .xlsx`);

      // Test PDF export
      const pdfRes = await fetch(`${baseUrl}${r.path}${r.path.includes('?') ? '&' : '?'}format=pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(pdfRes.status, 200, `${r.name} PDF export must return HTTP 200`);
      assert.ok(
        pdfRes.headers.get('content-type')?.includes('application/pdf'),
        `${r.name} PDF Content-Type must be application/pdf`
      );
      assert.ok(
        pdfRes.headers.get('content-disposition')?.includes('.pdf'),
        `${r.name} Content-Disposition must include .pdf`
      );
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
      assert.equal(pdfHeader, '%PDF-', `${r.name} PDF buffer must start with %PDF- header`);
      markPass(`${r.name} exported valid .pdf`);
    }

    // ========================================================
    // PART C: WHOLESALE BILL A4 PDF DOWNLOAD
    // ========================================================
    console.log('\n▶ [3/4] Testing Wholesale Tax Invoice A4 PDF Endpoint...');

    const invoicePdfRes = await fetch(`${baseUrl}/sales/${wholesaleSale.id}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(invoicePdfRes.status, 200, 'GET /sales/:id/pdf must return HTTP 200');
    assert.ok(
      invoicePdfRes.headers.get('content-type')?.includes('application/pdf'),
      'Content-Type must be application/pdf'
    );
    assert.ok(
      invoicePdfRes.headers.get('content-disposition')?.includes(`invoice-${wholesaleSale.billNumber}.pdf`),
      'Content-Disposition must match invoice bill number'
    );
    const invoicePdfBuffer = Buffer.from(await invoicePdfRes.arrayBuffer());
    assert.equal(invoicePdfBuffer.slice(0, 5).toString('ascii'), '%PDF-', 'Invoice PDF must start with %PDF-');
    assert.ok(invoicePdfBuffer.length > 2000, 'Invoice PDF must have substantial content');
    markPass('Wholesale Tax Invoice A4 PDF generated and downloaded with correct metadata');

    // ========================================================
    // PART D: RBAC GUARDS & SCOPED EXPORT SECURITY
    // ========================================================
    console.log('\n▶ [4/4] Testing RBAC Guards & Scope Security on Exports...');

    // Test 1: OUTLET role forbidden from Cash Sales Report Excel and PDF
    const outletCashXlsx = await fetch(`${baseUrl}/reports/cash-sales?format=xlsx`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletCashXlsx.status, 403, 'OUTLET must be forbidden from cash-sales Excel (403)');
    markPass('Non-admin user receives 403 Forbidden on Cash Report Excel export');

    const outletCashPdf = await fetch(`${baseUrl}/reports/cash-sales?format=pdf`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletCashPdf.status, 403, 'OUTLET must be forbidden from cash-sales PDF (403)');
    markPass('Non-admin user receives 403 Forbidden on Cash Report PDF export');

    // Test 2: OUTLET role with allowedReportSaleTypes=[RETAIL] receives 200 for Business Summary scoped to RETAIL, but 403 for unauthorized WHOLESALE
    const outletSummaryXlsx = await fetch(`${baseUrl}/reports/business-summary?format=xlsx`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletSummaryXlsx.status, 200, 'OUTLET must be allowed business-summary Excel within scope');
    const outletSummaryForbidden = await fetch(`${baseUrl}/reports/business-summary?saleType=WHOLESALE&format=xlsx`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletSummaryForbidden.status, 403, 'OUTLET must be forbidden from unauthorized WHOLESALE in business-summary Excel');
    markPass('OUTLET user allowed scoped Business Summary Excel and forbidden from unauthorized SaleTypes (403)');

    // Test 3: OUTLET role forbidden from Stock Reconciliation Excel/PDF
    const outletReconPdf = await fetch(`${baseUrl}/reports/stock/reconciliation?format=pdf`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(outletReconPdf.status, 403, 'OUTLET must be forbidden from reconciliation PDF');
    markPass('Non-admin user receives 403 Forbidden on Stock Reconciliation PDF export');

    // Test 4: Scoped OUTLET user export does not leak wholesale data
    const scopedSalesXlsx = await fetch(`${baseUrl}/reports/statutory/sales?format=csv`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(scopedSalesXlsx.status, 200, 'Scoped user statutory sales export must succeed');
    const csvContent = await scopedSalesXlsx.text();
    assert.ok(
      !csvContent.includes(wholesaleSale.billNumber),
      'Scoped user export must NOT contain Wholesale bills (zero data leakage)'
    );
    markPass('Scoped user export strictly excludes unauthorized Wholesale data');

    console.log('\n========================================================');
    console.log(`📊 ALL EXPORT & AUTH REFRESH TESTS PASSED: ${passedTests} TESTS`);
    console.log('========================================================\n');
  } finally {
    // Cleanup created data
    server.close();
    await prisma.payment.deleteMany({ where: { saleId: wholesaleSale.id } }).catch(() => {});
    await prisma.saleItem.deleteMany({ where: { saleId: wholesaleSale.id } }).catch(() => {});
    await prisma.sale.deleteMany({ where: { id: wholesaleSale.id } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { id: customer.id } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: product.id } }).catch(() => {});
    await prisma.subcategory.deleteMany({ where: { id: subcategory.id } }).catch(() => {});
    await prisma.category.deleteMany({ where: { id: category.id } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { id: unit.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, outletUser.id] } } }).catch(() => {});
  }
}

// Auto-run when executed directly
runExportAndAuthRefreshTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
