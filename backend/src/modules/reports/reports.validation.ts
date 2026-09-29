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

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

export const statutorySalesReportQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional()).optional(),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional()).optional(),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional()).optional(),
  saleType: z.preprocess(emptyToUndefined, z.nativeEnum(SaleType).optional()).optional(),
  customerType: z.preprocess(emptyToUndefined, z.nativeEnum(CustomerType).optional()).optional(),
  paymentMode: z.preprocess(emptyToUndefined, z.nativeEnum(PaymentMode).optional()).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()).optional(),
  status: z.preprocess(emptyToUndefined, z.enum(['ALL', 'COMPLETED', 'CANCELLED']).optional()).default('ALL'),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryItemizedReportQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional()).optional(),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional()).optional(),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional()).optional(),
  saleType: z.preprocess(emptyToUndefined, z.nativeEnum(SaleType).optional()).optional(),
  customerType: z.preprocess(emptyToUndefined, z.nativeEnum(CustomerType).optional()).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()).optional(),
  status: z.preprocess(emptyToUndefined, z.enum(['ALL', 'COMPLETED', 'CANCELLED']).optional()).default('ALL'),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryReturnsReportQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional()).optional(),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional()).optional(),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional()).optional(),
  saleType: z.preprocess(emptyToUndefined, z.nativeEnum(SaleType).optional()).optional(),
  customerType: z.preprocess(emptyToUndefined, z.nativeEnum(CustomerType).optional()).optional(),
  refundPaymentMode: z.preprocess(emptyToUndefined, z.nativeEnum(RefundPaymentMode).optional()).optional(),
  status: z.preprocess((val) => (val === '' || val === 'ALL' ? undefined : val), z.nativeEnum(ReturnStatus).optional()).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const statutoryGstSummaryQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional()).optional(),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional()).optional(),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional()).optional(),
  saleType: z.preprocess(emptyToUndefined, z.nativeEnum(SaleType).optional()).optional(),
  customerType: z.preprocess(emptyToUndefined, z.nativeEnum(CustomerType).optional()).optional(),
  gstinOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type StatutorySalesReportQuery = z.infer<typeof statutorySalesReportQuerySchema>;
export type StatutoryItemizedReportQuery = z.infer<typeof statutoryItemizedReportQuerySchema>;
export type StatutoryReturnsReportQuery = z.infer<typeof statutoryReturnsReportQuerySchema>;
export type StatutoryGstSummaryQuery = z.infer<typeof statutoryGstSummaryQuerySchema>;

// ==========================================
// Admin Cash Report Query Schema
// ==========================================
export const cashReportQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'custom']).optional()).optional(),
  startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional()).optional(),
  endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional()).optional(),
  saleType: z.preprocess(emptyToUndefined, z.nativeEnum(SaleType).optional()).optional(),
  customerId: z.preprocess(emptyToUndefined, z.string().uuid('Valid customer ID required').optional()).optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(1).default(1),
  format: z.enum(['json', 'csv']).default('json'),
});

export type CashReportQuery = z.infer<typeof cashReportQuerySchema>;
