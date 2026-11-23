import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);

export { dayjs };

export const TIME_FORMAT = 'HH:mm';

/** "09:30" -> 570 minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const isValidTime = (time: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** Date-only value (midnight UTC) for MySQL DATE columns. */
export function toDateOnly(value: string | Date): Date {
  return dayjs.utc(dayjs(value).format('YYYY-MM-DD')).toDate();
}

export const startOfDay = (value: string | Date = new Date()): Date =>
  dayjs(value).startOf('day').toDate();

export const endOfDay = (value: string | Date = new Date()): Date =>
  dayjs(value).endOf('day').toDate();

export const addDays = (days: number, from: string | Date = new Date()): Date =>
  dayjs(from).add(days, 'day').toDate();

export const daysUntil = (date: string | Date): number =>
  dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day');

/** 0 = Sunday .. 6 = Saturday, matching store_business_hours.dayOfWeek. */
export const dayOfWeek = (date: string | Date): number => dayjs(date).day();

export function buildSlots(
  openTime: string,
  closeTime: string,
  durationMins: number,
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  if (durationMins <= 0 || close <= open) return slots;

  for (let start = open; start + durationMins <= close; start += durationMins) {
    slots.push({ startTime: minutesToTime(start), endTime: minutesToTime(start + durationMins) });
  }
  return slots;
}
