import { describe, expect, it } from 'vitest';
import { daysBetween, formatDueDate, parseLocalISODate, todayLocalISO } from './dates';

describe('local date helpers', () => {
  it('formats today using local date parts, not UTC', () => {
    // 11:30 PM local time must still be "today", even though UTC may already be tomorrow.
    expect(todayLocalISO(new Date(2026, 9, 21, 23, 30))).toBe('2026-10-21');
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalISODate('2026-10-24');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 24, 0]);
  });

  it('counts calendar days across a DST change and month boundaries', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2); // spans US DST end (Nov 1)
    expect(daysBetween('2026-10-21', '2026-10-20')).toBe(-1);
  });

  it('labels due dates relative to today', () => {
    const today = '2026-10-21'; // a Wednesday
    expect(formatDueDate('2026-10-21', today)).toBe('Today');
    expect(formatDueDate('2026-10-22', today)).toBe('Tomorrow');
    expect(formatDueDate('2026-10-20', today)).toBe('Yesterday');
    expect(formatDueDate('2026-10-23', today)).toMatch(/Friday/);
  });
});
