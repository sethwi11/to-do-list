import type { Task } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';

// Local noon on a given day, as a UTC ISO string (safe from timezone edge cases).
const doneOn = (date: string): Task =>
  ({ status: 'done', completedAt: new Date(`${date}T12:00:00`).toISOString() }) as Task;

describe('computeStats', () => {
  const today = '2026-11-04';

  it('counts completions per local day for the last 7 days', () => {
    const stats = computeStats([doneOn('2026-11-04'), doneOn('2026-11-04'), doneOn('2026-11-01'), doneOn('2026-10-20')], today);
    expect(stats.week.map((d) => d.count)).toEqual([0, 0, 0, 1, 0, 0, 2]);
    expect(stats.week.at(-1)!.date).toBe(today);
    expect(stats.completedToday).toBe(2);
  });

  it('streak counts back from today, or from yesterday if nothing is done yet today', () => {
    expect(computeStats([doneOn('2026-11-04'), doneOn('2026-11-03'), doneOn('2026-11-02')], today).streak).toBe(3);
    expect(computeStats([doneOn('2026-11-03'), doneOn('2026-11-02')], today).streak).toBe(2);
    expect(computeStats([doneOn('2026-11-02')], today).streak).toBe(0);
  });

  it('ignores open tasks', () => {
    expect(computeStats([{ status: 'todo', completedAt: null } as Task], today).completedToday).toBe(0);
  });
});
