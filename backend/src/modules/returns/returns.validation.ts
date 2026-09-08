import { z } from 'zod';
import { ReturnStatus, RefundPaymentMode, RestockCondition } from '@prisma/client';

export const createReturnItemSchema = z.object({
  saleItemId: z.string().uuid('Valid Sale Item ID is required'),
  returnedQuantity: z.number().positive('Return quantity must be greater than zero'),
  restockCondition: z.nativeEnum(RestockCondition).default(RestockCondition.RESTOCKABLE),
});

export const createReturnSchema = z.object({
  originalSaleId: z.string().uuid('Valid original sale ID is required'),
  reason: z.string().min(3, 'Reason for return must be at least 3 characters long').max(255, 'Reason cannot exceed 255 characters'),
  refundPaymentMode: z.nativeEnum(RefundPaymentMode).default(RefundPaymentMode.CASH),
  status: z.nativeEnum(ReturnStatus).optional(),
  items: z.array(createReturnItemSchema).min(1, 'At least one item must be returned'),
});

export const updateReturnSchema = z.object({
  reason: z.string().min(3, 'Reason for return must be at least 3 characters long').max(255, 'Reason cannot exceed 255 characters').optional(),
  refundPaymentMode: z.nativeEnum(RefundPaymentMode).optional(),
  items: z.array(createReturnItemSchema).min(1, 'At least one item must be returned').optional(),
});

export const cancelReturnSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason must be at least 3 characters long').max(255, 'Cancellation reason cannot exceed 255 characters'),
});

export const returnsQuerySchema = z.object({
  returnNumber: z.string().optional(),
  originalBillNumber: z.string().optional(),
  customerId: z.string().uuid('Valid Customer ID is required').optional(),
  productId: z.string().uuid('Valid Product ID is required').optional(),
  status: z.nativeEnum(ReturnStatus).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateReturnItemInput = z.infer<typeof createReturnItemSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type UpdateReturnInput = z.infer<typeof updateReturnSchema>;
export type CancelReturnInput = z.infer<typeof cancelReturnSchema>;
export type ReturnsQueryInput = z.infer<typeof returnsQuerySchema>;
