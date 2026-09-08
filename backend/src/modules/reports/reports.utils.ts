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
