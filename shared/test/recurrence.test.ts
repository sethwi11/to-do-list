import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isOverdue, nextOccurrence, rollDeadline, rollTarget, stepRecurrence } from '../src';

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

describe('rolling repeating tasks', () => {
  const base = { status: 'todo' as const, dueDate: '2026-11-04', recurrence: 'weekly' as const, rollsOver: true, repeatDays: [] as number[], missedAt: null };

  it('are never overdue, unlike a one-off or a repeating task with rolling turned off', () => {
    expect(isOverdue(base, '2026-11-08')).toBe(false);
    expect(isOverdue({ ...base, rollsOver: false }, '2026-11-08')).toBe(true);
    expect(isOverdue({ ...base, recurrence: 'none' }, '2026-11-08')).toBe(true);
    expect(isOverdue(base, '2026-11-04')).toBe(false);
  });

  it('stay current until the day before the next occurrence, then are replaced by it', () => {
    expect(rollDeadline(base)).toBe('2026-11-10');
    expect(rollTarget(base, '2026-11-10')).toBeNull();
    expect(rollTarget(base, '2026-11-11')).toBe('2026-11-11');
  });

  it('catch up to the current occurrence after several weeks away', () => {
    expect(rollTarget(base, '2026-11-26')).toBe('2026-11-25');
  });

  it('ignore finished, missed and non-rolling tasks', () => {
    expect(rollTarget({ ...base, status: 'done' }, '2026-11-26')).toBeNull();
    expect(rollTarget({ ...base, missedAt: '2026-11-11T00:00:00.000Z' }, '2026-11-26')).toBeNull();
    expect(rollTarget({ ...base, rollsOver: false }, '2026-11-26')).toBeNull();
  });

  it('can repeat on chosen weekdays', () => {
    expect(stepRecurrence('2026-11-04', 'weekly', [1, 3])).toBe('2026-11-09'); // Wed -> Mon
    expect(stepRecurrence('2026-11-09', 'weekly', [1, 3])).toBe('2026-11-11'); // Mon -> Wed
    expect(nextOccurrence('2026-11-04', 'weekly', '2026-11-20', [3])).toBe('2026-11-25');
  });
});
