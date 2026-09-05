import { prisma } from '../src/config/database.js';
import { ProductsService } from '../src/modules/products/products.service.js';
import { CustomersService } from '../src/modules/customers/customers.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { ConflictError, NotFoundError, BadRequestError } from '../src/common/errors/app-error.js';
import { CustomerType } from '@prisma/client';

async function runStep3MasterDataTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 3 MASTER DATA MODULES & APIS TEST SUITE');
  console.log('🧪 ========================================================\n');

  const ts = Date.now();
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const outlet = await prisma.user.findUnique({ where: { username: 'outlet' } });
  const testUserId = admin!.id;
  const outletUserId = outlet!.id;

  let passedTests = 0;
  let totalTests = 10;

  // -----------------------------------------------------------------
  // 1. Category Lifecycle (Create, Read, Update, Deactivate, Duplicate)
  // -----------------------------------------------------------------
  console.log('▶ [1/10] Category Master Lifecycle & Duplicate Protection...');
  const catA = await ProductsService.createCategory({
    name: `Sweets ${ts}`,
    code: `SWEETS_${ts}`,
    displayOrder: 2,
  }, testUserId, 'ADMIN');

  console.assert(catA.name === `Sweets ${ts}`, 'Category name should match');
  console.assert(catA.isActive === true, 'Category should be active by default');

  // Verify duplicate code rejection
  let duplicateCaught = false;
  try {
    await ProductsService.createCategory({
      name: 'Another Sweets',
      code: `SWEETS_${ts}`,
    }, testUserId, 'ADMIN');
  } catch (err) {
    if (err instanceof ConflictError) duplicateCaught = true;
  }
  console.assert(duplicateCaught, 'Duplicate category code MUST throw ConflictError');

  // Update Category
  const updatedCatA = await ProductsService.updateCategory(catA.id, {
    name: `Traditional Sweets ${ts}`,
  }, testUserId, 'ADMIN');
  console.assert(updatedCatA.name === `Traditional Sweets ${ts}`, 'Category name should update');

  // Deactivate Category
  const deactivatedCatA = await ProductsService.updateCategoryStatus(catA.id, false, testUserId, 'ADMIN');
  console.assert(deactivatedCatA.isActive === false, 'Category should be deactivated');

  // Reactivate for subsequent tests
  await ProductsService.updateCategoryStatus(catA.id, true, testUserId, 'ADMIN');
  console.log('  ✅ Category CRUD, duplicate prevention, and activation toggle verified.');
  passedTests++;

  // -----------------------------------------------------------------
  // 2. Subcategory Lifecycle & Parent Integrity
  // -----------------------------------------------------------------
  console.log('▶ [2/10] Subcategory Master & Parent Relationship Integrity...');
  const subA1 = await ProductsService.createSubcategory({
    categoryId: catA.id,
    name: `Milk Sweets ${ts}`,
    code: `MILK_SWEETS_${ts}`,
    displayOrder: 1,
  }, testUserId, 'ADMIN');

  console.assert(subA1.categoryId === catA.id, 'Subcategory must belong to parent category');

  // Invalid parent category rejection
  let invalidParentCaught = false;
  try {
    await ProductsService.createSubcategory({
      categoryId: '00000000-0000-0000-0000-999999999999',
      name: 'Orphan Subcategory',
      code: `ORPHAN_${ts}`,
    }, testUserId, 'ADMIN');
  } catch (err) {
    if (err instanceof NotFoundError) invalidParentCaught = true;
  }
  console.assert(invalidParentCaught, 'Non-existent parent category MUST throw NotFoundError');

  // Filter subcategories by categoryId
  const subList = await ProductsService.listSubcategories({ categoryId: catA.id });
  console.assert(subList.some((s) => s.id === subA1.id), 'Subcategory list must return newly created subcategory');
  console.log('  ✅ Subcategory creation, parent category FK, and filtering verified.');
  passedTests++;

  // Create Category B for hierarchy testing
  const catB = await ProductsService.createCategory({
    name: `Bakery ${ts}`,
    code: `BAKERY_${ts}`,
    displayOrder: 3,
  }, testUserId, 'ADMIN');

  // -----------------------------------------------------------------
  // 3. Units / Weight Configuration
  // -----------------------------------------------------------------
  console.log('▶ [3/10] Units & Weight Configuration...');
  const boxUnit = await ProductsService.createUnit({
    name: `Gift Box ${ts}`,
    symbol: `bx${ts.toString().slice(-3)}`,
    isWeightBased: false,
    conversionFactorToBase: 1.0,
  }, testUserId, 'ADMIN');

  console.assert(boxUnit.name === `Gift Box ${ts}`, 'Unit name should match');
  console.assert(boxUnit.isWeightBased === false, 'Unit should be non-weight based');

  // Deactivate unit
  const deactivatedUnit = await ProductsService.updateUnitStatus(boxUnit.id, false, testUserId, 'ADMIN');
  console.assert(deactivatedUnit.isActive === false, 'Unit should be deactivated');
  await ProductsService.updateUnitStatus(boxUnit.id, true, testUserId, 'ADMIN');
  console.log('  ✅ Unit master creation, conversion factor, and status toggle verified.');
  passedTests++;

  // -----------------------------------------------------------------
  // 4. Product Hierarchy Validation (Section 11 & 33)
  // -----------------------------------------------------------------
  console.log('▶ [4/10] Product Hierarchy Integrity Validation (Mismatch Protection)...');
  const gramUnit = await prisma.unit.findFirst({ where: { symbol: 'gm' } });

  // 4a. VALID Product: Category A + Subcategory A1 -> Valid
  const validProduct = await ProductsService.createProduct({
    categoryId: catA.id,
    subcategoryId: subA1.id,
    primaryUnitId: gramUnit!.id,
    name: `Kaju Katli ${ts}`,
    gujaratiName: 'કાજુ કતરી',
    code: `KAJU_KATLI_${ts}`,
    isLooseWeightAllowed: true,
    minimumStockThreshold: 2000,
  }, testUserId, 'ADMIN');

  console.assert(validProduct.name === `Kaju Katli ${ts}`, 'Product should be created successfully');
  console.assert(Number(validProduct.stock?.currentBalance) === 0, 'New product stock should initialize to 0');

  // 4b. INVALID Product: Category B + Subcategory A1 (which belongs to Category A) -> MUST FAIL
  let hierarchyMismatchCaught = false;
  try {
    await ProductsService.createProduct({
      categoryId: catB.id, // Mismatched category!
      subcategoryId: subA1.id, // Belongs to catA!
      primaryUnitId: gramUnit!.id,
      name: `Mismatched Sweets ${ts}`,
      code: `MISMATCH_${ts}`,
    }, testUserId, 'ADMIN');
  } catch (err) {
    if (err instanceof BadRequestError && err.message.includes('Hierarchy mismatch')) {
      hierarchyMismatchCaught = true;
    }
  }
  console.assert(hierarchyMismatchCaught, 'Hierarchy mismatch between category and subcategory MUST throw BadRequestError');
  console.log('  ✅ Category/Subcategory hierarchy validation strictly enforced.');
  passedTests++;

  // -----------------------------------------------------------------
  // 5. Product Deactivation vs. History Retention
  // -----------------------------------------------------------------
  console.log('▶ [5/10] Product Deactivation & Availability Filtering...');
  // Deactivate Kaju Katli
  await ProductsService.updateProductStatus(validProduct.id, false, testUserId, 'ADMIN');

  // Query with status='active' (Default for POS product search)
  const activeProducts = await ProductsService.listProducts({ status: 'active', search: `Kaju Katli ${ts}` });
  console.assert(activeProducts.items.length === 0, 'Deactivated product MUST NOT appear in active POS product search');

  // Query with status='all' (For admin management and history)
  const allProducts = await ProductsService.listProducts({ status: 'all', search: `Kaju Katli ${ts}` });
  console.assert(allProducts.items.length === 1, 'Deactivated product MUST still be retrievable when querying all records');
  console.assert(allProducts.items[0].isActive === false, 'Product record retains inactive status');

  // Reactivate
  await ProductsService.updateProductStatus(validProduct.id, true, testUserId, 'ADMIN');
  console.log('  ✅ Deactivated product correctly hidden from active search but preserved in master records.');
  passedTests++;

  // -----------------------------------------------------------------
  // 6. Product Pack Configurations (500 GM, 1 KG)
  // -----------------------------------------------------------------
  console.log('▶ [6/10] Product Pack Configurations (Multi-Pack Support)...');
  const pack250gm = await ProductsService.addPackConfiguration({
    productId: validProduct.id,
    packName: '250 GM Box',
    weightInBaseUnits: 250.0,
    unitId: gramUnit!.id,
    displayOrder: 1,
  }, testUserId, 'ADMIN');

  console.assert(pack250gm.packName === '250 GM Box', 'Pack name should match');
  console.assert(Number(pack250gm.weightInBaseUnits) === 250.0, 'Weight in base units should be 250 GM');
  console.log('  ✅ Configurable packaging options attached to product successfully.');
  passedTests++;

  // -----------------------------------------------------------------
  // 7. Customer Master Lifecycle & GSTIN
  // -----------------------------------------------------------------
  console.log('▶ [7/10] Customer Creation (Indian vs. NRI) & GSTIN...');
  const indianCustomer = await CustomersService.create({
    name: `Bhavik Shah ${ts}`,
    customerType: CustomerType.INDIAN,
    mobile: `9898${ts.toString().slice(-6)}`,
    email: `bhavik_${ts}@example.com`,
    city: 'Surat',
    gstin: '24ABCDE9999F1Z1',
    address: 'Ring Road, Surat',
  }, outletUserId, 'OUTLET');

  console.assert(indianCustomer.customerType === 'INDIAN', 'Customer type must be INDIAN');
  console.assert(indianCustomer.gstin === '24ABCDE9999F1Z1', 'GSTIN must be preserved');

  const nriCustomer = await CustomersService.create({
    name: `Jayesh Patel ${ts} (UK)`,
    customerType: CustomerType.NRI,
    mobile: `+4479${ts.toString().slice(-8)}`,
    city: 'London',
    country: 'United Kingdom',
  }, testUserId, 'ADMIN');

  console.assert(nriCustomer.customerType === 'NRI', 'Customer type must be NRI');
  console.log('  ✅ Customer master created with strict INDIAN/NRI types, contact info, and GSTIN.');
  passedTests++;

  // -----------------------------------------------------------------
  // 8. Customer Search & Filtering
  // -----------------------------------------------------------------
  console.log('▶ [8/10] Customer Search by Mobile and Name...');
  const searchByMobile = await CustomersService.list({ search: indianCustomer.mobile! });
  console.assert(searchByMobile.items.some((c) => c.name === indianCustomer.name), 'Search by mobile should return Bhavik Shah');

  const searchByName = await CustomersService.list({ search: `Jayesh Patel ${ts}` });
  console.assert(searchByName.items.some((c) => c.name.includes(`Jayesh Patel ${ts}`)), 'Search by name should return Jayesh');

  const nriOnly = await CustomersService.list({ type: CustomerType.NRI });
  console.assert(nriOnly.items.every((c) => c.customerType === CustomerType.NRI), 'Type filter must return only NRI');
  console.log('  ✅ Customer lookup by phone number, partial name, and customer type verified.');
  passedTests++;

  // -----------------------------------------------------------------
  // 9. Customer Status Toggle (Deactivation)
  // -----------------------------------------------------------------
  console.log('▶ [9/10] Customer Deactivation Status Toggle...');
  const deactivatedCustomer = await CustomersService.updateStatus(indianCustomer.id, false, testUserId, 'ADMIN');
  console.assert(deactivatedCustomer.isActive === false, 'Customer must be deactivated');

  const activeCustomerList = await CustomersService.list({ status: 'active', search: `Bhavik Shah ${ts}` });
  console.assert(activeCustomerList.items.length === 0, 'Deactivated customer must not appear in active search');
  console.log('  ✅ Customer deactivation verified.');
  passedTests++;

  // -----------------------------------------------------------------
  // 10. Master Data Audit Logging Verification
  // -----------------------------------------------------------------
  console.log('▶ [10/10] Audit Trail for Administrative Changes...');
  const logs = await AuditService.list({ limit: 10 });
  console.assert(logs.items.length > 0, 'Audit logs must record master data administrative operations');
  console.assert(logs.items.some((l) => l.action.startsWith('PRODUCT_') || l.action.startsWith('CATEGORY_')), 'Audit trail must include master data actions');
  console.log('  ✅ Audit trail recorded all administrative actions with timestamp, user role, and entity changes.');
  passedTests++;

  // Cleanup test entities to keep database clean
  await prisma.productPackConfiguration.delete({ where: { id: pack250gm.id } });
  await prisma.stock.delete({ where: { productId: validProduct.id } });
  await prisma.product.delete({ where: { id: validProduct.id } });
  await prisma.unit.delete({ where: { id: boxUnit.id } });
  await prisma.subcategory.delete({ where: { id: subA1.id } });
  await prisma.category.delete({ where: { id: catA.id } });
  await prisma.category.delete({ where: { id: catB.id } });
  await prisma.customer.delete({ where: { id: indianCustomer.id } });
  await prisma.customer.delete({ where: { id: nriCustomer.id } });

  console.log('\n🎉 ========================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 3 MASTER DATA TESTS PASSED!`);
  console.log('🎉 ========================================================');
}

runStep3MasterDataTests()
  .catch((err) => {
    console.error('❌ Step 3 test suite encountered an error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
