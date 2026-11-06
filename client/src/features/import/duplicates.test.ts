import { buildEvent } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { buildBlank } from '../calendar/testHelpers';
import { findDuplicate, titlesAlike } from './duplicates';

describe('titlesAlike', () => {
  it('matches the same thing worded a little differently', () => {
    expect(titlesAlike('Midterm exam', 'midterm exam!')).toBe(true);
    expect(titlesAlike('Midterm', 'Midterm exam in class')).toBe(true);
    expect(titlesAlike('Interview with Acme Corp', 'Acme Corp interview')).toBe(true);
    expect(titlesAlike('Problem Set 5', 'Problem set 5 due')).toBe(true);
  });
  it('does not match different things', () => {
    expect(titlesAlike('Midterm exam', 'Career fair')).toBe(false);
    expect(titlesAlike('Quiz 1', 'Quiz 2')).toBe(false);
    expect(titlesAlike('', 'Anything')).toBe(false);
  });
});

describe('findDuplicate', () => {
  const events = [buildEvent({ title: 'Midterm exam', start: '2026-11-03T10:00', end: '2026-11-03T11:30' }, 'e1', '2026-11-01T00:00:00.000Z')];
  const tasks = [buildBlank('Submit project proposal', '2026-11-24')];

  it('finds a similar event on the same day', () => {
    expect(findDuplicate({ title: 'Midterm', start: '2026-11-03T00:00', end: '2026-11-04T00:00' }, events, tasks)).toBe('Midterm exam');
  });
  it('finds a similar to-do due that day', () => {
    expect(findDuplicate({ title: 'Project proposal', start: '2026-11-24T00:00', end: '2026-11-25T00:00' }, events, tasks)).toBe('Submit project proposal');
  });
  it('ignores a similar title on another day', () => {
    expect(findDuplicate({ title: 'Midterm', start: '2026-11-10T00:00', end: '2026-11-11T00:00' }, events, tasks)).toBeNull();
  });
  it('ignores a different title on the same day', () => {
    expect(findDuplicate({ title: 'Career fair', start: '2026-11-03T00:00', end: '2026-11-04T00:00' }, events, tasks)).toBeNull();
  });
});
