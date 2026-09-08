import { z } from 'zod';
import { PaymentMode, ProductionStatus, ReturnStatus, RefundPaymentMode, MovementType } from '@prisma/client';

export const salesReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  customerId: z.string().uuid('Valid customer ID required').optional(),
});

export const productReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  categoryId: z.string().uuid('Valid category ID required').optional(),
  subcategoryId: z.string().uuid('Valid subcategory ID required').optional(),
  sortBy: z.enum(['amount', 'quantity', 'bills']).default('amount'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const customerReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  minBills: z.coerce.number().min(1).optional(),
  sortBy: z.enum(['purchases', 'bills', 'lastPurchase']).default('purchases'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const customerHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export const productionReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  productId: z.string().uuid('Valid product ID required').optional(),
  status: z.nativeEnum(ProductionStatus).optional(),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
});

export const stockReportQuerySchema = z.object({
  status: z.enum(['ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK']).default('ALL'),
  categoryId: z.string().uuid('Valid category ID required').optional(),
  subcategoryId: z.string().uuid('Valid subcategory ID required').optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const stockMovementsReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  productId: z.string().uuid('Valid product ID required').optional(),
  movementType: z.nativeEnum(MovementType).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const returnsReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  productId: z.string().uuid('Valid product ID required').optional(),
  status: z.nativeEnum(ReturnStatus).optional(),
  refundPaymentMode: z.nativeEnum(RefundPaymentMode).optional(),
});

export const businessSummaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
export type ProductReportQuery = z.infer<typeof productReportQuerySchema>;
export type CustomerReportQuery = z.infer<typeof customerReportQuerySchema>;
export type CustomerHistoryQuery = z.infer<typeof customerHistoryQuerySchema>;
export type ProductionReportQuery = z.infer<typeof productionReportQuerySchema>;
export type StockReportQuery = z.infer<typeof stockReportQuerySchema>;
export type StockMovementsReportQuery = z.infer<typeof stockMovementsReportQuerySchema>;
export type ReturnsReportQuery = z.infer<typeof returnsReportQuerySchema>;
export type BusinessSummaryQuery = z.infer<typeof businessSummaryQuerySchema>;
