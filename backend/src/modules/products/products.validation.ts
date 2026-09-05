import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  code: z.string().min(1, 'Category code is required').toUpperCase().trim(),
  displayOrder: z.number().int().default(0),
});

export const createSubcategorySchema = z.object({
  categoryId: z.string().uuid('Valid Category ID is required'),
  name: z.string().min(1, 'Subcategory name is required').trim(),
  code: z.string().min(1, 'Subcategory code is required').toUpperCase().trim(),
  displayOrder: z.number().int().default(0),
});

export const createProductSchema = z.object({
  subcategoryId: z.string().uuid('Valid Subcategory ID is required'),
  primaryUnitId: z.string().uuid('Valid Unit ID is required'),
  name: z.string().min(1, 'Product name is required').trim(),
  gujaratiName: z.string().optional().nullable(),
  code: z.string().min(1, 'Product code is required').toUpperCase().trim(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isLooseWeightAllowed: z.boolean().default(true),
  minimumStockThreshold: z.number().default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const createPackConfigSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  packName: z.string().min(1, 'Pack name is required'),
  weightInBaseUnits: z.number().positive('Weight must be positive'),
  unitId: z.string().uuid('Valid Unit ID is required'),
  displayOrder: z.number().int().default(0),
});

export const productQuerySchema = z.object({
  subcategoryId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreatePackConfigInput = z.infer<typeof createPackConfigSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
