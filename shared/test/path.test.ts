import { describe, expect, it } from 'vitest';
import { addDays, countdown, DEFAULT_SETTINGS, earnedBadges, isStageUnlocked, mergeSettings, northStarDates, stageTwoDate, streakMilestones, type BadgeInputs, type CheckIn, type MoneyMove, type MoveTarget, type Milestone, type SavingsGoal } from '../src';
import { NOW, checkIn, gymBlocks, id, sentOn, source } from './week';

describe('the Stage 2 lock', () => {
  // A made-up birthday: Stage 2 opens on the 20th.
  const BIRTHDAY = '2005-03-10';
  it('is locked the day before the 20th birthday and open on it', () => {
    expect(stageTwoDate(BIRTHDAY)).toBe('2025-03-10');
    expect(isStageUnlocked(BIRTHDAY, '2025-03-09')).toBe(false);
    expect(isStageUnlocked(BIRTHDAY, '2025-03-10')).toBe(true);
    expect(isStageUnlocked(BIRTHDAY, '2031-01-01')).toBe(true);
  });
  it('stays locked until a birthday is set', () => {
    expect(isStageUnlocked(null, '2099-01-01')).toBe(false);
    expect(stageTwoDate(null)).toBeNull();
  });
  it('treats a Feb 29 birthday as Feb 28 in years without one', () => {
    expect(stageTwoDate('2004-02-29')).toBe('2024-02-29');
    expect(stageTwoDate('2005-02-28')).toBe('2025-02-28');
    expect(northStarDates({ birthday: '2004-02-29', northStar: [{ text: 'Goal', age: 21 }], stage2Notes: '' })[0]!.date).toBe('2025-02-28');
  });
  it('computes each north-star date from the birthday', () => {
    const path = { birthday: BIRTHDAY, northStar: [{ text: 'First goal', age: 22 }, { text: 'Second goal', age: 28 }], stage2Notes: '' };
    expect(northStarDates(path).map((n) => n.date)).toEqual(['2027-03-10', '2033-03-10']);
    expect(northStarDates({ ...path, birthday: null }).map((n) => n.date)).toEqual([null, null]);
  });
  it('merges a partial path over the stored one', () => {
    const base = mergeSettings(DEFAULT_SETTINGS, { path: { birthday: BIRTHDAY, northStar: [], stage2Notes: '' } });
    expect(mergeSettings(base, { path: { stage2Notes: 'later' } }).path).toEqual({ birthday: BIRTHDAY, northStar: [], stage2Notes: 'later' });
  });
});

describe('countdown', () => {
  it('says days when close, months when further, and years and months beyond two years', () => {
    expect([-3, 0, 1, 99].map(countdown)).toEqual(['0 days', '0 days', '1 day', '99 days']);
    expect([100, 365, 700].map(countdown)).toEqual(['3 months', '12 months', '23 months']);
    expect([730, 1_461, 1_826].map(countdown)).toEqual(['2 years', '4 years', '5 years']);
    expect(countdown(1_000 + 300)).toBe('3 years, 7 months');
  });
});

describe('badges', () => {
  const src = source(gymBlocks); // gym Monday to Saturday
  const gym = (date: string, status: CheckIn['status'] = 'done') => checkIn(src, date, 'Gym', status);
  const inputs = (over: Partial<BadgeInputs> = {}): BadgeInputs => ({ src, checkIns: [], focusDates: new Set(), applications: [], goals: [], moves: [], milestones: [], birthday: null, today: '2026-11-10', ...over });
  const keys = (inp: BadgeInputs) => earnedBadges(inp).map((b) => b.key);
  const dateOf = (inp: BadgeInputs, key: string) => earnedBadges(inp).find((b) => b.key === key)?.earnedOn;

  it('earns nothing from empty data (opening the app is not an achievement)', () => {
    expect(earnedBadges(inputs())).toEqual([]);
  });

  it('awards a streak on the day it reached 7, carrying across the Sunday with no gym, and not before', () => {
    const six = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => gym(d));
    expect(keys(inputs({ checkIns: six }))).not.toContain('streak:gym:7');
    const seven = [...six, gym('2026-11-09')]; // Mon 9 is the 7th; today (Tue 10) isn't done yet, which doesn't break it
    expect(dateOf(inputs({ checkIns: seven }), 'streak:gym:7')).toBe('2026-11-09');
    expect(streakMilestones(src, seven, new Set(), '2026-11-10').find((m) => m.id === 'gym' && m.days === 7)?.on).toBe('2026-11-09');
  });
  it('a skipped day restarts the count, but a badge already earned is not given twice', () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09'];
    const broken = [...days.map((d) => gym(d)), gym('2026-11-11', 'skipped'), ...['2026-11-12', '2026-11-13'].map((d) => gym(d))];
    expect(keys(inputs({ checkIns: broken, today: '2026-11-13' })).filter((k) => k === 'streak:gym:7')).toHaveLength(1);
  });

  it('awards the first fully checked-in week on its Sunday, only once every planned item has a check-in', () => {
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => gym(d));
    expect(dateOf(inputs({ checkIns: week, today: '2026-11-08' }), 'week:first')).toBe('2026-11-08');
    expect(keys(inputs({ checkIns: week.slice(1), today: '2026-11-08' }))).not.toContain('week:first'); // Monday missing
    expect(keys(inputs({ checkIns: week, today: '2026-11-07' }))).not.toContain('week:first'); // the week isn't over
  });

  it('awards every 25th LeetCode session and every 10th application, on the day of that one', () => {
    const lc = Array.from({ length: 51 }, (_, i) => ({ ...gym('2026-11-02'), id: id(), title: 'LeetCode', date: addDays('2026-09-20', i) }));
    const first25 = addDays('2026-09-20', 24);
    const found = earnedBadges(inputs({ checkIns: lc }));
    expect(found.find((b) => b.key === 'leetcode:25')?.earnedOn).toBe(first25);
    expect(found.find((b) => b.key === 'leetcode:50')).toBeDefined();
    expect(found.find((b) => b.key === 'leetcode:75')).toBeUndefined();

    const apps = Array.from({ length: 12 }, (_, i) => sentOn(`2026-11-${String(i + 1).padStart(2, '0')}`));
    expect(dateOf(inputs({ applications: apps }), 'applications:10')).toBe('2026-11-10');
    expect(keys(inputs({ applications: apps.slice(0, 9) }))).not.toContain('applications:10');
  });

  it('awards each quarter of a savings goal on the day the money that crossed it went in', () => {
    const goal: SavingsGoal = { id: id(), name: 'Emergency fund', targetCents: 10000, sortOrder: 1, createdAt: NOW, updatedAt: NOW };
    const move = (date: string, amountCents: number, toId: string | null = goal.id, toType: MoveTarget = 'goal'): MoneyMove => ({ id: id(), date, periodStart: null, toType, toId, amountCents, note: null, createdAt: NOW });
    const moves = [move('2026-11-02', 2500), move('2026-11-04', 2500), move('2026-11-06', 5000), move('2026-11-07', 9999, goal.id, 'holding'), move('2026-11-07', 9999, id())];
    const got = Object.fromEntries(earnedBadges(inputs({ goals: [goal], moves })).filter((b) => b.key.startsWith('goal:')).map((b) => [b.key.split(':')[2], b.earnedOn]));
    expect(got).toEqual({ '25': '2026-11-02', '50': '2026-11-04', '75': '2026-11-06', '100': '2026-11-06' });
  });

  it('awards a milestone only once it is marked reached, and Stage 2 on its unlock day', () => {
    const m = (reachedOn: string | null): Milestone => ({ id: id(), title: 'Finish the book', targetDate: null, reachedOn, calendarIds: [], savingsGoalId: null, trackOffers: false, sortOrder: 1, createdAt: NOW, updatedAt: NOW });
    expect(keys(inputs({ milestones: [m(null)] }))).toEqual([]);
    expect(earnedBadges(inputs({ milestones: [m('2026-11-08')] }))[0]).toMatchObject({ title: 'Milestone reached: Finish the book', earnedOn: '2026-11-08' });
    expect(earnedBadges(inputs({ birthday: '2006-11-10', today: '2026-11-10' }))).toEqual([{ key: 'stage:2', title: 'Stage 2 unlocked', earnedOn: '2026-11-10' }]);
    expect(keys(inputs({ birthday: '2006-11-11', today: '2026-11-10' }))).toEqual([]);
  });
});
