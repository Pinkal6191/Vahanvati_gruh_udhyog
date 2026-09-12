/**
 * Format numeric value as Indian Rupee (INR)
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format weight from base unit (grams) to display format
 */
export function formatWeight(grams: number | string | null | undefined): string {
  const num = typeof grams === 'string' ? parseFloat(grams) : Number(grams ?? 0);
  if (isNaN(num)) return '0 GM';
  if (num >= 1000) {
    const kg = num / 1000;
    return `${kg % 1 === 0 ? kg : kg.toFixed(2)} KG`;
  }
  return `${num} GM`;
}

export function formatGramsToKg(grams: number | string | null | undefined): string {
  const num = typeof grams === 'string' ? parseFloat(grams) : Number(grams ?? 0);
  if (isNaN(num)) return '0 g';
  if (num >= 1000) {
    const kg = num / 1000;
    const str = Number(kg.toFixed(2)).toString();
    return `${str} kg`;
  }
  return `${num} g`;
}

/**
 * Format quantity delta with positive/negative sign and unit (e.g. +1 kg, -500 g, -2 kg)
 */
export function formatDeltaWeight(grams: number | string | null | undefined): string {
  const num = typeof grams === 'string' ? parseFloat(grams) : Number(grams ?? 0);
  if (isNaN(num) || num === 0) return '0 g';
  const sign = num > 0 ? '+' : '-';
  const absGrams = Math.abs(num);
  if (absGrams >= 1000) {
    const kg = absGrams / 1000;
    const str = Number(kg.toFixed(2)).toString();
    return `${sign}${str} kg`;
  }
  return `${sign}${absGrams} g`;
}

/**
 * Format Indian mobile number with country code and spacing
 */
export function formatIndianMobile(mobile: string | null | undefined): string {
  if (!mobile) return '-';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const core = digits.slice(2);
    return `+91 ${core.slice(0, 5)} ${core.slice(5)}`;
  }
  return mobile;
}

/**
 * Format sequential invoice number with padded zeros
 */
export function formatInvoiceNumber(seq: number, year: number = new Date().getFullYear()): string {
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
}

/**
 * Format Date to standard readable string
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Format Date with Time
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
