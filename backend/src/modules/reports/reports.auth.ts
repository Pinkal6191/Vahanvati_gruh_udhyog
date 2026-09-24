import { SaleType } from '@prisma/client';
import { ForbiddenError } from '../../common/errors/app-error.js';
import { AuthenticatedUser } from '../../middlewares/auth.middleware.js';

export const ALL_SALE_TYPES: SaleType[] = [
  SaleType.RETAIL,
  SaleType.NRI,
  SaleType.WHOLESALE,
];

export interface ResolvedSaleTypeScope {
  effectiveSaleType?: SaleType;
  effectiveSaleTypes: SaleType[];
  isMasterAdmin: boolean;
  isScoped: boolean;
}

/**
 * Centralized authorization helper for SaleType reporting and transaction inspection.
 *
 * Rules:
 * 1. Recognizes Master Admin (isMasterAdmin === true) -> unrestricted across all SaleTypes.
 * 2. Constrains normal users to user.allowedReportSaleTypes (defaulting to [RETAIL]).
 * 3. Rejects unauthorized explicit SaleType with HTTP 403 Forbidden.
 * 4. Provides effective allowed SaleType scope for queries without an explicit filter.
 */
export function resolveReportSaleTypeScope(
  user?: AuthenticatedUser,
  requestedSaleType?: SaleType
): ResolvedSaleTypeScope {
  const isMasterAdmin = Boolean(user?.isMasterAdmin);

  const allowedTypes: SaleType[] = isMasterAdmin
    ? ALL_SALE_TYPES
    : (user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
        ? user.allowedReportSaleTypes
        : [SaleType.RETAIL]);

  if (requestedSaleType) {
    if (!allowedTypes.includes(requestedSaleType)) {
      throw new ForbiddenError(
        `Access denied: You are not authorized to view ${requestedSaleType} reports or transactions`
      );
    }
    return {
      effectiveSaleType: requestedSaleType,
      effectiveSaleTypes: [requestedSaleType],
      isMasterAdmin,
      isScoped: !isMasterAdmin,
    };
  }

  return {
    effectiveSaleTypes: allowedTypes,
    isMasterAdmin,
    isScoped: !isMasterAdmin,
  };
}

/**
 * Validates that a user is authorized to view a specific sale record by its saleType.
 * Throws HTTP 403 ForbiddenError if unauthorized.
 */
export function assertCanViewSale(user?: AuthenticatedUser, saleType?: SaleType | null): void {
  if (!saleType) return;
  if (user?.isMasterAdmin) return;

  const allowedTypes: SaleType[] =
    user?.allowedReportSaleTypes && user.allowedReportSaleTypes.length > 0
      ? user.allowedReportSaleTypes
      : [SaleType.RETAIL];

  if (!allowedTypes.includes(saleType)) {
    throw new ForbiddenError(
      `Access denied: You are not authorized to view ${saleType} sale details`
    );
  }
}
