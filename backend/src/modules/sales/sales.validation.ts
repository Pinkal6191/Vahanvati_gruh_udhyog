import { z } from 'zod';
import { CustomerType, PaymentMode, SaleStatus } from '@prisma/client';

export const createSaleItemSchema = z.object({
  productId: z.string().uuid('Valid Product ID is required'),
  packConfigId: z.string().uuid('Valid Pack Config ID is required').optional().nullable(),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .positive('Quantity must be positive')
    .max(10000, 'Quantity cannot exceed 10,000'),
  looseWeightInGrams: z
    .number()
    .positive('Loose weight must be positive')
    .max(1000000, 'Loose weight cannot exceed 1,000,000 grams')
    .optional()
    .nullable(),
});

export const salePaymentSchema = z.object({
  paymentMode: z.nativeEnum(PaymentMode, {
    errorMap: () => ({ message: 'Payment mode must be CASH, UPI, CARD, or OTHER' }),
  }),
  amount: z
    .number({ required_error: 'Payment amount is required' })
    .positive('Payment amount must be positive')
    .refine(
      (val) => {
        const str = val.toString();
        const decimalPart = str.split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      { message: 'Payment amount cannot have more than 2 decimal places' }
    ),
  transactionReference: z.string().max(100).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid('Valid Customer ID is required').optional().nullable(),
  customerType: z.nativeEnum(CustomerType).optional().nullable(),
  items: z.array(createSaleItemSchema).min(1, 'Cart cannot be empty'),
  discountAmount: z
    .number()
    .min(0, 'Discount cannot be negative')
    .default(0)
    .refine(
      (val) => {
        const str = val.toString();
        const decimalPart = str.split('.')[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      { message: 'Discount cannot have more than 2 decimal places' }
    ),
  payments: z.array(salePaymentSchema).min(1, 'At least one payment entry is required'),
  paidAmount: z
    .number({ required_error: 'Paid amount is required' })
    .min(0, 'Paid amount cannot be negative'),
});

export const cancelSaleSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(255, 'Cancellation reason cannot exceed 255 characters'),
});

export const salesQuerySchema = z.object({
  billNumber: z.string().optional(),
  customerId: z.string().uuid().optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  saleStatus: z.nativeEnum(SaleStatus).optional(),
  date: z.string().optional(), // YYYY-MM-DD
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type SalesQueryInput = z.infer<typeof salesQuerySchema>;
