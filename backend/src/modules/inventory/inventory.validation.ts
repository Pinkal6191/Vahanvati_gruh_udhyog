import { z } from 'zod';
import { MovementType, ReferenceType } from '@prisma/client';

export const stockQuerySchema = z.object({
  lowStockOnly: z.coerce.boolean().optional(),
  outOfStockOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
  subcategoryId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional().default(true),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const movementQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  movementType: z.nativeEnum(MovementType).optional(),
  referenceType: z.nativeEnum(ReferenceType).optional(),
  referenceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  quantityDelta: z.number().refine((val) => val !== 0, 'Quantity delta cannot be zero'),
  reason: z.string().min(3, 'Reason must be at least 3 characters long'),
});

export const stockMutationSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  quantityDelta: z.number().positive('Quantity must be a positive number'),
  movementType: z.nativeEnum(MovementType),
  referenceType: z.nativeEnum(ReferenceType),
  referenceId: z.string().uuid('Valid reference ID is required'),
  notes: z.string().max(255).optional().nullable(),
});

export type StockQueryInput = z.infer<typeof stockQuerySchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type StockMutationInput = z.infer<typeof stockMutationSchema>;
