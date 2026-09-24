import { SaleType, CustomerType } from '@prisma/client';
import { BadRequestError } from '../../common/errors/app-error.js';

/**
 * Authoritative single canonical mapping from SaleType to ProductPrice pricingTier.
 * In Phase 2A/2B architecture, both use the canonical SaleType enum.
 */
export function mapSaleTypeToPricingTier(saleType: SaleType): SaleType {
  switch (saleType) {
    case SaleType.RETAIL:
      return SaleType.RETAIL;
    case SaleType.NRI:
      return SaleType.NRI;
    case SaleType.WHOLESALE:
      return SaleType.WHOLESALE;
    default:
      throw new BadRequestError(`Invalid or unsupported SaleType: ${saleType}`);
  }
}

export interface ResolvedItemOutput {
  productId: string;
  productName: string;
  gujaratiName?: string | null;
  packConfigId?: string | null;
  weightOrPackName: string;
  unitSymbol: string;
  quantity: number;
  baseWeightDeducted: number; // In base units (Grams or Pieces)
  unitRate: number; // Snapshot authoritative rate
  totalAmount: number;
  pricingTier: SaleType;
  saleType: SaleType;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  priceId: string;
}

export interface ResolvedCartOutput {
  customerId: string;
  customerType: CustomerType; // Customer demographic
  saleType: SaleType; // Authoritative transaction sale type
  customerName: string;
  customerMobile?: string | null;
  customerGstin?: string | null;
  items: ResolvedItemOutput[];
  subtotalAmount: number;
  finalTotalAmount: number;
}
