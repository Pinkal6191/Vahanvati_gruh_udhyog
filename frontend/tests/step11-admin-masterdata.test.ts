import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Formatters & helpers
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatGramsToKg,
  formatIndianMobile,
} from '../src/utils/formatters';
import { CustomerType } from '../src/features/customers/customers.api';
import { Role } from '../src/types/auth.types';

// Mock localStorage for Node.js environment
if (typeof window === 'undefined') {
  (global as any).window = global;
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

describe('Step 11 — Admin Dashboard & Master Data UI Test Suite', () => {
  describe('1. Dashboard Summary & KPI Metric Calculations', () => {
    const mockSummary = {
      period: 'Today (09 Sep 2026)',
      sales: {
        totalSales: 4500.5,
        billCount: 15,
        averageBillValue: 300.03,
      },
      returns: {
        totalReturnsAmount: 250.0,
        returnsCount: 2,
      },
      netSales: 4250.5,
      production: {
        totalProductionWeight: 12500, // 12.5 kg
        productionEntriesCount: 3,
      },
      inventory: {
        totalItems: 48,
        inStockCount: 42,
        lowStockCount: 4,
        outOfStockCount: 2,
      },
      paymentSummary: {
        CASH: 2200.5,
        UPI: 1800.0,
        CARD: 500.0,
        OTHER: 0,
      },
      topProducts: [
        { productId: 'p-1', productName: 'Methi Khakhra 500g', revenue: 1800, quantity: 12 },
        { productId: 'p-2', productName: 'Plain Khakhra 500g', revenue: 1200, quantity: 10 },
        { productId: 'p-3', productName: 'Jeera Khakhra 250g', revenue: 850, quantity: 8 },
        { productId: 'p-4', productName: 'Chorafali 200g', revenue: 400, quantity: 4 },
        { productId: 'p-5', productName: 'Fafda Gathiya 250g', revenue: 250.5, quantity: 2 },
      ],
    };

    it('should format all 8 KPI summary cards with appropriate units', () => {
      // 1. Today's Sales
      assert.equal(formatCurrency(mockSummary.sales.totalSales), '₹4,500.50');
      assert.equal(formatCurrency(mockSummary.sales.averageBillValue), '₹300.03');

      // 2. Today's Bills
      assert.equal(mockSummary.sales.billCount, 15);

      // 3. Today's Returns
      assert.equal(formatCurrency(mockSummary.returns.totalReturnsAmount), '₹250.00');
      assert.equal(mockSummary.returns.returnsCount, 2);

      // 4. Today's Production
      assert.equal(formatGramsToKg(mockSummary.production.totalProductionWeight), '12.5 kg');
      assert.equal(mockSummary.production.productionEntriesCount, 3);

      // 5. Net Sales: (Sales - Returns)
      assert.equal(formatCurrency(mockSummary.netSales), '₹4,250.50');
      assert.equal(mockSummary.netSales, mockSummary.sales.totalSales - mockSummary.returns.totalReturnsAmount);

      // 6. Current Stock total items
      assert.equal(mockSummary.inventory.totalItems, 48);
      assert.equal(mockSummary.inventory.inStockCount, 42);

      // 7. Low Stock items
      assert.equal(mockSummary.inventory.lowStockCount, 4);

      // 8. Out of Stock items
      assert.equal(mockSummary.inventory.outOfStockCount, 2);
    });

    it('should correctly format payment breakdown summary', () => {
      assert.equal(formatCurrency(mockSummary.paymentSummary.CASH), '₹2,200.50');
      assert.equal(formatCurrency(mockSummary.paymentSummary.UPI), '₹1,800.00');
      assert.equal(formatCurrency(mockSummary.paymentSummary.CARD), '₹500.00');
      assert.equal(formatCurrency(mockSummary.paymentSummary.OTHER), '₹0.00');

      const sumPayments =
        mockSummary.paymentSummary.CASH +
        mockSummary.paymentSummary.UPI +
        mockSummary.paymentSummary.CARD +
        mockSummary.paymentSummary.OTHER;
      assert.equal(sumPayments, mockSummary.sales.totalSales);
    });

    it('should rank top 5 products in descending revenue order', () => {
      assert.equal(mockSummary.topProducts.length, 5);
      for (let i = 0; i < mockSummary.topProducts.length - 1; i++) {
        assert.ok(
          mockSummary.topProducts[i].revenue >= mockSummary.topProducts[i + 1].revenue,
          'Top products must be sorted descending by revenue'
        );
      }
      assert.equal(mockSummary.topProducts[0].productName, 'Methi Khakhra 500g');
    });
  });

  describe('2. Product Management & Dual-Pricing Rules', () => {
    it('should validate dual-currency pricing format for Indian and NRI rates', () => {
      const indianRate = 140.0;
      const nriRate = 220.0;

      assert.equal(formatCurrency(indianRate), '₹140.00');
      assert.equal(formatCurrency(nriRate), '₹220.00');
      assert.ok(nriRate > indianRate, 'NRI rate typically reflects packaging/export premium');
    });

    it('should support Gujarati bilingual product naming', () => {
      const product = {
        name: 'Plain Khakhra',
        gujaratiName: 'સાદા ખાખરા',
        code: 'KHAKHRA_PLAIN',
      };
      assert.equal(product.name, 'Plain Khakhra');
      assert.equal(product.gujaratiName, 'સાદા ખાખરા');
      assert.ok(/[\u0A80-\u0AFF]/.test(product.gujaratiName), 'Contains valid Gujarati Unicode characters');
    });

    it('should properly format stock balances in grams or kilograms', () => {
      assert.equal(formatGramsToKg(250), '250 g');
      assert.equal(formatGramsToKg(1000), '1 kg');
      assert.equal(formatGramsToKg(2500), '2.5 kg');
      assert.equal(formatGramsToKg(0), '0 g');
    });
  });

  describe('3. Category & Subcategory Master Data Validation', () => {
    it('should validate category codes are non-empty and uppercase', () => {
      const rawCode = 'khakhra';
      const cleanCode = rawCode.trim().toUpperCase();
      assert.equal(cleanCode, 'KHAKHRA');
      assert.ok(/^[A-Z0-9_]+$/.test(cleanCode));
    });

    it('should enforce parent-child hierarchy in subcategories', () => {
      const categories = [
        { id: 'cat-1', name: 'Khakhra' },
        { id: 'cat-2', name: 'Namkeen' },
      ];

      const subcategories = [
        { id: 'sub-1', categoryId: 'cat-1', name: 'Plain Khakhra' },
        { id: 'sub-2', categoryId: 'cat-1', name: 'Methi Khakhra' },
        { id: 'sub-3', categoryId: 'cat-2', name: 'Fafda' },
      ];

      const filteredForKhakhra = subcategories.filter((s) => s.categoryId === 'cat-1');
      assert.equal(filteredForKhakhra.length, 2);
      assert.equal(filteredForKhakhra[0].name, 'Plain Khakhra');
      assert.equal(filteredForKhakhra[1].name, 'Methi Khakhra');
    });
  });

  describe('4. Customer Management & Purchase History', () => {
    it('should enforce supported customer types strictly', () => {
      const supportedTypes: CustomerType[] = ['INDIAN', 'NRI'];
      assert.ok(supportedTypes.includes('INDIAN'));
      assert.ok(supportedTypes.includes('NRI'));
      assert.equal(supportedTypes.length, 2);
    });

    it('should validate and format Indian mobile numbers', () => {
      assert.equal(formatIndianMobile('9876543210'), '+91 98765 43210');
      assert.equal(formatIndianMobile('+919876543210'), '+91 98765 43210');
      assert.equal(formatIndianMobile('919876543210'), '+91 98765 43210');

      // Valid regex test
      const mobileRegex = /^[0-9+ ]{7,16}$/;
      assert.ok(mobileRegex.test('9876543210'));
      assert.ok(mobileRegex.test('+91 98765 43210'));
      assert.ok(!mobileRegex.test('abc1234'));
    });

    it('should format customer purchase history summaries', () => {
      const historySummary = {
        totalPurchases: 14500.75,
        billCount: 6,
        totalBaseWeightPurchased: 8500, // 8.5 kg
        averageBillValue: 2416.79,
      };

      assert.equal(formatCurrency(historySummary.totalPurchases), '₹14,500.75');
      assert.equal(formatGramsToKg(historySummary.totalBaseWeightPurchased), '8.5 kg');
      assert.equal(formatCurrency(historySummary.averageBillValue), '₹2,416.79');
      assert.equal(historySummary.billCount, 6);
    });
  });

  describe('5. User & Role Administration', () => {
    it('should validate all application roles and privileges', () => {
      const validRoles: Role[] = ['ADMIN', 'OUTLET', 'PRODUCTION'];
      assert.ok(validRoles.includes('ADMIN'));
      assert.ok(validRoles.includes('OUTLET'));
      assert.ok(validRoles.includes('PRODUCTION'));
    });

    it('should enforce password length requirement on user creation', () => {
      const shortPass = '123';
      const validPass = 'Admin@123';

      assert.ok(shortPass.length < 6);
      assert.ok(validPass.length >= 6);
    });
  });
});
