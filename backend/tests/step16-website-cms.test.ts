import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

async function runStep16Tests() {
  console.log('🚀 Running Step 16 — Business Website & Basic CMS Test Suite...');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}${env.API_PREFIX}`;

  try {
    // 1. Fetch Users for Role-based tokens
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const outletUser = await prisma.user.findFirst({ where: { role: 'OUTLET' } });

    assert.ok(adminUser, 'Admin user must exist in database');
    assert.ok(outletUser, 'Outlet user must exist in database');

    const adminToken = jwt.sign(
      { sub: adminUser.id, username: adminUser.username, role: adminUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    const outletToken = jwt.sign(
      { sub: outletUser.id, username: outletUser.username, role: outletUser.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // ========================================================
    // SECTION 1: PUBLIC READ-ONLY APIS (No Auth Required)
    // ========================================================
    console.log('▶ [1/15] Public Home endpoint returns 200 without authentication...');
    const homeRes = await fetch(`${baseUrl}/public/home`);
    assert.equal(homeRes.status, 200);
    const homeData = await homeRes.json();
    assert.ok(homeData.success);
    assert.ok(homeData.data.company);
    assert.equal(homeData.data.company.companyName, 'Vahanvati Gruh Udhyog');
    assert.ok(homeData.data.featuredProducts.length > 0);
    assert.ok(homeData.data.featuredVideos.length > 0);

    console.log('▶ [2/15] Public About endpoint returns 200 with authentic Padgol heritage...');
    const aboutRes = await fetch(`${baseUrl}/public/about`);
    assert.equal(aboutRes.status, 200);
    const aboutData = await aboutRes.json();
    assert.ok(aboutData.success);
    assert.ok(aboutData.data.company.address.includes('પાડગોલ'));

    console.log('▶ [3/15] Public Products endpoint returns 200 and sanitizes sensitive fields...');
    const prodRes = await fetch(`${baseUrl}/public/products`);
    assert.equal(prodRes.status, 200);
    const prodData = await prodRes.json();
    assert.ok(prodData.success);
    assert.ok(Array.isArray(prodData.data.products));
    assert.ok(prodData.data.products.length > 0);

    // Verify STRICT SANITIZATION on every returned product
    for (const p of prodData.data.products) {
      assert.equal((p as any).indianPrice, undefined, 'Public product must NOT expose indianPrice');
      assert.equal((p as any).nriPrice, undefined, 'Public product must NOT expose nriPrice');
      assert.equal((p as any).prices, undefined, 'Public product must NOT expose prices array');
      assert.equal((p as any).stock, undefined, 'Public product must NOT expose stock quantity');
      assert.equal((p as any).reorderLevel, undefined, 'Public product must NOT expose reorderLevel');
      assert.equal((p as any).costPrice, undefined, 'Public product must NOT expose costPrice');
    }

    console.log('▶ [4/15] Public Product Detail endpoint returns product and related items...');
    const sampleProduct = prodData.data.products[0];
    const detailRes = await fetch(`${baseUrl}/public/products/${sampleProduct.id}`);
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.ok(detailData.success);
    assert.equal(detailData.data.product.id, sampleProduct.id);
    assert.equal((detailData.data.product as any).prices, undefined);

    console.log('▶ [5/15] Public Gallery returns approved YouTube videos (FrB9KyMpOxQ & OhGPWtwlDVQ)...');
    const galleryRes = await fetch(`${baseUrl}/public/gallery`);
    assert.equal(galleryRes.status, 200);
    const galleryData = await galleryRes.json();
    assert.ok(galleryData.success);
    assert.ok(galleryData.data.items.length >= 2);

    const videoUrls = galleryData.data.items.filter((i: any) => i.mediaType === 'VIDEO').map((i: any) => i.mediaUrl);
    assert.ok(
      videoUrls.some((u: string) => u.includes('FrB9KyMpOxQ')),
      'Gallery must contain approved YouTube Video 1 (FrB9KyMpOxQ)'
    );
    assert.ok(
      videoUrls.some((u: string) => u.includes('OhGPWtwlDVQ')),
      'Gallery must contain approved YouTube Video 2 (OhGPWtwlDVQ)'
    );

    console.log('▶ [6/15] Public Contact endpoint returns authentic contact details & Instagram...');
    const contactRes = await fetch(`${baseUrl}/public/contact`);
    assert.equal(contactRes.status, 200);
    const contactData = await contactRes.json();
    assert.ok(contactData.success);
    assert.equal(contactData.data.instagramUrl, 'https://www.instagram.com/vahanvatigruhudhyog/');
    assert.ok(contactData.data.phone.includes('97149 17851'));
    assert.equal(contactData.data.fssaiLicense, '20720004000511');

    // ========================================================
    // SECTION 2: CMS RBAC & SECURITY TESTS
    // ========================================================
    console.log('▶ [7/15] CMS endpoints reject unauthenticated requests with 401...');
    const unauthCmsRes = await fetch(`${baseUrl}/cms/products`);
    assert.equal(unauthCmsRes.status, 401);

    console.log('▶ [8/15] CMS endpoints reject OUTLET cashier role with 403 Forbidden...');
    const forbiddenCmsRes = await fetch(`${baseUrl}/cms/products`, {
      headers: { Authorization: `Bearer ${outletToken}` },
    });
    assert.equal(forbiddenCmsRes.status, 403);

    console.log('▶ [9/15] CMS endpoints allow ADMIN role with 200 OK...');
    const adminCmsRes = await fetch(`${baseUrl}/cms/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminCmsRes.status, 200);
    const adminCmsData = await adminCmsRes.json();
    assert.ok(adminCmsData.success);
    assert.ok(Array.isArray(adminCmsData.data));

    // ========================================================
    // SECTION 3: CMS CONTENT & PRODUCT VISIBILITY MUTATIONS
    // ========================================================
    console.log('▶ [10/15] Admin can toggle Product website visibility (hide and restore)...');
    const targetProduct = adminCmsData.data[0];

    // Hide product
    const hideRes = await fetch(`${baseUrl}/cms/products/${targetProduct.id}/visibility`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isWebsiteVisible: false }),
    });
    assert.equal(hideRes.status, 200);

    // Verify hidden product disappears from public API
    const publicAfterHideRes = await fetch(`${baseUrl}/public/products`);
    const publicAfterHideData = await publicAfterHideRes.json();
    const isPresentWhenHidden = publicAfterHideData.data.products.some((p: any) => p.id === targetProduct.id);
    assert.equal(isPresentWhenHidden, false, 'Hidden product must NOT appear in public catalog');

    // Restore product visibility
    const restoreRes = await fetch(`${baseUrl}/cms/products/${targetProduct.id}/visibility`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isWebsiteVisible: true }),
    });
    assert.equal(restoreRes.status, 200);

    // Verify product reappears in public API
    const publicAfterRestoreRes = await fetch(`${baseUrl}/public/products`);
    const publicAfterRestoreData = await publicAfterRestoreRes.json();
    const isPresentWhenRestored = publicAfterRestoreData.data.products.some((p: any) => p.id === targetProduct.id);
    assert.equal(isPresentWhenRestored, true, 'Restored product must appear in public catalog');

    console.log('▶ [11/15] Admin can update website section content (Home/About)...');
    const updateHomeRes = await fetch(`${baseUrl}/cms/content/home`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          ...homeData.data.content,
          announcement: 'Fresh Festival Stock Available Now!',
        },
      }),
    });
    assert.equal(updateHomeRes.status, 200);

    // Verify update reflects on public endpoint
    const verifyHomeRes = await fetch(`${baseUrl}/public/home`);
    const verifyHomeData = await verifyHomeRes.json();
    assert.equal(verifyHomeData.data.content.announcement, 'Fresh Festival Stock Available Now!');

    console.log('▶ [12/15] Admin can create, update, and delete Gallery items...');
    // Create new gallery item
    const createGalleryRes = await fetch(`${baseUrl}/cms/gallery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Freshly Handwoven Sarewada',
        caption: 'Artisanal sun drying test item',
        mediaType: 'IMAGE',
        mediaUrl: '/test-image.png',
        displayOrder: 99,
        isVisible: true,
      }),
    });
    assert.equal(createGalleryRes.status, 201);
    const createdItem = (await createGalleryRes.json()).data;

    // Update gallery item
    const updateGalleryRes = await fetch(`${baseUrl}/cms/gallery/${createdItem.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated Handwoven Sarewada' }),
    });
    assert.equal(updateGalleryRes.status, 200);

    // Delete gallery item
    const deleteGalleryRes = await fetch(`${baseUrl}/cms/gallery/${createdItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteGalleryRes.status, 200);

    console.log('▶ [13/15] Admin can update store contact and social media settings...');
    const updateContactRes = await fetch(`${baseUrl}/cms/contact`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessHours: 'Monday - Sunday: 8:00 AM - 9:00 PM',
      }),
    });
    assert.equal(updateContactRes.status, 200);

    // Verify public contact endpoint reflects updated hours
    const updatedContactRes = await fetch(`${baseUrl}/public/contact`);
    const updatedContactData = await updatedContactRes.json();
    assert.equal(updatedContactData.data.businessHours, 'Monday - Sunday: 8:00 AM - 9:00 PM');

    // ========================================================
    // SECTION 4: REGRESSION SAFETY
    // ========================================================
    console.log('▶ [14/15] Regression Safety: POS Catalog endpoint still works and preserves pricing...');
    const catalogRes = await fetch(`${baseUrl}/catalog/products?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(catalogRes.status, 200);
    const catalogData = await catalogRes.json();
    console.log('catalogData.data keys:', Object.keys(catalogData.data));
    const items = catalogData.data?.items || catalogData.data?.products || catalogData.data;
    assert.ok(items.length > 0, 'Catalog items must exist');
    assert.ok(items[0].prices.length > 0, 'Internal catalog must preserve dual pricing');

    console.log('▶ [15/15] Regression Safety: Reporting business-summary endpoint still works...');
    const reportRes = await fetch(`${baseUrl}/reports/business-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(reportRes.status, 200);

    console.log('✅ ALL 15/15 Step 16 Backend Tests PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runStep16Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Step 16 Backend Tests Failed:', err);
    process.exit(1);
  });
