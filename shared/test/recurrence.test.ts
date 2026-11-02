import { describe, expect, it } from 'vitest';
import { addDays, addMonths, nextOccurrence } from '../src';

describe('calendar math', () => {
  it('adds days across month/year boundaries and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // US DST ends Nov 1
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps month addition to the last day of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // leap year
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});

describe('nextOccurrence', () => {
  const today = '2026-11-04'; // a Wednesday

  it('returns null for non-recurring tasks', () => {
    expect(nextOccurrence('2026-11-04', 'none', today)).toBeNull();
  });

  it('daily / weekly / monthly step from the due date', () => {
    expect(nextOccurrence('2026-11-04', 'daily', today)).toBe('2026-11-05');
    expect(nextOccurrence('2026-11-04', 'weekly', today)).toBe('2026-11-11');
    expect(nextOccurrence('2026-11-04', 'monthly', today)).toBe('2026-12-04');
  });

  it('weekdays skips Saturday and Sunday', () => {
    expect(nextOccurrence('2026-11-06', 'weekdays', '2026-11-06')).toBe('2026-11-09'); // Fri -> Mon
  });

  it('anchors on the due date when completed early (no drift)', () => {
    // Due Friday, done Wednesday -> next Friday, not next Wednesday.
    expect(nextOccurrence('2026-11-06', 'weekly', today)).toBe('2026-11-13');
  });

  it('skips past occurrences when completed late, keeping the weekday', () => {
    expect(nextOccurrence('2026-10-30', 'daily', today)).toBe(today);
    expect(nextOccurrence('2026-10-19', 'weekly', today)).toBe('2026-11-09'); // Mondays
  });

  it('anchors on today when there is no due date', () => {
    expect(nextOccurrence(null, 'daily', today)).toBe('2026-11-05');
  });
});
