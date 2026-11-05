import { describe, expect, it } from 'vitest';
import { parseTasksQuery, tasksUrl } from './taskParams';

const parse = (qs: string) => parseTasksQuery(new URLSearchParams(qs));

describe('Tasks page URL', () => {
  it('defaults to the All tab with no filters', () => {
    expect(parse('')).toEqual({ tab: 'all', calendarId: null, date: null });
  });

  it('reads tab, calendar, and date', () => {
    expect(parse('view=overdue&calendar=abc&date=2026-11-10')).toEqual({ tab: 'overdue', calendarId: 'abc', date: '2026-11-10' });
  });

  it('ignores malformed values instead of breaking', () => {
    expect(parse('view=nonsense&date=tomorrow')).toEqual({ tab: 'all', calendarId: null, date: null });
    expect(parse('date=2026-02-30').date).toBeNull(); // not a real date
  });

  it('builds URLs, leaving defaults out, and round-trips', () => {
    expect(tasksUrl()).toBe('/tasks');
    expect(tasksUrl({ tab: 'all' })).toBe('/tasks');
    expect(tasksUrl({ tab: 'upcoming', calendarId: 'c1' })).toBe('/tasks?view=upcoming&calendar=c1');
    const q = { tab: 'completed', calendarId: 'c1', date: '2026-11-10' } as const;
    expect(parse(tasksUrl(q).split('?')[1]!)).toEqual(q);
  });
});
