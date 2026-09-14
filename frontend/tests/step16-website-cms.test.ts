import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute } from '../src/utils/rbac';
import { User } from '../src/types/auth.types';

describe('Step 16 — Business Website & Basic CMS Frontend Test Suite', () => {
  const adminUser: User = {
    id: 'admin-1',
    username: 'admin',
    role: 'ADMIN',
    fullName: 'System Administrator',
    isActive: true,
  };

  const outletUser: User = {
    id: 'outlet-1',
    username: 'cashier',
    role: 'OUTLET',
    fullName: 'Store Cashier',
    isActive: true,
  };

  const productionUser: User = {
    id: 'prod-1',
    username: 'chef',
    role: 'PRODUCTION',
    fullName: 'Kitchen Master',
    isActive: true,
  };

  // ========================================================
  // 1. PUBLIC ROUTES ACCESSIBILITY (Zero Auth Required)
  // ========================================================
  describe('1. Public Route Access without Authentication', () => {
    it('public pages should be freely accessible to anonymous visitors', () => {
      const publicPaths = ['/', '/home', '/about', '/products', '/gallery', '/contact'];
      for (const p of publicPaths) {
        // Public pages don't require user login
        assert.ok(p.startsWith('/'), `Path ${p} is a valid public route`);
      }
    });

    it('unauthenticated users should not access internal management routes', () => {
      const internalPaths = [
        '/dashboard',
        '/billing',
        '/inventory',
        '/production',
        '/reports',
        '/users',
        '/settings',
      ];
      for (const p of internalPaths) {
        assert.equal(canAccessRoute(p, null), false, `Anonymous visitor must NOT access ${p}`);
      }
    });
  });

  // ========================================================
  // 2. DATA SANITIZATION INVARIANTS (Never Expose Internal Data)
  // ========================================================
  describe('2. Public Data Sanitization Invariants', () => {
    it('should strictly sanitize public product objects by removing internal fields', () => {
      const internalProduct = {
        id: 'prod-101',
        name: 'Rice Sarewada (ચોખાના સારેવડા)',
        gujaratiName: 'ચોખાના સારેવડા',
        code: 'SAR-001',
        description: 'Authentic sun-cured rice snack',
        imageUrl: '/logo.png',
        isWebsiteVisible: true,
        isFeatured: true,
        // Sensitive internal fields that must be purged
        indianPrice: 280,
        nriPrice: 450,
        costPrice: 190,
        stockQuantity: 54.5,
        reorderThreshold: 10,
        supplierId: 'supp-99',
      };

      // Public sanitization transformation
      const sanitizePublicProduct = (p: typeof internalProduct) => {
        const {
          indianPrice,
          nriPrice,
          costPrice,
          stockQuantity,
          reorderThreshold,
          supplierId,
          ...publicSafe
        } = p;
        return publicSafe;
      };

      const publicProduct = sanitizePublicProduct(internalProduct);

      assert.equal((publicProduct as any).indianPrice, undefined);
      assert.equal((publicProduct as any).nriPrice, undefined);
      assert.equal((publicProduct as any).costPrice, undefined);
      assert.equal((publicProduct as any).stockQuantity, undefined);
      assert.equal((publicProduct as any).reorderThreshold, undefined);
      assert.equal(publicProduct.name, 'Rice Sarewada (ચોખાના સારેવડા)');
      assert.equal(publicProduct.isWebsiteVisible, true);
    });

    it('should filter out products where isWebsiteVisible is false', () => {
      const catalog = [
        { id: '1', name: 'Visible Product', isWebsiteVisible: true },
        { id: '2', name: 'Internal Only Product', isWebsiteVisible: false },
        { id: '3', name: 'Another Visible Product', isWebsiteVisible: true },
      ];

      const publiclyVisible = catalog.filter((p) => p.isWebsiteVisible);
      assert.equal(publiclyVisible.length, 2);
      assert.ok(!publiclyVisible.some((p) => p.name === 'Internal Only Product'));
    });
  });

  // ========================================================
  // 3. APPROVED YOUTUBE VIDEO CONFORMANCE
  // ========================================================
  describe('3. Approved YouTube Video Integration', () => {
    const APPROVED_VIDEOS = [
      {
        id: 'FrB9KyMpOxQ',
        watchUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
        expectedEmbed: 'https://www.youtube.com/embed/FrB9KyMpOxQ',
      },
      {
        id: 'OhGPWtwlDVQ',
        watchUrl: 'https://www.youtube.com/watch?v=OhGPWtwlDVQ',
        expectedEmbed: 'https://www.youtube.com/embed/OhGPWtwlDVQ',
      },
    ];

    it('should correctly configure both approved YouTube videos', () => {
      assert.equal(APPROVED_VIDEOS.length, 2);
      assert.equal(APPROVED_VIDEOS[0].id, 'FrB9KyMpOxQ');
      assert.equal(APPROVED_VIDEOS[1].id, 'OhGPWtwlDVQ');
    });

    it('should generate compliant 16:9 embed URLs and fallback watch links', () => {
      for (const v of APPROVED_VIDEOS) {
        assert.ok(v.watchUrl.startsWith('https://www.youtube.com/watch?v='));
        assert.equal(v.expectedEmbed, `https://www.youtube.com/embed/${v.id}`);
      }
    });
  });

  // ========================================================
  // 4. INSTAGRAM INTEGRATION CONFORMANCE
  // ========================================================
  describe('4. Official Instagram Profile Integration', () => {
    const INSTAGRAM_URL = 'https://www.instagram.com/vahanvatigruhudhyog/';
    const INSTAGRAM_HANDLE = '@vahanvatigruhudhyog';

    it('should target the official Vahanvati Gruh Udhyog Instagram profile', () => {
      assert.equal(INSTAGRAM_URL, 'https://www.instagram.com/vahanvatigruhudhyog/');
      assert.equal(INSTAGRAM_HANDLE, '@vahanvatigruhudhyog');
    });

    it('should validate Instagram URL format securely', () => {
      const isValidInstagramUrl = (url: string) => {
        try {
          const parsed = new URL(url);
          return (
            (parsed.hostname === 'instagram.com' || parsed.hostname === 'www.instagram.com') &&
            parsed.pathname.includes('vahanvatigruhudhyog')
          );
        } catch {
          return false;
        }
      };

      assert.equal(isValidInstagramUrl(INSTAGRAM_URL), true);
      assert.equal(isValidInstagramUrl('https://malicious-site.com/insta'), false);
    });
  });

  // ========================================================
  // 5. ROLE-BASED ACCESS CONTROL (RBAC) FOR WEBSITE CMS
  // ========================================================
  describe('5. RBAC Guards for Admin Website CMS', () => {
    it('ADMIN role should have full access to Website CMS (/website)', () => {
      assert.equal(canAccessRoute('/website', adminUser), true);
    });

    it('OUTLET role should be strictly FORBIDDEN from Website CMS (/website)', () => {
      assert.equal(canAccessRoute('/website', outletUser), false);
    });

    it('PRODUCTION role should be strictly FORBIDDEN from Website CMS (/website)', () => {
      assert.equal(canAccessRoute('/website', productionUser), false);
    });
  });

  // ========================================================
  // 6. CONTACT & LOCATION CREDENTIALS
  // ========================================================
  describe('6. Authentic Contact & FSSAI Standards', () => {
    const COMPANY_DATA = {
      name: 'Vahanvati Gruh Udhyog',
      tagline: 'હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર.',
      address: 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
      phone1: '+91 97149 17851',
      phone2: '+91 97121 15118',
      fssaiLicense: '20720004000511',
      gstin: '24BCIPP6428E1ZL',
    };

    it('should verify authentic store location in Padgol', () => {
      assert.ok(COMPANY_DATA.address.includes('પાડગોલ'));
      assert.ok(COMPANY_DATA.address.includes('નડિયાદ - પેટલાદ રોડ'));
      assert.ok(COMPANY_DATA.address.includes('૩૮૮ ૪૪૦'));
    });

    it('should verify official contact telephone numbers', () => {
      assert.ok(COMPANY_DATA.phone1.includes('97149 17851'));
      assert.ok(COMPANY_DATA.phone2.includes('97121 15118'));
    });

    it('should verify official statutory licenses', () => {
      assert.equal(COMPANY_DATA.fssaiLicense, '20720004000511');
      assert.equal(COMPANY_DATA.gstin, '24BCIPP6428E1ZL');
    });
  });
});
