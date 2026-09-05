import { z } from 'zod';

export const createReturnItemSchema = z.object({
  saleItemId: z.string().uuid('Valid Sale Item ID is required'),
  returnedQuantity: z.number().positive('Return quantity must be positive'),
  restockCondition: z.enum(['RESTOCKABLE', 'DAMAGED_DISCARD']).default('RESTOCKABLE'),
});

export const createReturnSchema = z.object({
  originalSaleId: z.string().uuid('Valid original sale ID is required'),
  reason: z.string().min(1, 'Reason for return is required'),
  refundPaymentMode: z.enum(['CASH', 'UPI', 'STORE_CREDIT']).default('CASH'),
  items: z.array(createReturnItemSchema).min(1, 'At least one item must be returned'),
});

export const returnsQuerySchema = z.object({
  returnNumber: z.string().optional(),
  originalBillNumber: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ReturnsQueryInput = z.infer<typeof returnsQuerySchema>;
