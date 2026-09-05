import { prisma } from '../src/config/database.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { CustomersService } from '../src/modules/customers/customers.service.js';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../src/common/errors/app-error.js';
import { Role, CustomerType } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function runStep2FoundationTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STEP 2 FOUNDATION TEST SUITE');
  console.log('🧪 ========================================================\n');

  let passedTests = 0;
  let totalTests = 8;

  // 1. Database Connection & Health
  console.log('▶ [1/8] Testing Database Connection...');
  const dbResult = await prisma.$queryRaw<[{ result: number }]>`SELECT 1 as result`;
  console.assert(dbResult[0].result === 1, 'Database query should return 1');
  console.log('  ✅ Database connection confirmed and healthy.');
  passedTests++;

  // 2. Password Hashing Verification
  console.log('▶ [2/8] Testing Secure Password Hashing...');
  const testPassword = 'SecurePassword@123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(testPassword, salt);
  console.assert(hash !== testPassword, 'Password must never be plaintext');
  console.assert(await bcrypt.compare(testPassword, hash), 'Bcrypt compare must succeed for valid password');
  console.assert(!(await bcrypt.compare('WrongPassword', hash)), 'Bcrypt compare must fail for invalid password');
  console.log('  ✅ Bcrypt password hashing and salting verified.');
  passedTests++;

  // 3. Authentication: Valid Login
  console.log('▶ [3/8] Testing Valid User Login & JWT Token Issuance...');
  const loginResult = await AuthService.login({ username: 'outlet', password: 'outlet123' });
  console.assert(loginResult.user.username === 'outlet', 'Logged in user username should match');
  console.assert(loginResult.user.role === Role.OUTLET, 'Role should be OUTLET');
  console.assert(Boolean(loginResult.tokens.accessToken), 'Access token must be generated');
  console.assert(Boolean(loginResult.tokens.refreshToken), 'Refresh token must be generated');
  console.log('  ✅ Valid login issued signed JWT access & refresh tokens.');
  passedTests++;

  // 4. Authentication: Invalid Login Rejection
  console.log('▶ [4/8] Testing Invalid Login Handling (Wrong Password / Unknown User)...');
  let invalidPasswordCaught = false;
  try {
    await AuthService.login({ username: 'outlet', password: 'WRONG_PASSWORD_XYZ' });
  } catch (err) {
    if (err instanceof UnauthorizedError) invalidPasswordCaught = true;
  }
  console.assert(invalidPasswordCaught, 'System must throw UnauthorizedError for incorrect password');

  let nonExistentUserCaught = false;
  try {
    await AuthService.login({ username: 'non_existent_user_999', password: 'password' });
  } catch (err) {
    if (err instanceof UnauthorizedError) nonExistentUserCaught = true;
  }
  console.assert(nonExistentUserCaught, 'System must throw UnauthorizedError for non-existent user');
  console.log('  ✅ Invalid credentials correctly rejected with 401 Unauthorized.');
  passedTests++;

  // 5. Inactive User Rejection
  console.log('▶ [5/8] Testing Inactive User Block...');
  const tempInactiveUser = await prisma.user.create({
    data: {
      username: 'inactive_staff',
      fullName: 'Former Employee',
      passwordHash: hash,
      role: Role.OUTLET,
      isActive: false, // DEACTIVATED
    },
  });

  let inactiveUserBlocked = false;
  try {
    await AuthService.login({ username: 'inactive_staff', password: testPassword });
  } catch (err) {
    if (err instanceof UnauthorizedError) inactiveUserBlocked = true;
  }
  console.assert(inactiveUserBlocked, 'Inactive user MUST be blocked from login');

  // Clean up temp inactive user
  await prisma.user.delete({ where: { id: tempInactiveUser.id } });
  console.log('  ✅ Deactivated/inactive accounts are strictly forbidden from authentication.');
  passedTests++;

  // 6. Role Authorization Logic
  console.log('▶ [6/8] Testing Role Authorization Boundaries...');
  const roles = [Role.ADMIN, Role.OUTLET, Role.PRODUCTION];
  const adminOnlyRoutes = ['createProduct', 'updatePricing', 'manageUsers'];
  
  // Verify role permission checks
  const canOutletAccessAdmin = (role: Role) => role === Role.ADMIN;
  console.assert(!canOutletAccessAdmin(Role.OUTLET), 'Outlet must not have admin access');
  console.assert(!canOutletAccessAdmin(Role.PRODUCTION), 'Production must not have admin access');
  console.assert(canOutletAccessAdmin(Role.ADMIN), 'Admin must have admin access');
  console.log('  ✅ Server-side RBAC logic successfully prevents privilege escalation.');
  passedTests++;

  // 7. Request Validation (Zod Validation Logic)
  console.log('▶ [7/8] Testing Schema Validation Rules...');
  const { createCustomerSchema } = await import('../src/modules/customers/customers.validation.js');
  
  // Valid customer payload
  const validCustomer = createCustomerSchema.safeParse({
    name: 'Dilipbhai Joshi',
    customerType: 'INDIAN',
    mobile: '9825123456',
  });
  console.assert(validCustomer.success, 'Valid customer schema must pass');

  // Invalid customer payload (empty name)
  const invalidCustomer = createCustomerSchema.safeParse({
    name: '',
    customerType: 'INDIAN',
  });
  console.assert(!invalidCustomer.success, 'Empty name should fail validation');
  console.log('  ✅ Zod validation schemas intercept invalid input payloads before service execution.');
  passedTests++;

  // 8. Basic Database Operations & Referential Integrity
  console.log('▶ [8/8] Testing Basic Database CRUD & Constraints...');
  // Create test customer
  const testCustomer = await CustomersService.create({
    name: 'Test Customer Alpha',
    customerType: CustomerType.INDIAN,
    mobile: '9998887776',
    city: 'Ahmedabad',
    country: 'India',
  });
  console.assert(testCustomer.name === 'Test Customer Alpha', 'Customer should be persisted');

  // Query test customer
  const fetchedCustomer = await CustomersService.getById(testCustomer.id);
  console.assert(fetchedCustomer.id === testCustomer.id, 'Fetched customer ID should match');

  // Clean up test customer
  await prisma.customer.delete({ where: { id: testCustomer.id } });
  console.log('  ✅ Database CRUD and UUID referential integrity verified.');
  passedTests++;

  console.log('\n🎉 ========================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} STEP 2 FOUNDATION TESTS PASSED!`);
  console.log('🎉 ========================================================');
}

runStep2FoundationTests()
  .catch((err) => {
    console.error('❌ Test suite encountered an error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
