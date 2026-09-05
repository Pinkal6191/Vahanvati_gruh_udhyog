import { z } from 'zod';

// Status toggle schema common to master data entities
export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean status is required' }),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name cannot exceed 100 characters').trim(),
  code: z.string().min(1, 'Category code is required').max(50, 'Code cannot exceed 50 characters').toUpperCase().trim(),
  displayOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

// Subcategory schemas
export const createSubcategorySchema = z.object({
  categoryId: z.string().uuid('Valid Category ID is required'),
  name: z.string().min(1, 'Subcategory name is required').max(100, 'Name cannot exceed 100 characters').trim(),
  code: z.string().min(1, 'Subcategory code is required').max(50, 'Code cannot exceed 50 characters').toUpperCase().trim(),
  displayOrder: z.number().int().default(0),
});

export const updateSubcategorySchema = z.object({
  categoryId: z.string().uuid('Valid Category ID is required').optional(),
  name: z.string().min(1, 'Subcategory name is required').max(100).trim().optional(),
  code: z.string().min(1, 'Subcategory code is required').max(50).toUpperCase().trim().optional(),
  displayOrder: z.number().int().optional(),
});

export const subcategoryQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

// Unit schemas
export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(50).trim(),
  symbol: z.string().min(1, 'Unit symbol is required').max(10).trim(),
  isWeightBased: z.boolean().default(true),
  conversionFactorToBase: z.number().positive('Conversion factor must be greater than 0').default(1.0),
});

export const updateUnitSchema = createUnitSchema.partial();

export const unitQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

// Product schemas
export const createProductSchema = z.object({
  categoryId: z.string().uuid('Category ID must be a valid UUID').optional(),
  subcategoryId: z.string().uuid('Subcategory ID must be a valid UUID'),
  primaryUnitId: z.string().uuid('Primary Unit ID must be a valid UUID'),
  name: z.string().min(1, 'Product name is required').max(150, 'Name cannot exceed 150 characters').trim(),
  gujaratiName: z.string().max(150).optional().nullable(),
  code: z.string().min(1, 'Product code is required').max(50).toUpperCase().trim(),
  barcode: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().max(255).optional().nullable(),
  isLooseWeightAllowed: z.boolean().default(true),
  minimumStockThreshold: z.number().min(0, 'Minimum threshold cannot be negative').default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const createPackConfigSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  packName: z.string().min(1, 'Pack name is required').max(50),
  weightInBaseUnits: z.number().positive('Weight in base units must be positive'),
  unitId: z.string().uuid('Valid Unit ID is required'),
  displayOrder: z.number().int().default(0),
});

export const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;

export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type SubcategoryQueryInput = z.infer<typeof subcategoryQuerySchema>;

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type UnitQueryInput = z.infer<typeof unitQuerySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreatePackConfigInput = z.infer<typeof createPackConfigSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
