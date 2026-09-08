import { z } from 'zod';
import { ProductionStatus } from '@prisma/client';

export const createProductionSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  quantityProduced: z.number().positive('Quantity produced must be greater than zero'),
  unitId: z.string().uuid('Valid Unit ID is required'),
  batchNumber: z.string().max(50, 'Batch number cannot exceed 50 characters').optional().nullable(),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional().nullable(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  status: z.nativeEnum(ProductionStatus).optional(),
}).refine(
  (data) => {
    if (data.expiryDate && data.productionDate) {
      return new Date(data.expiryDate) >= new Date(data.productionDate);
    }
    return true;
  },
  {
    message: 'Expiry date must be on or after production date',
    path: ['expiryDate'],
  }
);

export const updateProductionSchema = z.object({
  quantityProduced: z.number().positive('Quantity produced must be greater than zero').optional(),
  unitId: z.string().uuid('Valid Unit ID is required').optional(),
  batchNumber: z.string().max(50, 'Batch number cannot exceed 50 characters').optional().nullable(),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional().nullable(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
}).refine(
  (data) => {
    if (data.expiryDate && data.productionDate) {
      return new Date(data.expiryDate) >= new Date(data.productionDate);
    }
    return true;
  },
  {
    message: 'Expiry date must be on or after production date',
    path: ['expiryDate'],
  }
);

export const cancelProductionSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason must be at least 3 characters long'),
});

export const productionQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  status: z.nativeEnum(ProductionStatus).optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateProductionInput = z.infer<typeof createProductionSchema>;
export type UpdateProductionInput = z.infer<typeof updateProductionSchema>;
export type CancelProductionInput = z.infer<typeof cancelProductionSchema>;
export type ProductionQueryInput = z.infer<typeof productionQuerySchema>;
