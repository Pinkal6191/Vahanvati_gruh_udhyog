import { z } from 'zod';

export const createProductionSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  quantityProduced: z.number().positive('Quantity must be positive'),
  unitId: z.string().uuid('Valid Unit ID is required'),
  batchNumber: z.string().optional().nullable(),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const productionQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  date: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateProductionInput = z.infer<typeof createProductionSchema>;
export type ProductionQueryInput = z.infer<typeof productionQuerySchema>;
