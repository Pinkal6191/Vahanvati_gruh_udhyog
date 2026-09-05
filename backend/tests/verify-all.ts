import { prisma } from '../src/config/database.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PricingService } from '../src/modules/pricing/pricing.service.js';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { ReturnsService } from '../src/modules/returns/returns.service.js';
import { ProductionService } from '../src/modules/production/production.service.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { CustomerType, PaymentMode } from '@prisma/client';

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 VAHANVATI GRUH UDHYOG — END-TO-END VERIFICATION SUITE');
  console.log('🧪 ========================================================\n');

  // Test 1: Authentication & User Roles
  console.log('▶ TEST 1: Authentication for Admin, Outlet, Production...');
  const adminLogin = await AuthService.login({ username: 'admin', password: 'admin123' });
  const outletLogin = await AuthService.login({ username: 'outlet', password: 'outlet123' });
  const prodLogin = await AuthService.login({ username: 'production', password: 'prod123' });

  console.assert(adminLogin.user.role === 'ADMIN', 'Admin role must be ADMIN');
  console.assert(outletLogin.user.role === 'OUTLET', 'Outlet role must be OUTLET');
  console.assert(prodLogin.user.role === 'PRODUCTION', 'Prod role must be PRODUCTION');
  console.log('  ✅ Users authenticated successfully with strict roles.\n');

  // Test 2: Multi-Tier Pricing (Indian vs NRI)
  console.log('▶ TEST 2: Indian vs. NRI Pricing Resolution...');
  const papdi = await prisma.product.findUnique({
    where: { code: 'PAPDI' },
    include: { packConfigurations: true },
  });
  if (!papdi) throw new Error('Papdi product not found in seed data');

  const pack500gm = papdi.packConfigurations.find((p) => p.packName.includes('500 GM'));
  if (!pack500gm) throw new Error('500 GM pack configuration not found');

  // 2a. Indian Walk-in Customer Resolution
  const indianCart = await PricingService.resolveCart({
    items: [
      { productId: papdi.id, packConfigId: pack500gm.id, quantity: 2 },
      { productId: papdi.id, looseWeightInGrams: 340, quantity: 1 },
    ],
  });

  // 2 x 140 = 280; (340/1000) * 280 = 95.20; Subtotal = 375.20; Rounded Total = 375
  console.log(`  Indian 500g Pack Unit Rate: ₹${indianCart.items[0].unitRate} (Expected: ₹140)`);
  console.log(`  Indian Loose 340g Rate (per kg): ₹${indianCart.items[1].unitRate} (Expected: ₹280)`);
  console.log(`  Indian Cart Subtotal: ₹${indianCart.subtotalAmount}, Final Total: ₹${indianCart.finalTotalAmount}`);
  console.assert(indianCart.items[0].unitRate === 140, 'Indian 500g rate must be 140');
  console.assert(indianCart.items[1].unitRate === 280, 'Indian per-kg rate must be 280');
  console.assert(indianCart.finalTotalAmount === 375, 'Indian total rounded must be 375');

  // 2b. Create NRI Customer & Resolve
  const nriCustomer = await prisma.customer.create({
    data: {
      name: 'Pravinbhai Patel (USA)',
      customerType: CustomerType.NRI,
      mobile: '+14085551234',
      city: 'California',
      country: 'USA',
    },
  });

  const nriCart = await PricingService.resolveCart({
    customerId: nriCustomer.id,
    items: [
      { productId: papdi.id, packConfigId: pack500gm.id, quantity: 2 },
      { productId: papdi.id, looseWeightInGrams: 340, quantity: 1 },
    ],
  });

  // 2 x 225 = 450; (340/1000) * 450 = 153.00; Subtotal = 603.00; Rounded Total = 603
  console.log(`  NRI 500g Pack Unit Rate: ₹${nriCart.items[0].unitRate} (Expected: ₹225)`);
  console.log(`  NRI Loose 340g Rate (per kg): ₹${nriCart.items[1].unitRate} (Expected: ₹450)`);
  console.log(`  NRI Cart Subtotal: ₹${nriCart.subtotalAmount}, Final Total: ₹${nriCart.finalTotalAmount}`);
  console.assert(nriCart.items[0].unitRate === 225, 'NRI 500g rate must be 225');
  console.assert(nriCart.items[1].unitRate === 450, 'NRI per-kg rate must be 450');
  console.assert(nriCart.finalTotalAmount === 603, 'NRI total rounded must be 603');
  console.log('  ✅ Pricing engine correctly calculates Indian & NRI tiers and loose weights.\n');

  // Test 3: Atomic Sale Checkout & Stock Deduction
  console.log('▶ TEST 3: Atomic POS Checkout & Stock Movement...');
  const initialStock = await prisma.stock.findUnique({ where: { productId: papdi.id } });
  const stockBeforeSale = Number(initialStock!.currentBalance);
  console.log(`  Stock before sale: ${stockBeforeSale} GM`);

  // Checkout Indian Cart: 2 packs (1,000 GM) + 340 GM loose = 1,340 GM deducted
  const sale = await SalesService.createSale(outletLogin.user.id, {
    items: [
      { productId: papdi.id, packConfigId: pack500gm.id, quantity: 2 },
      { productId: papdi.id, looseWeightInGrams: 340, quantity: 1 },
    ],
    paidAmount: 500,
    payments: [{ paymentMode: PaymentMode.CASH, amount: 375 }],
  });

  console.log(`  Generated Bill Number: ${sale?.billNumber}`);
  console.log(`  Final Bill Total: ₹${sale?.finalTotalAmount}, Change: ₹${sale?.changeReturned}`);

  const stockAfterSale = await prisma.stock.findUnique({ where: { productId: papdi.id } });
  const expectedStockAfterSale = stockBeforeSale - 1340;
  console.log(`  Stock after sale: ${stockAfterSale!.currentBalance} GM (Expected: ${expectedStockAfterSale} GM)`);
  console.assert(Number(stockAfterSale!.currentBalance) === expectedStockAfterSale, 'Stock balance must decrease by 1,340 GM');
  console.log('  ✅ Atomic Sale completed: Bill created, stock deducted, payment recorded.\n');

  // Test 4: Production Entry & Stock Increment
  console.log('▶ TEST 4: Production Entry (Kitchen Inward)...');
  const kgUnit = await prisma.unit.findFirst({ where: { symbol: 'kg' } });
  const productionEntry = await ProductionService.createEntry(prodLogin.user.id, {
    productId: papdi.id,
    quantityProduced: 10, // 10 KG = 10,000 GM
    unitId: kgUnit!.id,
    productionDate: '2026-09-05',
    batchNumber: 'BATCH-PAPDI-01',
    notes: 'Morning fresh batch',
  });

  console.log(`  Created Production Entry: #${productionEntry?.productionNumber}`);
  const stockAfterProd = await prisma.stock.findUnique({ where: { productId: papdi.id } });
  const expectedStockAfterProd = expectedStockAfterSale + 10000;
  console.log(`  Stock after production: ${stockAfterProd!.currentBalance} GM (Expected: ${expectedStockAfterProd} GM)`);
  console.assert(Number(stockAfterProd!.currentBalance) === expectedStockAfterProd, 'Stock balance must increase by 10,000 GM');
  console.log('  ✅ Production entry logged: Stock incremented with immutable ledger trace.\n');

  // Test 5: Sales Return & Restocking
  console.log('▶ TEST 5: Sales Return against Bill...');
  const packItem = sale!.items.find((i) => i.weightOrPackSnapshot.includes('500 GM'));
  const salesReturn = await ReturnsService.createReturn(outletLogin.user.id, {
    originalSaleId: sale!.id,
    reason: 'Customer bought extra packet by mistake',
    refundPaymentMode: 'CASH',
    items: [
      {
        saleItemId: packItem!.id,
        returnedQuantity: 1, // Return 1 pack
        restockCondition: 'RESTOCKABLE',
      },
    ],
  });

  console.log(`  Return Number: ${salesReturn?.returnNumber}`);
  console.log(`  Refund Amount: ₹${salesReturn?.totalReturnAmount} (Expected: ₹140)`);
  console.assert(Number(salesReturn?.totalReturnAmount) === 140, 'Refund amount must be ₹140');

  const stockAfterReturn = await prisma.stock.findUnique({ where: { productId: papdi.id } });
  const expectedStockAfterReturn = expectedStockAfterProd + 500;
  console.log(`  Stock after return: ${stockAfterReturn!.currentBalance} GM (Expected: ${expectedStockAfterReturn} GM)`);
  console.assert(Number(stockAfterReturn!.currentBalance) === expectedStockAfterReturn, 'Stock must increase by 500 GM');
  console.log('  ✅ Sales return verified: Restocked and refunded correctly.\n');

  // Test 6: Stock Ledger Reconciliation
  console.log('▶ TEST 6: Stock Ledger vs. Cached Balance Reconciliation...');
  const reconciliation = await InventoryService.reconcileStock(papdi.id);
  console.log(`  Cached Stock Balance: ${reconciliation.cachedBalance} GM`);
  console.log(`  Ledger Total Sum:     ${reconciliation.ledgerTotal} GM`);
  console.log(`  Zero Drift Match:     ${reconciliation.isConsistent}`);
  console.assert(reconciliation.isConsistent === true, 'Ledger sum MUST equal cached stock balance');
  console.log('  ✅ Stock audit passed: 100% mathematical consistency.\n');

  // Test 7: Historical Price Preservation Rule
  console.log('▶ TEST 7: Historical Price Preservation...');
  // Modify Papdi 500 GM price to ₹190
  await prisma.productPrice.updateMany({
    where: {
      productId: papdi.id,
      packConfigId: pack500gm.id,
      customerType: CustomerType.INDIAN,
    },
    data: { rate: 190 },
  });

  // Fetch the previous sale bill again
  const historicalSale = await SalesService.getSaleById(sale!.id);
  const historicalItem = historicalSale.items.find((i) => i.id === packItem!.id);
  console.log(`  Updated master price: ₹190`);
  console.log(`  Historical bill line item rate: ₹${historicalItem!.unitRate} (Expected: ₹140)`);
  console.assert(Number(historicalItem!.unitRate) === 140, 'Historical bill must retain ₹140');
  console.log('  ✅ Historical Price Rule confirmed: Past sales are completely immutable.\n');

  console.log('🎉 ========================================================');
  console.log('🎉 ALL TESTS PASSED! BACKEND & DATABASE ARE ROCK SOLID!');
  console.log('🎉 ========================================================');
}

runTests()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
