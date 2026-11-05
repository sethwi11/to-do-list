import { describe, expect, it } from 'vitest';
import { isoWeekNumber, lastDayOfMonth, weekdayName } from '../src';

describe('dateMath extras', () => {
  it('finds the last day of a month, including leap years', () => {
    expect(lastDayOfMonth('2026-11-10')).toBe('2026-11-30');
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(lastDayOfMonth('2026-12-31')).toBe('2026-12-31');
  });

  it('names weekdays', () => {
    expect(weekdayName('2026-11-04')).toBe('Wednesday');
  });

  it('numbers ISO weeks, including the year-boundary cases', () => {
    expect(isoWeekNumber('2026-11-04')).toBe(45);
    expect(isoWeekNumber('2026-11-02')).toBe(45); // the Monday
    expect(isoWeekNumber('2026-11-08')).toBe(45); // the Sunday
    expect(isoWeekNumber('2026-01-01')).toBe(1); // a Thursday
    expect(isoWeekNumber('2025-12-29')).toBe(1); // Monday of 2026's week 1, still in 2025
    expect(isoWeekNumber('2027-01-01')).toBe(53); // 2026 has 53 weeks
    expect(isoWeekNumber('2024-12-30')).toBe(1); // belongs to 2025
  });
});
