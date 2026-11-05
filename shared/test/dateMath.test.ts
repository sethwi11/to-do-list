import { describe, expect, it } from 'vitest';
import { lastDayOfMonth, weekdayName } from '../src';

describe('dateMath extras', () => {
  it('finds the last day of a month, including leap years', () => {
    expect(lastDayOfMonth('2026-11-10')).toBe('2026-11-30');
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(lastDayOfMonth('2026-12-31')).toBe('2026-12-31');
  });

  it('names weekdays', () => {
    expect(weekdayName('2026-11-04')).toBe('Wednesday');
  });
});
