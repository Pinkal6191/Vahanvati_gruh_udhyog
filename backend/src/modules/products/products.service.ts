import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../common/errors/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryQueryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  SubcategoryQueryInput,
  CreateUnitInput,
  UpdateUnitInput,
  UnitQueryInput,
  CreateProductInput,
  UpdateProductInput,
  CreatePackConfigInput,
  ProductQueryInput,
} from './products.validation.js';

export class ProductsService {
  // ==========================================
  // CATEGORIES
  // ==========================================

  static async listCategories(query?: CategoryQueryInput) {
    const where: any = {};

    if (query?.status === 'active') {
      where.isActive = true;
    } else if (query?.status === 'inactive') {
      where.isActive = false;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.category.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    });
  }

  static async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  static async createCategory(data: CreateCategoryInput, userId?: string, userRole = 'ADMIN') {
    const existing = await prisma.category.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Category code '${data.code}' already exists`);

    const category = await prisma.category.create({ data });

    await AuditService.log({
      userId,
      userRole,
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: category.id,
      newValues: category,
    });

    return category;
  }

  static async updateCategory(id: string, data: UpdateCategoryInput, userId?: string, userRole = 'ADMIN') {
    const oldCategory = await this.getCategoryById(id);

    if (data.code && data.code !== oldCategory.code) {
      const existing = await prisma.category.findUnique({ where: { code: data.code } });
      if (existing) throw new ConflictError(`Category code '${data.code}' already exists`);
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues: oldCategory,
      newValues: updated,
    });

    return updated;
  }

  static async updateCategoryStatus(id: string, isActive: boolean, userId?: string, userRole = 'ADMIN') {
    const oldCategory = await this.getCategoryById(id);

    const updated = await prisma.category.update({
      where: { id },
      data: { isActive },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'CATEGORY_STATUS_CHANGED',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues: { isActive: oldCategory.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  // ==========================================
  // SUBCATEGORIES
  // ==========================================

  static async listSubcategories(query?: SubcategoryQueryInput) {
    const where: any = {};

    if (query?.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query?.status === 'active') {
      where.isActive = true;
    } else if (query?.status === 'inactive') {
      where.isActive = false;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.subcategory.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    });
  }

  static async getSubcategoryById(id: string) {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!subcategory) throw new NotFoundError('Subcategory not found');
    return subcategory;
  }

  static async createSubcategory(data: CreateSubcategoryInput, userId?: string, userRole = 'ADMIN') {
    // Validate parent category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new NotFoundError(`Parent Category ID '${data.categoryId}' not found`);

    const existing = await prisma.subcategory.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Subcategory code '${data.code}' already exists`);

    const subcategory = await prisma.subcategory.create({
      data,
      include: { category: true },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'SUBCATEGORY_CREATED',
      entityType: 'SUBCATEGORY',
      entityId: subcategory.id,
      newValues: subcategory,
    });

    return subcategory;
  }

  static async updateSubcategory(id: string, data: UpdateSubcategoryInput, userId?: string, userRole = 'ADMIN') {
    const oldSubcategory = await this.getSubcategoryById(id);

    if (data.categoryId && data.categoryId !== oldSubcategory.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw new NotFoundError(`Parent Category ID '${data.categoryId}' not found`);
    }

    if (data.code && data.code !== oldSubcategory.code) {
      const existing = await prisma.subcategory.findUnique({ where: { code: data.code } });
      if (existing) throw new ConflictError(`Subcategory code '${data.code}' already exists`);
    }

    const updated = await prisma.subcategory.update({
      where: { id },
      data,
      include: { category: true },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'SUBCATEGORY_UPDATED',
      entityType: 'SUBCATEGORY',
      entityId: id,
      oldValues: oldSubcategory,
      newValues: updated,
    });

    return updated;
  }

  static async updateSubcategoryStatus(id: string, isActive: boolean, userId?: string, userRole = 'ADMIN') {
    const oldSubcategory = await this.getSubcategoryById(id);

    const updated = await prisma.subcategory.update({
      where: { id },
      data: { isActive },
      include: { category: true },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'SUBCATEGORY_STATUS_CHANGED',
      entityType: 'SUBCATEGORY',
      entityId: id,
      oldValues: { isActive: oldSubcategory.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  // ==========================================
  // UNITS / WEIGHT CONFIGURATION
  // ==========================================

  static async listUnits(query?: UnitQueryInput) {
    const where: any = {};
    if (query?.status === 'active') {
      where.isActive = true;
    } else if (query?.status === 'inactive') {
      where.isActive = false;
    }

    return prisma.unit.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  static async getUnitById(id: string) {
    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundError('Unit not found');
    return unit;
  }

  static async createUnit(data: CreateUnitInput, userId?: string, userRole = 'ADMIN') {
    const unit = await prisma.unit.create({
      data: {
        name: data.name,
        symbol: data.symbol,
        isWeightBased: data.isWeightBased,
        conversionFactorToBase: data.conversionFactorToBase,
      },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'UNIT_CREATED',
      entityType: 'UNIT',
      entityId: unit.id,
      newValues: unit,
    });

    return unit;
  }

  static async updateUnit(id: string, data: UpdateUnitInput, userId?: string, userRole = 'ADMIN') {
    const oldUnit = await this.getUnitById(id);

    const updated = await prisma.unit.update({
      where: { id },
      data,
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'UNIT_UPDATED',
      entityType: 'UNIT',
      entityId: id,
      oldValues: oldUnit,
      newValues: updated,
    });

    return updated;
  }

  static async updateUnitStatus(id: string, isActive: boolean, userId?: string, userRole = 'ADMIN') {
    const oldUnit = await this.getUnitById(id);

    const updated = await prisma.unit.update({
      where: { id },
      data: { isActive },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'UNIT_STATUS_CHANGED',
      entityType: 'UNIT',
      entityId: id,
      oldValues: { isActive: oldUnit.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  // ==========================================
  // PRODUCTS & HIERARCHY VALIDATION
  // ==========================================

  static async listProducts(query?: Partial<ProductQueryInput>) {
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;
    const search = query?.search;
    const categoryId = query?.categoryId;
    const subcategoryId = query?.subcategoryId;
    const status = query?.status;

    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

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
          stock: {
            select: { currentBalance: true, minimumThreshold: true },
          },
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
          orderBy: { displayOrder: 'asc' },
          include: { unit: true },
        },
        stock: true,
      },
    });

    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  /**
   * Creates a product with strict hierarchy validation:
   * Verifies that subcategoryId belongs to categoryId if categoryId is supplied.
   */
  static async createProduct(data: CreateProductInput, userId?: string, userRole = 'ADMIN') {
    // 1. Verify Subcategory exists
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: data.subcategoryId },
      include: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundError(`Subcategory ID '${data.subcategoryId}' not found`);
    }

    // 2. Hierarchy Validation (Section 11 & 33)
    if (data.categoryId && data.categoryId !== subcategory.categoryId) {
      throw new BadRequestError(
        `Hierarchy mismatch: Subcategory '${subcategory.name}' belongs to Category '${subcategory.category.name}', not the provided Category ID '${data.categoryId}'`
      );
    }

    // 3. Verify Unit exists
    const unit = await prisma.unit.findUnique({ where: { id: data.primaryUnitId } });
    if (!unit) {
      throw new NotFoundError(`Primary Unit ID '${data.primaryUnitId}' not found`);
    }

    // 4. Verify unique product code
    const existing = await prisma.product.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new ConflictError(`Product code '${data.code}' already exists`);
    }

    const { categoryId: _catId, minimumStockThreshold, ...productData } = data;

    // 5. Create Product & initialize 0 stock
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          stock: {
            create: {
              currentBalance: 0.0,
              minimumThreshold: minimumStockThreshold || 0.0,
            },
          },
        },
        include: {
          subcategory: { include: { category: true } },
          primaryUnit: true,
          stock: true,
        },
      });

      await AuditService.log({
        userId,
        userRole,
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        newValues: product,
      });

      return product;
    });
  }

  static async updateProduct(id: string, data: UpdateProductInput, userId?: string, userRole = 'ADMIN') {
    const oldProduct = await this.getProductById(id);

    // If subcategory or category is updated, validate hierarchy
    const targetSubcategoryId = data.subcategoryId || oldProduct.subcategoryId;
    const targetCategoryId = data.categoryId || oldProduct.subcategory.categoryId;

    if (data.subcategoryId || data.categoryId) {
      const subcategory = await prisma.subcategory.findUnique({
        where: { id: targetSubcategoryId },
        include: { category: true },
      });

      if (!subcategory) {
        throw new NotFoundError(`Subcategory ID '${targetSubcategoryId}' not found`);
      }

      if (targetCategoryId && subcategory.categoryId !== targetCategoryId) {
        throw new BadRequestError(
          `Hierarchy mismatch: Subcategory '${subcategory.name}' belongs to Category '${subcategory.category.name}', not the provided Category ID '${targetCategoryId}'`
        );
      }
    }

    if (data.code && data.code !== oldProduct.code) {
      const existing = await prisma.product.findUnique({ where: { code: data.code } });
      if (existing) throw new ConflictError(`Product code '${data.code}' already exists`);
    }

    const { categoryId: _catId, minimumStockThreshold, ...updateData } = data;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        ...(minimumStockThreshold !== undefined && {
          stock: {
            update: { minimumThreshold: minimumStockThreshold },
          },
        }),
      },
      include: {
        subcategory: { include: { category: true } },
        primaryUnit: true,
        stock: true,
      },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: oldProduct,
      newValues: updated,
    });

    return updated;
  }

  static async updateProductStatus(id: string, isActive: boolean, userId?: string, userRole = 'ADMIN') {
    const oldProduct = await this.getProductById(id);

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive },
      include: {
        subcategory: { include: { category: true } },
        primaryUnit: true,
      },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'PRODUCT_STATUS_CHANGED',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: { isActive: oldProduct.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }

  static async addPackConfiguration(data: CreatePackConfigInput, userId?: string, userRole = 'ADMIN') {
    await this.getProductById(data.productId);

    const unit = await prisma.unit.findUnique({ where: { id: data.unitId } });
    if (!unit) throw new NotFoundError('Unit not found');

    const pack = await prisma.productPackConfiguration.create({
      data: {
        productId: data.productId,
        packName: data.packName,
        weightInBaseUnits: data.weightInBaseUnits,
        unitId: data.unitId,
        displayOrder: data.displayOrder,
      },
      include: { unit: true },
    });

    await AuditService.log({
      userId,
      userRole,
      action: 'PRODUCT_PACK_CONFIG_ADDED',
      entityType: 'PRODUCT_PACK_CONFIG',
      entityId: pack.id,
      newValues: pack,
    });

    return pack;
  }
}
