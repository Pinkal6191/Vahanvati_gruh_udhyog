import assert from 'node:assert/strict';
import { describe, it, before, beforeEach } from 'node:test';

// Constants & Utilities
import { ROLES, ALL_ROLES } from '../src/constants/roles';
import { NAVIGATION_GROUPS } from '../src/constants/navigation';
import { hasRole, canAccessRoute, filterNavigationByRole } from '../src/utils/rbac';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatGramsToKg,
  formatDeltaWeight,
  formatIndianMobile,
  formatInvoiceNumber,
} from '../src/utils/formatters';
import { cn } from '../src/utils/cn';
import { storageService } from '../src/services/storage/storage.service';
import { apiClient } from '../src/services/api/api-client';
import { User, Role } from '../src/types/auth.types';

// Mock localStorage for Node.js environment
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// Install global mock localStorage if not in browser
if (typeof window === 'undefined') {
  (global as any).window = global;
  (global as any).localStorage = createMockLocalStorage();
}

describe('Step 10 — Frontend Architecture & Foundation Test Suite', () => {
  const adminUser: User = {
    id: 'user-admin-1',
    username: 'admin',
    fullName: 'System Administrator',
    role: 'ADMIN',
    isActive: true,
  };

  const outletUser: User = {
    id: 'user-outlet-1',
    username: 'outlet_cashier',
    fullName: 'Outlet Cashier',
    role: 'OUTLET',
    isActive: true,
  };

  const productionUser: User = {
    id: 'user-prod-1',
    username: 'kitchen_lead',
    fullName: 'Production Lead',
    role: 'PRODUCTION',
    isActive: true,
  };

  beforeEach(() => {
    storageService.clearAuthSession();
  });

  describe('1. Role & Permission Definitions', () => {
    it('should define all supported roles accurately', () => {
      assert.deepEqual(ALL_ROLES, ['ADMIN', 'OUTLET', 'PRODUCTION']);
      assert.equal(ROLES.ADMIN, 'ADMIN');
      assert.equal(ROLES.OUTLET, 'OUTLET');
      assert.equal(ROLES.PRODUCTION, 'PRODUCTION');
    });

    it('should verify hasRole correctly for single and multi-role checks', () => {
      assert.equal(hasRole(adminUser, 'ADMIN'), true);
      assert.equal(hasRole(adminUser, ['ADMIN', 'OUTLET']), true);
      assert.equal(hasRole(adminUser, ['OUTLET', 'PRODUCTION']), false);

      assert.equal(hasRole(outletUser, 'OUTLET'), true);
      assert.equal(hasRole(outletUser, ['ADMIN', 'OUTLET']), true);
      assert.equal(hasRole(outletUser, 'ADMIN'), false);

      assert.equal(hasRole(productionUser, 'PRODUCTION'), true);
      assert.equal(hasRole(productionUser, ['ADMIN', 'PRODUCTION']), true);
      assert.equal(hasRole(productionUser, 'OUTLET'), false);

      assert.equal(hasRole(null, 'ADMIN'), false);
      assert.equal(hasRole(undefined, 'ADMIN'), false);
    });

    it('should accurately validate route accessibility per user role', () => {
      // Dashboard accessible to all authenticated
      assert.equal(canAccessRoute('/dashboard', adminUser), true);
      assert.equal(canAccessRoute('/dashboard', outletUser), true);
      assert.equal(canAccessRoute('/dashboard', productionUser), true);
      assert.equal(canAccessRoute('/dashboard', null), false);

      // Billing & Returns: ADMIN + OUTLET only
      assert.equal(canAccessRoute('/billing', adminUser), true);
      assert.equal(canAccessRoute('/billing', outletUser), true);
      assert.equal(canAccessRoute('/billing', productionUser), false);

      assert.equal(canAccessRoute('/sales-returns', adminUser), true);
      assert.equal(canAccessRoute('/sales-returns', outletUser), true);
      assert.equal(canAccessRoute('/sales-returns', productionUser), false);

      // Production: ADMIN + PRODUCTION only
      assert.equal(canAccessRoute('/production', adminUser), true);
      assert.equal(canAccessRoute('/production', productionUser), true);
      assert.equal(canAccessRoute('/production', outletUser), false);

      // Inventory: All authenticated roles
      assert.equal(canAccessRoute('/inventory', adminUser), true);
      assert.equal(canAccessRoute('/inventory', outletUser), true);
      assert.equal(canAccessRoute('/inventory', productionUser), true);

      // Admin only routes: Products, Categories, Reports, Users, Website, Settings
      const adminOnlyPaths = [
        '/products',
        '/categories',
        '/subcategories',
        '/reports',
        '/users',
        '/website',
        '/settings',
      ];

      for (const path of adminOnlyPaths) {
        assert.equal(canAccessRoute(path, adminUser), true, `Admin should access ${path}`);
        assert.equal(canAccessRoute(path, outletUser), false, `Outlet should NOT access ${path}`);
        assert.equal(canAccessRoute(path, productionUser), false, `Prod should NOT access ${path}`);
      }
    });

    it('should filter navigation groups strictly based on role', () => {
      const adminNav = filterNavigationByRole(NAVIGATION_GROUPS, adminUser);
      const outletNav = filterNavigationByRole(NAVIGATION_GROUPS, outletUser);
      const prodNav = filterNavigationByRole(NAVIGATION_GROUPS, productionUser);

      // Flatten items for easy assertion
      const adminPaths = adminNav.flatMap((g) => g.items.map((i) => i.path));
      const outletPaths = outletNav.flatMap((g) => g.items.map((i) => i.path));
      const prodPaths = prodNav.flatMap((g) => g.items.map((i) => i.path));

      // Admin has all navigation items
      assert.ok(adminPaths.includes('/dashboard'));
      assert.ok(adminPaths.includes('/billing'));
      assert.ok(adminPaths.includes('/production'));
      assert.ok(adminPaths.includes('/products'));
      assert.ok(adminPaths.includes('/reports'));
      assert.ok(adminPaths.includes('/users'));
      assert.ok(adminPaths.includes('/settings'));

      // Outlet cashier should NOT see production or admin settings
      assert.ok(outletPaths.includes('/billing'));
      assert.ok(outletPaths.includes('/sales-returns'));
      assert.ok(outletPaths.includes('/customers'));
      assert.ok(!outletPaths.includes('/production'));
      assert.ok(!outletPaths.includes('/reports'));
      assert.ok(!outletPaths.includes('/users'));

      // Production lead should NOT see billing or customer details
      assert.ok(prodPaths.includes('/production'));
      assert.ok(prodPaths.includes('/inventory'));
      assert.ok(!prodPaths.includes('/billing'));
      assert.ok(!prodPaths.includes('/sales-returns'));
      assert.ok(!prodPaths.includes('/customers'));
      assert.ok(!prodPaths.includes('/users'));
    });
  });

  describe('2. Formatting Utilities', () => {
    it('should format currency in Indian Rupees format', () => {
      assert.equal(formatCurrency(0), '₹0.00');
      assert.equal(formatCurrency('150.5'), '₹150.50');
      assert.equal(formatCurrency(12500.75), '₹12,500.75');
      assert.equal(formatCurrency(100000), '₹1,00,000.00');
    });

    it('should format grams to kg or grams representation', () => {
      assert.equal(formatGramsToKg(250), '250 g');
      assert.equal(formatGramsToKg(500), '500 g');
      assert.equal(formatGramsToKg(1000), '1 kg');
      assert.equal(formatGramsToKg(1500), '1.5 kg');
      assert.equal(formatGramsToKg(2000), '2 kg');
    });

    it('should format delta weights with sign and unit', () => {
      assert.equal(formatDeltaWeight(-1000), '-1 kg');
      assert.equal(formatDeltaWeight(-2000), '-2 kg');
      assert.equal(formatDeltaWeight(-500), '-500 g');
      assert.equal(formatDeltaWeight(1000), '+1 kg');
      assert.equal(formatDeltaWeight(50000), '+50 kg');
      assert.equal(formatDeltaWeight(100000), '+100 kg');
      assert.equal(formatDeltaWeight(0), '0 g');
    });

    it('should format Indian mobile numbers with spacing', () => {
      assert.equal(formatIndianMobile('9876543210'), '+91 98765 43210');
      assert.equal(formatIndianMobile('+919876543210'), '+91 98765 43210');
      assert.equal(formatIndianMobile('invalid'), 'invalid');
    });

    it('should format invoice numbers with leading zeros and year', () => {
      assert.equal(formatInvoiceNumber(1, 2026), 'INV-2026-00001');
      assert.equal(formatInvoiceNumber(42, 2026), 'INV-2026-00042');
      assert.equal(formatInvoiceNumber(10543, 2026), 'INV-2026-10543');
    });

    it('should handle date formatting safely', () => {
      const dateStr = '2026-09-08T10:30:00Z';
      const formattedDate = formatDate(dateStr);
      assert.ok(formattedDate.includes('2026') || formattedDate.includes('09') || formattedDate.includes('Sep'));
      assert.equal(formatDate(null), '-');
    });
  });

  describe('3. ClassName Utility (cn)', () => {
    it('should merge classes and ignore falsy values', () => {
      assert.equal(cn('btn', 'btn-primary'), 'btn btn-primary');
      assert.equal(cn('btn', false && 'btn-active', null, undefined, 'btn-lg'), 'btn btn-lg');
      assert.equal(cn('', 'first', 0 as any, 'second'), 'first second');
    });
  });

  describe('4. Storage Service', () => {
    it('should store, retrieve, and clear JWT tokens safely', () => {
      assert.equal(storageService.getAccessToken(), null);
      storageService.setAccessToken('mock-access-jwt-token');
      assert.equal(storageService.getAccessToken(), 'mock-access-jwt-token');

      storageService.setRefreshToken('mock-refresh-jwt-token');
      assert.equal(storageService.getRefreshToken(), 'mock-refresh-jwt-token');

      storageService.clearAuthSession();
      assert.equal(storageService.getAccessToken(), null);
      assert.equal(storageService.getRefreshToken(), null);
    });

    it('should store, retrieve, and clear User state with JSON serialization', () => {
      assert.equal(storageService.getUser(), null);
      storageService.setUser(adminUser);

      const retrieved = storageService.getUser();
      assert.deepEqual(retrieved, adminUser);

      storageService.clearAuthSession();
      assert.equal(storageService.getUser(), null);
    });
  });

  describe('5. API Client Architecture', () => {
    it('should manage auth token header injection', () => {
      storageService.setAccessToken('jwt-test-token-123');
      const headers = apiClient.getHeaders();
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers['Authorization'], 'Bearer jwt-test-token-123');
    });

    it('should omit Authorization header when no token is present', () => {
      storageService.clearAuthSession();
      const headers = apiClient.getHeaders();
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers['Authorization'], undefined);
    });

    it('should allow setting custom headers', () => {
      const headers = apiClient.getHeaders({ 'X-Custom-Header': 'CustomValue' });
      assert.equal(headers['X-Custom-Header'], 'CustomValue');
    });

    it('should register and trigger unauthorized callback on 401', () => {
      let triggered = false;
      apiClient.setOnUnauthorized(() => {
        triggered = true;
      });

      apiClient.triggerUnauthorized();
      assert.equal(triggered, true);
    });
  });
});
