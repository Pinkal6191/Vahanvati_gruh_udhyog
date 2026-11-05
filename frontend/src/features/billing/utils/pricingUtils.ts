/**
 * Authoritative frontend price resolution helpers matching backend pricing rules:
 * - isActive === true
 * - rate > 0
 * - pricingTier matches requested saleType (RETAIL matches RETAIL or legacy INDIAN)
 * - effectiveFrom <= targetDate (if present)
 * - effectiveTo >= targetDate (if present)
 * - Deterministic precedence: latest effectiveFrom first; tie-break by ID
 */

export function isPriceRecordApplicable(
  pr: any,
  saleType: string,
  targetDate: Date = new Date()
): boolean {
  if (!pr || !pr.isActive || Number(pr.rate) <= 0) return false;

  const targetTier = saleType.toUpperCase();
  const prTier = (pr.pricingTier || pr.customerType || '').toUpperCase();

  const isTierMatch =
    prTier === targetTier ||
    (targetTier === 'RETAIL' && prTier === 'INDIAN');

  if (!isTierMatch) return false;

  const targetTime = targetDate.getTime();

  if (pr.effectiveFrom) {
    const fromTime = new Date(pr.effectiveFrom).getTime();
    if (fromTime > targetTime) return false;
  }

  if (pr.effectiveTo) {
    const toTime = new Date(pr.effectiveTo).getTime();
    if (toTime < targetTime) return false;
  }

  return true;
}

/**
 * Deterministically resolve active, applicable pack price record:
 * - Filters by packConfigId and isPriceRecordApplicable
 * - Deterministic precedence: latest effectiveFrom first; tie-break by ID
 */
export function resolveApplicablePackPrice(
  prices: any[] | undefined,
  packConfigId: string,
  saleType: string,
  targetDate: Date = new Date()
): any | null {
  if (!prices || !Array.isArray(prices)) return null;

  const matching = prices.filter(
    (pr) => pr.packConfigId === packConfigId && isPriceRecordApplicable(pr, saleType, targetDate)
  );

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const timeA = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
    const timeB = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

  return matching[0];
}

/**
 * Deterministically resolve active, applicable loose/base per-kg price record:
 * - Filters by !packConfigId and isPriceRecordApplicable
 * - Deterministic precedence: latest effectiveFrom first; tie-break by ID
 */
export function resolveApplicableBasePrice(
  prices: any[] | undefined,
  saleType: string,
  targetDate: Date = new Date()
): any | null {
  if (!prices || !Array.isArray(prices)) return null;

  const matching = prices.filter(
    (pr) => !pr.packConfigId && isPriceRecordApplicable(pr, saleType, targetDate)
  );

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const timeA = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
    const timeB = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

  return matching[0];
}
