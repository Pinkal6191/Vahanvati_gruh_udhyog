import { z } from 'zod';

export const stockQuerySchema = z.object({
  lowStockOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const movementQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  movementType: z.enum(['SALE_OUT', 'SALES_RETURN_IN', 'PRODUCTION_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  quantityDelta: z.number().refine((val) => val !== 0, 'Quantity delta cannot be zero'),
  reason: z.string().min(1, 'Reason for adjustment is required'),
});

export type StockQueryInput = z.infer<typeof stockQuerySchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
