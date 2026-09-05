import { z } from 'zod';

export const createSaleItemSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  packConfigId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  looseWeightInGrams: z.number().positive('Loose weight must be positive').optional().nullable(),
});

export const salePaymentSchema = z.object({
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
  amount: z.number().positive('Payment amount must be positive'),
  transactionReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(createSaleItemSchema).min(1, 'Cart cannot be empty'),
  discountAmount: z.number().min(0).default(0),
  payments: z.array(salePaymentSchema).min(1, 'At least one payment entry is required'),
  paidAmount: z.number().positive('Paid amount is required'),
});

export const salesQuerySchema = z.object({
  billNumber: z.string().optional(),
  customerId: z.string().uuid().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SalesQueryInput = z.infer<typeof salesQuerySchema>;
