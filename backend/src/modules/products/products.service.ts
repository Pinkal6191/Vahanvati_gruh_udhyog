import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../common/errors/app-error.js';
import {
  CreateCategoryInput,
  CreateSubcategoryInput,
  CreateProductInput,
  UpdateProductInput,
  CreatePackConfigInput,
  ProductQueryInput,
} from './products.validation.js';

export class ProductsService {
  // Categories
  static async listCategories() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  static async createCategory(data: CreateCategoryInput) {
    const existing = await prisma.category.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError('Category code already exists');

    return prisma.category.create({ data });
  }

  // Subcategories
  static async listSubcategories(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    return prisma.subcategory.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      include: { category: true },
    });
  }

  static async createSubcategory(data: CreateSubcategoryInput) {
    const existing = await prisma.subcategory.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError('Subcategory code already exists');

    return prisma.subcategory.create({ data });
  }

  // Units
  static async listUnits() {
    return prisma.unit.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Products
  static async listProducts(query: ProductQueryInput) {
    const { subcategoryId, categoryId, search, active, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (active !== undefined) where.isActive = active;
    if (subcategoryId) where.subcategoryId = subcategoryId;
    if (categoryId) {
      where.subcategory = { categoryId };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          subcategory: {
            include: { category: true },
          },
          primaryUnit: true,
          packConfigurations: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
          },
          prices: {
            where: { isActive: true },
          },
          stock: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        subcategory: {
          include: { category: true },
        },
        primaryUnit: true,
        packConfigurations: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: { unit: true },
        },
        prices: {
          where: { isActive: true },
        },
        stock: true,
      },
    });

    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  static async createProduct(data: CreateProductInput) {
    const existing = await prisma.product.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError('Product code already exists');

    const { minimumStockThreshold, ...productData } = data;

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          stock: {
            create: {
              currentBalance: 0.0,
              minimumThreshold: minimumStockThreshold,
            },
          },
        },
        include: { stock: true },
      });

      return product;
    });
  }

  static async updateProduct(id: string, data: UpdateProductInput) {
    await this.getProductById(id);
    const { minimumStockThreshold, ...productData } = data;

    return prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(minimumStockThreshold !== undefined && {
          stock: {
            update: {
              minimumThreshold: minimumStockThreshold,
            },
          },
        }),
      },
      include: { stock: true },
    });
  }

  static async addPackConfiguration(data: CreatePackConfigInput) {
    await this.getProductById(data.productId);

    return prisma.productPackConfiguration.create({
      data: {
        productId: data.productId,
        packName: data.packName,
        weightInBaseUnits: data.weightInBaseUnits,
        unitId: data.unitId,
        displayOrder: data.displayOrder,
      },
    });
  }
}
