import { describe, expect, it } from 'vitest';
import { buildSlots, dayOfWeek, isValidTime, minutesToTime, timeToMinutes } from '../../src/utils/time';

describe('time helpers', () => {
  it('converts between HH:mm and minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('wraps minutes outside a day', () => {
    expect(minutesToTime(1440)).toBe('00:00');
    expect(minutesToTime(-60)).toBe('23:00');
  });

  it('validates 24-hour times', () => {
    expect(isValidTime('09:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('09:60')).toBe(false);
  });

  it('uses Sunday = 0 to match store_business_hours', () => {
    expect(dayOfWeek('2026-09-13')).toBe(0); // Sunday
    expect(dayOfWeek('2026-09-14')).toBe(1); // Monday
  });
});

describe('buildSlots', () => {
  it('divides the opening window into equal slots', () => {
    const slots = buildSlots('09:00', '11:00', 30);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30' });
    expect(slots[3]).toEqual({ startTime: '10:30', endTime: '11:00' });
  });

  it('never creates a slot that runs past closing time', () => {
    const slots = buildSlots('09:00', '10:15', 30);
    expect(slots).toHaveLength(2);
    expect(slots.at(-1)?.endTime).toBe('10:00');
  });

  it('returns nothing for an invalid window', () => {
    expect(buildSlots('18:00', '09:00', 30)).toEqual([]);
    expect(buildSlots('09:00', '17:00', 0)).toEqual([]);
  });

  it('covers a full trading day', () => {
    expect(buildSlots('09:00', '22:00', 30)).toHaveLength(26);
  });
});
