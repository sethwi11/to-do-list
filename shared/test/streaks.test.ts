import { describe, expect, it } from 'vitest';
import { isMilestone, streakLength, streaksFor, type CheckIn, type PlanSources, type RoutineBlock, type WeekTemplate } from '../src';

const day = (date: string, planned: boolean, done: boolean) => ({ date, planned, done });

describe('streak math', () => {
  it('counts days done in a row, back from today', () => {
    expect(streakLength([day('a', true, false), day('b', true, true), day('c', true, true)])).toBe(2);
  });
  it('a day with nothing planned (a rest day) neither counts nor breaks it', () => {
    expect(streakLength([day('mon', true, true), day('sun', false, false), day('tue', true, true)])).toBe(2);
  });
  it('today not done yet is still in progress; yesterday not done breaks it', () => {
    expect(streakLength([day('a', true, true), day('b', true, true), day('today', true, false)])).toBe(2);
    expect(streakLength([day('a', true, true), day('b', true, false), day('today', true, true)])).toBe(1);
  });
  it('celebrates at 7, 14, 30, 50, 100, then every 100', () => {
    expect([6, 7, 14, 21, 30, 50, 99, 100, 150, 200, 300].map(isMilestone)).toEqual([false, true, true, false, true, true, false, true, false, true, true]);
  });
});

describe('streaks from the plan, check-ins and focus sessions', () => {
  const NOW = '2026-01-01T00:00:00.000Z';
  const t: WeekTemplate = { id: '00000000-0000-4000-8000-000000000001', name: 'W', effectiveFrom: '2026-11-01', effectiveTo: null, days: [], meetingWindows: [], createdAt: NOW, updatedAt: NOW };
  // Gym every weekday but Sunday (0), a focus block every day.
  const blocks: RoutineBlock[] = [1, 2, 3, 4, 5, 6].map((weekday, i) => ({
    id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, templateId: t.id, weekday, start: '07:00', end: '08:00', title: 'Gym', calendarId: null, altTitle: null, altCalendarId: null,
    priority: 'normal', focus: false, soundtrack: null, notify: true, schoolDaysOnly: false, reschedulable: false, notes: null, createdAt: NOW, updatedAt: NOW,
  }));
  const src: PlanSources = { templates: [t], blocks, semesters: [], events: [], timeBlocks: [], tasks: [], calendars: [], overrides: [] };
  const gym = (date: string, status: CheckIn['status'] = 'done'): CheckIn => ({ id: `00000000-0000-4000-8000-${date.replace(/-/g, '').padStart(12, '0')}`, date, itemKey: 'g', title: 'Gym', calendarId: null, minutes: 60, status, usedAlt: false, learned: null, createdAt: NOW, updatedAt: NOW });

  it('carries the gym streak across Sunday, and counts nightly check-ins and focus days', () => {
    // Thu 5, Fri 6, Sat 7 done; Sun 8 has no gym; Mon 9 done; today Tue 10 not yet.
    const checkIns = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09'].map((d) => gym(d));
    const streaks = streaksFor(src, checkIns, new Set(['2026-11-09', '2026-11-10']), '2026-11-10', 10);
    expect(streaks.find((s) => s.id === 'gym')?.days).toBe(4);
    expect(streaks.find((s) => s.id === 'focus')?.days).toBe(0); // no focus blocks planned: nothing to count
    expect(streaks.find((s) => s.id === 'checkin')?.days).toBe(4); // Sunday had nothing planned, so it doesn't break it; Wed 4 had no check-in
  });

  it('a skipped gym breaks it', () => {
    const checkIns = [gym('2026-11-06'), gym('2026-11-07', 'skipped'), gym('2026-11-09')];
    expect(streaksFor(src, checkIns, new Set(), '2026-11-09', 10).find((s) => s.id === 'gym')?.days).toBe(1);
  });
});
