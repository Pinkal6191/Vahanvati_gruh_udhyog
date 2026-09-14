import { prisma } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';

export class WebsiteService {
  // ========================================================
  // PUBLIC READ-ONLY APIS (Sanitized - No Price, No Stock)
  // ========================================================

  /**
   * Get public home page data
   */
  static async getPublicHome() {
    const homeRecord = await prisma.websiteContent.findUnique({
      where: { section: 'home' },
    });

    const settings = await prisma.companySettings.findFirst();

    // Fetch featured products (Strictly sanitized)
    const featuredProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        isWebsiteVisible: true,
        isFeatured: true,
      },
      take: 8,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        gujaratiName: true,
        code: true,
        description: true,
        imageUrl: true,
        isFeatured: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        primaryUnit: {
          select: {
            id: true,
            name: true,
            symbol: true,
          },
        },
        packConfigurations: {
          where: { isActive: true },
          select: {
            id: true,
            packName: true,
            weightInBaseUnits: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // Fetch featured videos (Approved YouTube videos)
    const featuredVideos = await prisma.galleryItem.findMany({
      where: {
        isVisible: true,
        mediaType: 'VIDEO',
      },
      take: 2,
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        title: true,
        caption: true,
        mediaType: true,
        mediaUrl: true,
        thumbnailUrl: true,
      },
    });

    // Categories summary for quick exploration
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return {
      content: homeRecord?.content || {},
      company: {
        companyName: settings?.companyName || 'Vahanvati Gruh Udhyog',
        tagline: settings?.tagline || '',
        address: settings?.address || '',
        phone: settings?.phone || '',
        email: settings?.email || 'info@vahanvati.com',
        businessHours: settings?.businessHours || 'Monday - Sunday: 8:00 AM - 8:30 PM',
        instagramUrl: settings?.instagramUrl || 'https://www.instagram.com/vahanvatigruhudhyog/',
        youtubeUrl: settings?.youtubeUrl || 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
        fssaiLicense: settings?.fssaiLicense || '20720004000511',
        gstin: settings?.gstin || '24BCIPP6428E1ZL',
      },
      featuredProducts,
      featuredVideos,
      categories,
    };
  }

  /**
   * Get public about page data
   */
  static async getPublicAbout() {
    const aboutRecord = await prisma.websiteContent.findUnique({
      where: { section: 'about' },
    });

    const settings = await prisma.companySettings.findFirst();

    return {
      content: aboutRecord?.content || {},
      company: {
        companyName: settings?.companyName || 'Vahanvati Gruh Udhyog',
        tagline: settings?.tagline || '',
        address: settings?.address || '',
        phone: settings?.phone || '',
        email: settings?.email || 'info@vahanvati.com',
        fssaiLicense: settings?.fssaiLicense || '20720004000511',
        gstin: settings?.gstin || '24BCIPP6428E1ZL',
      },
    };
  }

  /**
   * Get public products catalog (Strictly sanitized, only visible products)
   */
  static async getPublicProducts(query: {
    search?: string;
    categoryId?: string;
    subcategoryId?: string;
  }) {
    const where: any = {
      isActive: true,
      isWebsiteVisible: true,
    };

    if (query.subcategoryId) {
      where.subcategoryId = query.subcategoryId;
    } else if (query.categoryId) {
      where.subcategory = {
        categoryId: query.categoryId,
      };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { gujaratiName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        gujaratiName: true,
        code: true,
        description: true,
        imageUrl: true,
        isFeatured: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        primaryUnit: {
          select: {
            id: true,
            name: true,
            symbol: true,
          },
        },
        packConfigurations: {
          where: { isActive: true },
          select: {
            id: true,
            packName: true,
            weightInBaseUnits: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        subcategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return {
      products,
      categories,
      totalCount: products.length,
    };
  }

  /**
   * Get public product detail by ID (Sanitized)
   */
  static async getPublicProductDetail(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        isWebsiteVisible: true,
      },
      select: {
        id: true,
        name: true,
        gujaratiName: true,
        code: true,
        description: true,
        imageUrl: true,
        isFeatured: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        primaryUnit: {
          select: {
            id: true,
            name: true,
            symbol: true,
          },
        },
        packConfigurations: {
          where: { isActive: true },
          select: {
            id: true,
            packName: true,
            weightInBaseUnits: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found or not available publicly');
    }

    // Related products in same category
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: id },
        isActive: true,
        isWebsiteVisible: true,
        subcategory: {
          categoryId: product.subcategory.categoryId,
        },
      },
      take: 4,
      select: {
        id: true,
        name: true,
        gujaratiName: true,
        imageUrl: true,
        primaryUnit: {
          select: { symbol: true },
        },
      },
    });

    return { product, relatedProducts };
  }

  /**
   * Get public gallery items (Photos and approved YouTube videos)
   */
  static async getPublicGallery(type?: string) {
    const where: any = { isVisible: true };
    if (type && ['IMAGE', 'VIDEO'].includes(type.toUpperCase())) {
      where.mediaType = type.toUpperCase();
    }

    const items = await prisma.galleryItem.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        caption: true,
        mediaType: true,
        mediaUrl: true,
        thumbnailUrl: true,
        displayOrder: true,
      },
    });

    return { items, totalCount: items.length };
  }

  /**
   * Get public contact information (Padgol, Phones, Google Maps, Socials)
   */
  static async getPublicContact() {
    const settings = await prisma.companySettings.findFirst();

    return {
      companyName: settings?.companyName || 'Vahanvati Gruh Udhyog',
      tagline: settings?.tagline || 'હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર.',
      address: settings?.address || 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
      phone: settings?.phone || '+91 97149 17851 / +91 97121 15118',
      email: settings?.email || 'info@vahanvati.com',
      businessHours: settings?.businessHours || 'Monday - Sunday: 8:00 AM - 8:30 PM',
      googleMapsUrl: settings?.googleMapsUrl || 'https://maps.google.com/?q=Padgol+Gujarat',
      instagramUrl: settings?.instagramUrl || 'https://www.instagram.com/vahanvatigruhudhyog/',
      youtubeUrl: settings?.youtubeUrl || 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
      gstin: settings?.gstin || '24BCIPP6428E1ZL',
      fssaiLicense: settings?.fssaiLicense || '20720004000511',
    };
  }

  // ========================================================
  // CMS ADMIN APIS (Mutations guarded by ADMIN role)
  // ========================================================

  /**
   * Update website section content (home, about, etc.)
   */
  static async updateWebsiteContent(section: string, content: any, userId?: string) {
    if (!['home', 'about', 'contact'].includes(section)) {
      throw new BadRequestError(`Invalid website content section: ${section}`);
    }

    return prisma.websiteContent.upsert({
      where: { section },
      update: { content, updatedBy: userId },
      create: { section, content, updatedBy: userId },
    });
  }

  /**
   * Get website section content for CMS editor
   */
  static async getWebsiteContent(section: string) {
    const record = await prisma.websiteContent.findUnique({
      where: { section },
    });
    return record?.content || {};
  }

  /**
   * Get products list for CMS with visibility & featured toggles
   */
  static async getCmsProducts(query: { search?: string; categoryId?: string; isWebsiteVisible?: boolean }) {
    const where: any = { isActive: true };

    if (query.categoryId) {
      where.subcategory = { categoryId: query.categoryId };
    }
    if (typeof query.isWebsiteVisible === 'boolean') {
      where.isWebsiteVisible = query.isWebsiteVisible;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { gujaratiName: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.product.findMany({
      where,
      orderBy: [{ isWebsiteVisible: 'desc' }, { isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        gujaratiName: true,
        code: true,
        description: true,
        imageUrl: true,
        isWebsiteVisible: true,
        isFeatured: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
        primaryUnit: { select: { symbol: true } },
      },
    });
  }

  /**
   * Update product website visibility and featured status (Safe - No price/stock modification)
   */
  static async updateProductWebsiteStatus(
    id: string,
    data: { isWebsiteVisible?: boolean; isFeatured?: boolean; description?: string; imageUrl?: string }
  ) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...(typeof data.isWebsiteVisible === 'boolean' && { isWebsiteVisible: data.isWebsiteVisible }),
        ...(typeof data.isFeatured === 'boolean' && { isFeatured: data.isFeatured }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      },
    });
  }

  /**
   * Get all gallery items for CMS
   */
  static async getCmsGallery() {
    return prisma.galleryItem.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Create gallery item
   */
  static async createGalleryItem(data: {
    title?: string;
    caption?: string;
    mediaType?: 'IMAGE' | 'VIDEO';
    mediaUrl: string;
    thumbnailUrl?: string;
    displayOrder?: number;
    isVisible?: boolean;
  }) {
    if (!data.mediaUrl) {
      throw new BadRequestError('mediaUrl is required');
    }

    return prisma.galleryItem.create({
      data: {
        title: data.title || null,
        caption: data.caption || null,
        mediaType: data.mediaType || 'IMAGE',
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl || null,
        displayOrder: data.displayOrder ?? 0,
        isVisible: data.isVisible ?? true,
      },
    });
  }

  /**
   * Update gallery item
   */
  static async updateGalleryItem(
    id: string,
    data: {
      title?: string;
      caption?: string;
      mediaType?: 'IMAGE' | 'VIDEO';
      mediaUrl?: string;
      thumbnailUrl?: string;
      displayOrder?: number;
      isVisible?: boolean;
    }
  ) {
    const item = await prisma.galleryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError('Gallery item not found');
    }

    return prisma.galleryItem.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete gallery item
   */
  static async deleteGalleryItem(id: string) {
    const item = await prisma.galleryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError('Gallery item not found');
    }

    return prisma.galleryItem.delete({
      where: { id },
    });
  }

  /**
   * Update company contact, hours, and social media links
   */
  static async updateContactSettings(data: {
    address?: string;
    phone?: string;
    email?: string;
    businessHours?: string;
    googleMapsUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    tagline?: string;
  }) {
    const settings = await prisma.companySettings.findFirst();
    if (!settings) {
      throw new NotFoundError('Company settings not initialized');
    }

    return prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });
  }
}
