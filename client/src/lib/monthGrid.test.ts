import { describe, expect, it } from 'vitest';
import { monthGrid, shiftMonth } from './monthGrid';

describe('monthGrid', () => {
  it('pads to whole weeks, Sunday first', () => {
    const cells = monthGrid(2026, 11); // Nov 1, 2026 is a Sunday
    expect(cells[0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(cells.length % 7).toBe(0);
    expect(cells.at(-1)!.date >= '2026-11-30').toBe(true);
  });

  it('includes trailing days of the previous month when the 1st is mid-week', () => {
    const cells = monthGrid(2026, 10); // Oct 1, 2026 is a Thursday
    expect(cells.slice(0, 4).map((c) => c.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
    expect(cells.slice(0, 4).every((c) => !c.inMonth)).toBe(true);
    expect(cells[4]).toMatchObject({ date: '2026-10-01', inMonth: true });
  });

  it('has four, five, or six weeks as the month needs', () => {
    expect(monthGrid(2026, 2).length).toBe(28); // Feb 2026 starts on a Sunday and has 28 days
    expect(monthGrid(2026, 10).length).toBe(35);
    expect(monthGrid(2026, 8).length).toBe(42); // Aug 2026 starts on a Saturday and has 31 days
  });

  it('marks exactly the days of the month as in-month', () => {
    expect(monthGrid(2028, 2).filter((c) => c.inMonth)).toHaveLength(29); // leap year
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries in both directions', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 11, 0)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth(2026, 6, 18)).toEqual({ year: 2027, month: 12 });
  });
});
