import { z } from 'zod';
import { PaymentMode, ProductionStatus, ReturnStatus, RefundPaymentMode, MovementType, SaleType, CustomerType } from '@prisma/client';

export const salesReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  customerId: z.string().uuid('Valid customer ID required').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
});

export const productReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  categoryId: z.string().uuid('Valid category ID required').optional(),
  subcategoryId: z.string().uuid('Valid subcategory ID required').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  sortBy: z.enum(['amount', 'quantity', 'bills']).default('amount'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const customerReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  minBills: z.coerce.number().min(1).optional(),
  sortBy: z.enum(['purchases', 'bills', 'lastPurchase']).default('purchases'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

export const customerHistoryQuerySchema = z.object({
  saleType: z.nativeEnum(SaleType).optional(),
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
  saleType: z.nativeEnum(SaleType).optional(),
});

export const businessSummaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
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

// ==========================================
// Phase 2F: Statutory / CA Compliance Queries
// ==========================================

export const statutorySalesReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  paymentMode: z.nativeEnum(PaymentMode).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  status: z.enum(['ALL', 'COMPLETED', 'CANCELLED']).default('ALL'),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryItemizedReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  status: z.enum(['ALL', 'COMPLETED', 'CANCELLED']).default('ALL'),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryReturnsReportQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  refundPaymentMode: z.nativeEnum(RefundPaymentMode).optional(),
  status: z.nativeEnum(ReturnStatus).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryGstSummaryQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type StatutorySalesReportQuery = z.infer<typeof statutorySalesReportQuerySchema>;
export type StatutoryItemizedReportQuery = z.infer<typeof statutoryItemizedReportQuerySchema>;
export type StatutoryReturnsReportQuery = z.infer<typeof statutoryReturnsReportQuerySchema>;
export type StatutoryGstSummaryQuery = z.infer<typeof statutoryGstSummaryQuerySchema>;
