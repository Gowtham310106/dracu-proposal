import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { env } from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TZ = env.TZ;
export const d = (input?: dayjs.ConfigType) => dayjs(input).tz(TZ);

/** Indian financial year label for a date, e.g. 2026-27. */
export function financialYear(date: Date): string {
  const dt = d(date);
  const y = dt.year();
  const start = dt.month() >= 3 ? y : y - 1; // month() is 0-based; April = 3
  return `${start}-${String(start + 1).slice(-2)}`;
}

export const todayIso = () => d().format('YYYY-MM-DD');

/** Start/end Date objects (UTC instants) for a local ISO day in the clinic timezone. */
export function dayBounds(isoDate: string): { start: Date; end: Date } {
  const start = dayjs.tz(isoDate, 'YYYY-MM-DD', TZ).startOf('day');
  return { start: start.toDate(), end: start.endOf('day').toDate() };
}

export function rangeBounds(from?: string, to?: string): { start?: Date; end?: Date } {
  return {
    start: from ? dayBounds(from).start : undefined,
    end: to ? dayBounds(to).end : undefined,
  };
}

export function dateRangeFilter(field: string, from?: string, to?: string): Record<string, unknown> {
  const { start, end } = rangeBounds(from, to);
  if (!start && !end) return {};
  const cond: Record<string, Date> = {};
  if (start) cond.$gte = start;
  if (end) cond.$lte = end;
  return { [field]: cond };
}

/** Parse an ISO date (YYYY-MM-DD) as a Date at local midnight in the clinic timezone. */
export function isoToDate(iso: string): Date {
  return dayjs.tz(iso, 'YYYY-MM-DD', TZ).startOf('day').toDate();
}

export function toIso(date?: Date | string | null): string | undefined {
  return date ? d(date).format('YYYY-MM-DD') : undefined;
}

export function ageFromDob(dob?: Date | string | null): number | undefined {
  if (!dob) return undefined;
  return d().diff(d(dob), 'year');
}

/** Combine ISO date + HH:MM into an instant in clinic tz. */
export function combine(isoDate: string, hhmm: string): Date {
  return dayjs.tz(`${isoDate} ${hhmm}`, 'YYYY-MM-DD HH:mm', TZ).toDate();
}

export function addDaysIso(isoDate: string, days: number): string {
  return dayjs.tz(isoDate, 'YYYY-MM-DD', TZ).add(days, 'day').format('YYYY-MM-DD');
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function hhmmOf(date: Date): string {
  return d(date).format('HH:mm');
}
