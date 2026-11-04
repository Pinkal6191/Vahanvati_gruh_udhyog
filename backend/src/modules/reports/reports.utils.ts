export type DatePeriod = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom';
export type GroupByInterval = 'DAY' | 'WEEK' | 'MONTH';

export interface ResolvedDateRange {
  start: Date | null;
  end: Date | null;
  periodDescription: string;
}

/**
 * Resolves standard date presets or explicit date strings into consistent start and end Date objects.
 * Sets start time to 00:00:00.000 and end time to 23:59:59.999.
 */
export function resolveDateRange(
  period?: DatePeriod,
  startDate?: string,
  endDate?: string
): ResolvedDateRange {
  const now = new Date();

  if (period) {
    switch (period) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, periodDescription: 'Today' };
      }
      case 'yesterday': {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return { start, end, periodDescription: 'Yesterday' };
      }
      case 'this_week': {
        const start = new Date(now);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, periodDescription: 'This Week' };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, periodDescription: 'This Month' };
      }
      case 'this_year': {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, periodDescription: 'This Year' };
      }
      default:
        break;
    }
  }

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  const periodDescription = start && end
    ? `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`
    : start
    ? `From ${start.toISOString().split('T')[0]}`
    : end
    ? `Up to ${end.toISOString().split('T')[0]}`
    : 'All Time';

  return { start, end, periodDescription };
}

/**
 * Format date for aggregation bucket grouping
 */
export function formatPeriodKey(date: Date, interval: GroupByInterval): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (interval === 'DAY') {
    return `${year}-${month}-${day}`;
  } else if (interval === 'MONTH') {
    return `${year}-${month}`;
  } else {
    // Week format: YYYY-Www
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  }
}

/**
 * Round numbers safely to 2 decimal places
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Format Date to standard Indian date display: DD/MM/YYYY
 */
export function formatIndianDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Format Date to standard Indian date and time display: DD/MM/YYYY, hh:mm:ss a
 */
export function formatIndianDateTime(d: Date | string | null | undefined = new Date()): string {
  const dateObj = typeof d === 'string' ? new Date(d) : (d || new Date());
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Formats report period description for PDF and Excel exports.
 * Examples:
 * - Today — 04/11/2026
 * - This Month — 01/11/2026 to 04/11/2026
 * - Custom — 01/10/2026 to 31/10/2026
 */
export function formatReportPeriodDisplay(
  period?: string,
  startDate?: string,
  endDate?: string,
  summaryPeriod?: string
): string {
  const now = new Date();
  const raw = (period || summaryPeriod || '').toLowerCase().trim();
  const normalized = raw.replace(/[\s_-]+/g, '');

  if (normalized === 'today') {
    return `Today — ${formatIndianDate(now)}`;
  }
  if (normalized === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return `Yesterday — ${formatIndianDate(y)}`;
  }
  if (normalized === 'thisweek') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now);
    start.setDate(diff);
    return `This Week — ${formatIndianDate(start)} to ${formatIndianDate(now)}`;
  }
  if (normalized === 'thismonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return `This Month — ${formatIndianDate(start)} to ${formatIndianDate(now)}`;
  }
  if (normalized === 'thisyear') {
    const start = new Date(now.getFullYear(), 0, 1);
    return `This Year — ${formatIndianDate(start)} to ${formatIndianDate(now)}`;
  }

  const startStr = startDate ? formatIndianDate(startDate) : '';
  const endStr = endDate ? formatIndianDate(endDate) : '';

  if (normalized === 'custom' || (startStr && endStr)) {
    if (startStr && endStr) return `Custom — ${startStr} to ${endStr}`;
    if (startStr) return `From ${startStr}`;
    if (endStr) return `Up to ${endStr}`;
  }

  if (summaryPeriod && summaryPeriod.includes(' to ')) {
    const [sPart, ePart] = summaryPeriod.split(' to ');
    const sFormatted = formatIndianDate(sPart);
    const eFormatted = formatIndianDate(ePart);
    if (sFormatted && eFormatted) {
      return `Custom — ${sFormatted} to ${eFormatted}`;
    }
  }

  return summaryPeriod || 'All Time';
}

/**
 * Format weight from grams into display string matching software screen:
 * e.g. 143500g -> "143.50 KG", 500g -> "500 GM", 50g -> "50 GM", piece products -> "—"
 */
export function formatWeightVal(grams: number | string | null | undefined, isWeightBased: boolean = true): string {
  if (!isWeightBased) {
    return '—';
  }
  const num = typeof grams === 'string' ? parseFloat(grams) : Number(grams ?? 0);
  if (isNaN(num) || num <= 0) {
    return '0 GM';
  }
  if (num >= 1000) {
    const kg = num / 1000;
    return `${kg % 1 === 0 ? kg : kg.toFixed(2)} KG`;
  }
  return `${num} GM`;
}

