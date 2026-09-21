import { prisma } from '../config/database.js';

export async function seedWebsiteContent() {
  console.log('🌱 Seeding Vahanvati Gruh Udhyog Website & CMS content...');

  // 1. Update Company Settings with authentic Padgol contact and social links
  const settings = await prisma.companySettings.findFirst();
  if (settings) {
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        companyName: 'Vahanvati Gruh Udhyog',
        tagline: 'હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર.',
        address: 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
        phone: '+91 97149 17851 / +91 97121 15118',
        email: 'info@vahanvati.com',
        businessHours: 'Monday - Sunday: 8:00 AM - 8:30 PM',
        googleMapsUrl:
          'https://www.google.com/maps/place/Vahanvati+Gruh+Udhyog+-+Handmade+Papad+in+Padgol/@22.5913772,72.8318268,17z',
        instagramUrl: 'https://www.instagram.com/vahanvatigruhudhyog/',
        youtubeUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
      },
    });
    console.log('✅ CompanySettings updated with authentic address and approved social media links.');
  }

  // 2. Seed Home Section Content
  const homeContent = {
    hero: {
      headlineEn: 'Authentic Traditional Handcrafted Gujarati Taste',
      headlineGu: 'શુદ્ધ અને પૌષ્ટિક હાથ વણાટના સ્વાદિષ્ટ સારેવડા અને સેવો',
      subheadlineEn:
        'Prepared with time-honored artisanal recipes in Padgol, Gujarat. Premium Sarewada, Sevo, and Vadi crafted with pure ingredients and sun-dried perfection.',
      subheadlineGu:
        'પરંપરાગત રીતે તૈયાર કરાયેલા ઉત્તમ ગુણવત્તાવાળા સારેવડા, પાપડ, સેવો અને વડી. સ્વચ્છતા અને સ્વાદનો અજોડ સંગમ.',
      ctaPrimaryText: 'View Our Products',
      ctaPrimaryLink: '/products',
      ctaSecondaryText: 'Contact Us',
      ctaSecondaryLink: '/contact',
      badgeText: 'FSSAI Certified: 20720004000511',
    },
    highlights: [
      {
        id: '1',
        title: 'Handcrafted Tradition (હાથ વણાટ)',
        description: 'Authentic time-tested recipes handwoven by skilled village artisans.',
        icon: 'Sparkles',
      },
      {
        id: '2',
        title: 'Hygienic Kitchen & Pure Ingredients',
        description: 'No harmful chemicals or artificial preservatives. Highest hygiene standards.',
        icon: 'ShieldCheck',
      },
      {
        id: '3',
        title: 'Traditional Sun-Drying',
        description: 'Naturally sun-cured for crisp texture, deep flavor, and extended shelf life.',
        icon: 'Sun',
      },
      {
        id: '4',
        title: '50+ Artisan Varieties',
        description: 'Extensive variety of Rice, Sabudana, Poha, Rava Sarewada, Sevo, and Vadi.',
        icon: 'CheckCircle2',
      },
    ],
    craftsmanship: {
      title: 'Our Artisanal Heritage & Craftsmanship',
      titleGu: 'અમારી પરંપરા અને હાથ કારીગરી',
      description:
        'At Vahanvati Gruh Udhyog in Padgol, every batch is prepared with pride and devotion. From slow-steaming the dough to delicate hand-weaving and gentle sun-drying, we preserve the authentic flavors of Gujarat.',
    },
    social: {
      instagramHandle: '@vahanvatigruhudhyog',
      instagramUrl: 'https://www.instagram.com/vahanvatigruhudhyog/',
      youtubeTitle: 'Watch Our Artisanal Craftsmanship on YouTube',
    },
  };

  await prisma.websiteContent.upsert({
    where: { section: 'home' },
    update: { content: homeContent },
    create: { section: 'home', content: homeContent },
  });
  console.log('✅ Home section content seeded.');

  // 3. Seed About Section Content
  const aboutContent = {
    story: {
      title: 'The Story of Vahanvati Gruh Udhyog',
      titleGu: 'વહાણવટી ગૃહ ઉદ્યોગ — સ્વાદ અને પરંપરાની સફર',
      paragraphs: [
        'Rooted in the heart of Padgol along the Nadiad-Petlad Road in Anand, Gujarat, Vahanvati Gruh Udhyog was established with a singular vision: to bring the authentic, nostalgic taste of homemade Gujarati Sarewada, Sevo, and Vadi to every household.',
        'Our specialty lies in our signature "હાથ વણાટ" (hand-weaving) technique. Unlike industrial mass-produced snacks, our products are crafted by skilled local women and artisans who have inherited these culinary arts across generations.',
        'We combine natural ingredients, pure drinking water, natural spices, and the abundant Gujarat sunshine for traditional curing. Certified under FSSAI license 20720004000511, our production kitchen adheres strictly to cleanliness, purity, and uncompromising food safety standards.',
      ],
    },
    values: [
      {
        title: 'Purity & Honesty',
        description: 'Using only the finest grains, pulses, and traditional spices with zero adulteration.',
      },
      {
        title: 'Artisanal Preservation',
        description: 'Keeping alive the authentic hand-spun Sarewada techniques unique to Charotar.',
      },
      {
        title: 'Customer Trust',
        description: 'Serving thousands of local families, NRI patrons, and festive celebrations with consistent delight.',
      },
    ],
    qualityStandards: {
      fssaiNumber: '20720004000511',
      gstin: '24BCIPP6428E1ZL',
      location: 'Padgol, Nadiad - Petlad Road, Dist. Anand - 388440, Gujarat',
    },
  };

  await prisma.websiteContent.upsert({
    where: { section: 'about' },
    update: { content: aboutContent },
    create: { section: 'about', content: aboutContent },
  });
  console.log('✅ About section content seeded.');

  // 4. Seed Gallery with Approved YouTube Videos and Initial Photo Entries
  const existingGalleryCount = await prisma.galleryItem.count();
  if (existingGalleryCount === 0) {
    await prisma.galleryItem.createMany({
      data: [
        {
          title: 'Vahanvati Gruh Udhyog Artisanal Video 1',
          caption: 'Watch traditional handmade Sarewada and Sevo production in our Padgol kitchen.',
          mediaType: 'VIDEO',
          mediaUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
          thumbnailUrl: 'https://img.youtube.com/vi/FrB9KyMpOxQ/hqdefault.jpg',
          displayOrder: 1,
          isVisible: true,
        },
        {
          title: 'Vahanvati Gruh Udhyog Artisanal Video 2',
          caption: 'Special handwoven Sarewada showcase and kitchen walkthrough.',
          mediaType: 'VIDEO',
          mediaUrl: 'https://www.youtube.com/watch?v=OhGPWtwlDVQ',
          thumbnailUrl: 'https://img.youtube.com/vi/OhGPWtwlDVQ/hqdefault.jpg',
          displayOrder: 2,
          isVisible: true,
        },
        {
          title: 'Handcrafted Sarewada (હાથ વણાટના સારેવડા)',
          caption: 'Traditional handwoven rice and sabudana sarewada sun-drying under clean skies.',
          mediaType: 'IMAGE',
          mediaUrl: '/logo.png',
          thumbnailUrl: '/logo.png',
          displayOrder: 3,
          isVisible: true,
        },
      ],
    });
    console.log('✅ Approved YouTube videos & initial gallery items seeded.');
  }

  // 5. Mark Top Products as Featured on Home
  const topProducts = await prisma.product.findMany({
    take: 8,
    orderBy: { name: 'asc' },
  });
  for (const product of topProducts) {
    await prisma.product.update({
      where: { id: product.id },
      data: { isFeatured: true, isWebsiteVisible: true },
    });
  }
  console.log(`✅ ${topProducts.length} products marked as featured for the website.`);

  console.log('🎉 Website and CMS content successfully seeded!');
}

// Direct execution
if (process.argv[1]?.endsWith('seed-website-content.ts')) {
  seedWebsiteContent()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
