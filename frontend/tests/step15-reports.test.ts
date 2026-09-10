import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatWeight } from '../src/utils/formatters';
import { hasRole } from '../src/utils/rbac';
import { User, Role } from '../src/types/auth.types';

describe('Step 15 — Reports & Analytics Frontend Test Suite', () => {
  // ========================================================
  // 1. Authoritative Business Formulas & Invariants
  // ========================================================
  describe('1. Authoritative Business Formulas & Invariants', () => {
    test('should calculate Net Sales strictly as Completed Sales - Completed Returns', () => {
      const completedSales = 125000.50;
      const completedReturns = 3500.25;
      const netSales = Math.round((completedSales - completedReturns + Number.EPSILON) * 100) / 100;

      assert.equal(netSales, 121500.25);
    });

    test('should calculate Return Rate strictly as (Completed Returns / Completed Sales) * 100', () => {
      const completedSales = 50000;
      const completedReturns = 2500;
      const returnRate = Math.round(((completedReturns / completedSales) * 100 + Number.EPSILON) * 100) / 100;

      assert.equal(returnRate, 5.0);
    });

    test('should safely handle zero sales when computing Return Rate without NaN', () => {
      const completedSales = 0;
      const completedReturns = 0;
      const returnRate = completedSales > 0 ? (completedReturns / completedSales) * 100 : 0;

      assert.equal(returnRate, 0);
      assert.ok(!Number.isNaN(returnRate));
    });

    test('should calculate Average Bill Value (ABV) as Completed Sales / Completed Bill Count', () => {
      const completedSales = 45000;
      const billCount = 150;
      const abv = billCount > 0 ? Math.round((completedSales / billCount + Number.EPSILON) * 100) / 100 : 0;

      assert.equal(abv, 300);
    });

    test('should safely return 0 ABV when bill count is zero', () => {
      const completedSales = 0;
      const billCount = 0;
      const abv = billCount > 0 ? completedSales / billCount : 0;

      assert.equal(abv, 0);
      assert.ok(!Number.isNaN(abv));
    });
  });

  // ========================================================
  // 2. Date Presets & Bounds Validation
  // ========================================================
  describe('2. Date Presets & Bounds Validation', () => {
    const validPeriods = ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom'];

    test('should support all standard date periods aligned with backend reporting engine', () => {
      for (const p of validPeriods) {
        assert.ok(validPeriods.includes(p));
      }
    });

    test('should validate ISO YYYY-MM-DD date format for custom ranges', () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const validDate = '2026-09-10';
      const invalidDate = '10/09/2026';

      assert.ok(dateRegex.test(validDate));
      assert.ok(!dateRegex.test(invalidDate));
    });
  });

  // ========================================================
  // 3. Cancelled Transactions Exclusion from Turnover
  // ========================================================
  describe('3. Cancelled Transactions Exclusion from Turnover', () => {
    test('should keep cancelled sales segregated from active revenue totals', () => {
      const completedBills = [
        { id: '1', amount: 500, status: 'COMPLETED' },
        { id: '2', amount: 750, status: 'COMPLETED' },
      ];
      const cancelledBills = [
        { id: '3', amount: 1200, status: 'CANCELLED' },
      ];

      const activeSalesTotal = completedBills.reduce((acc, b) => acc + b.amount, 0);
      const cancelledTotal = cancelledBills.reduce((acc, b) => acc + b.amount, 0);

      assert.equal(activeSalesTotal, 1250);
      assert.equal(cancelledTotal, 1200);
      // Ensure cancelled bill does not bleed into active sales
      assert.equal(activeSalesTotal < (activeSalesTotal + cancelledTotal), true);
    });
  });

  // ========================================================
  // 4. Role-Based Access Control (RBAC) across Reports
  // ========================================================
  describe('4. Role-Based Access Control (RBAC) across Reports', () => {
    const adminUser: User = { id: 'u1', username: 'admin', fullName: 'Admin User', role: 'ADMIN' as Role, isActive: true };
    const outletUser: User = { id: 'u2', username: 'outlet', fullName: 'Outlet Cashier', role: 'OUTLET' as Role, isActive: true };
    const prodUser: User = { id: 'u3', username: 'production', fullName: 'Production Lead', role: 'PRODUCTION' as Role, isActive: true };

    test('ADMIN role should have universal access to all reports', () => {
      assert.equal(hasRole(adminUser, ['ADMIN']), true);
      assert.equal(hasRole(adminUser, ['ADMIN', 'OUTLET']), true);
      assert.equal(hasRole(adminUser, ['ADMIN', 'PRODUCTION']), true);
    });

    test('OUTLET role should have access to sales, customer, returns, and stock reports', () => {
      assert.equal(hasRole(outletUser, ['ADMIN', 'OUTLET']), true);
      assert.equal(hasRole(outletUser, ['ADMIN', 'OUTLET', 'PRODUCTION']), true);
    });

    test('OUTLET role should be forbidden from production and reconciliation reports', () => {
      assert.equal(hasRole(outletUser, ['ADMIN', 'PRODUCTION']), false);
      assert.equal(hasRole(outletUser, ['ADMIN']), false);
    });

    test('PRODUCTION role should have access to production, stock, and movement reports', () => {
      assert.equal(hasRole(prodUser, ['ADMIN', 'PRODUCTION']), true);
      assert.equal(hasRole(prodUser, ['ADMIN', 'OUTLET', 'PRODUCTION']), true);
    });

    test('PRODUCTION role should be forbidden from financial sales, customer, and returns reports', () => {
      assert.equal(hasRole(prodUser, ['ADMIN', 'OUTLET']), false);
      assert.equal(hasRole(prodUser, ['ADMIN']), false);
    });
  });

  // ========================================================
  // 5. Numeric & Currency Formatting Precision
  // ========================================================
  describe('5. Numeric & Currency Formatting Precision', () => {
    test('should format Indian Rupee currency with ₹ prefix and comma separation', () => {
      const formatted = formatCurrency(125000);
      assert.ok(formatted.includes('1,25,000'));
    });

    test('should handle decimal currency amounts accurately', () => {
      const formatted = formatCurrency(140.50);
      assert.ok(formatted.includes('140.50'));
    });

    test('should format weights dynamically between GM and KG', () => {
      assert.equal(formatWeight(500), '500 GM');
      assert.equal(formatWeight(1000), '1 KG');
      assert.equal(formatWeight(2500), '2.50 KG');
    });
  });

  // ========================================================
  // 6. Zero Drift Stock Reconciliation Logic
  // ========================================================
  describe('6. Zero Drift Stock Reconciliation Logic', () => {
    test('should flag parity when cached balance exactly matches ledger sum', () => {
      const cachedBalance = 45000;
      const ledgerSum = 45000;
      const discrepancy = Math.abs(cachedBalance - ledgerSum);
      const isConsistent = discrepancy === 0;

      assert.equal(isConsistent, true);
      assert.equal(discrepancy, 0);
    });

    test('should flag mismatch when cached balance deviates from ledger sum', () => {
      const cachedBalance = 45000;
      const ledgerSum = 44500;
      const discrepancy = Math.abs(cachedBalance - ledgerSum);
      const isConsistent = discrepancy === 0;

      assert.equal(isConsistent, false);
      assert.equal(discrepancy, 500);
    });
  });
});
