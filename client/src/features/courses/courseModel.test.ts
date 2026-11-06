import type { Semester } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { currentSemester, describeMeetingDays, suggestSemester, thanksgivingBreak } from './courseModel';

const sem = (id: string, start: string, end: string, archived = false): Semester => ({ id, name: id, startDate: start, endDate: end, excludedRanges: [], archived, createdAt: '' });

describe('describeMeetingDays', () => {
  it('lists days, and collapses the five weekdays', () => {
    expect(describeMeetingDays([5, 1, 3])).toBe('Mon, Wed, Fri');
    expect(describeMeetingDays([2, 4])).toBe('Tue, Thu');
    expect(describeMeetingDays([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(describeMeetingDays([6])).toBe('Sat');
  });
});

describe('currentSemester', () => {
  const fall = sem('fall', '2026-08-24', '2026-12-11');
  const spring = sem('spring', '2027-01-12', '2027-05-08');
  const last = sem('last', '2026-01-12', '2026-05-08');

  it('picks the one you are in', () => {
    expect(currentSemester([last, fall, spring], '2026-10-01')).toBe(fall);
  });
  it('between semesters, picks the next one to start', () => {
    expect(currentSemester([last, fall, spring], '2026-12-25')).toBe(spring);
  });
  it('after everything, picks the latest', () => {
    expect(currentSemester([last, fall], '2027-06-01')).toBe(fall);
  });
  it('never picks an archived one for you', () => {
    expect(currentSemester([sem('old', '2026-08-24', '2026-12-11', true)], '2026-10-01')).toBeUndefined();
    expect(currentSemester([sem('old', '2026-08-24', '2026-12-11', true), last], '2026-10-01')).toBe(last);
  });
  it('is undefined with none', () => {
    expect(currentSemester([], '2026-10-01')).toBeUndefined();
  });
});

describe('suggestSemester', () => {
  it('suggests the usual dates for the time of year', () => {
    expect(suggestSemester('2026-11-06')).toEqual({ name: 'Fall 2026', startDate: '2026-08-24', endDate: '2026-12-11' });
    expect(suggestSemester('2027-02-01').name).toBe('Spring 2027');
    expect(suggestSemester('2027-06-15').name).toBe('Summer 2027');
  });
});

describe('thanksgivingBreak', () => {
  it('is Thursday to Sunday of the 4th week of November', () => {
    expect(thanksgivingBreak(2026)).toEqual({ start: '2026-11-26', end: '2026-11-29', label: 'Thanksgiving' });
    expect(thanksgivingBreak(2027).start).toBe('2027-11-25');
    expect(thanksgivingBreak(2025).start).toBe('2025-11-27');
  });
});
