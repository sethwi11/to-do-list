import { describe, expect, it } from 'vitest';
import { fromRepeatFields, fromTimeFields, normalizeLink, sameRepeat, timeProblem, toRepeatFields, toTimeFields, withNewStart } from './eventForm';

describe('time fields', () => {
  it('shows an all-day event\'s last day, and stores the exclusive end', () => {
    // Stored: Nov 4 through Nov 5, as 00:00 on Nov 4 up to 00:00 on Nov 6
    const f = toTimeFields('2026-11-04T00:00', '2026-11-06T00:00', true);
    expect(f.startDate).toBe('2026-11-04');
    expect(f.endDate).toBe('2026-11-05');
    expect(fromTimeFields(f)).toEqual({ start: '2026-11-04T00:00', end: '2026-11-06T00:00' });
  });

  it('round-trips a timed event', () => {
    const f = toTimeFields('2026-11-04T10:00', '2026-11-04T11:15', false);
    expect(fromTimeFields(f)).toEqual({ start: '2026-11-04T10:00', end: '2026-11-04T11:15' });
  });

  it('moves the end along with the start, keeping the length', () => {
    const f = toTimeFields('2026-11-04T10:00', '2026-11-04T11:30', false);
    const moved = withNewStart(f, '2026-11-05', '23:30');
    expect(fromTimeFields(moved)).toEqual({ start: '2026-11-05T23:30', end: '2026-11-06T01:00' });
  });

  it('moves a multi-day all-day event by whole days', () => {
    const f = toTimeFields('2026-11-04T00:00', '2026-11-06T00:00', true);
    expect(withNewStart(f, '2026-11-10', '09:00').endDate).toBe('2026-11-11');
  });

  it('flags an end that is not after the start', () => {
    expect(timeProblem(toTimeFields('2026-11-04T10:00', '2026-11-04T11:00', false))).toBeNull();
    expect(timeProblem({ ...toTimeFields('2026-11-04T10:00', '2026-11-04T11:00', false), endTime: '09:00' })).toMatch(/end must be after/);
    expect(timeProblem({ ...toTimeFields('2026-11-04T00:00', '2026-11-05T00:00', true), endDate: '2026-11-03' })).toMatch(/last day/);
  });
});

describe('repeat fields', () => {
  it('stores a weekly repeat on the start day without a weekday list, and keeps removed dates', () => {
    const f = { repeat: 'weekly' as const, weekdays: [3], until: '' }; // 2026-11-04 is a Wednesday
    expect(fromRepeatFields(f, '2026-11-04', ['2026-11-11'])).toEqual({ freq: 'weekly', byWeekday: null, until: null, exdates: ['2026-11-11'] });
  });

  it('stores chosen weekdays sorted', () => {
    expect(fromRepeatFields({ repeat: 'weekly', weekdays: [5, 1, 3], until: '2026-12-01' }, '2026-11-04')).toMatchObject({ byWeekday: [1, 3, 5], until: '2026-12-01' });
  });

  it('"never" is no rule, and a rule round-trips', () => {
    expect(fromRepeatFields({ repeat: 'none', weekdays: [], until: '' }, '2026-11-04')).toBeNull();
    const rule = { freq: 'weekly' as const, byWeekday: [1, 3], until: null, exdates: [] };
    expect(fromRepeatFields(toRepeatFields(rule, '2026-11-02'), '2026-11-02')).toEqual(rule);
  });

  it('notices whether the repeat was changed', () => {
    const a = toRepeatFields({ freq: 'daily', byWeekday: null, until: null, exdates: ['2026-11-05'] }, '2026-11-02');
    expect(sameRepeat(a, { ...a }, '2026-11-02')).toBe(true);
    expect(sameRepeat(a, { ...a, repeat: 'weekdays' }, '2026-11-02')).toBe(false);
  });
});

describe('normalizeLink', () => {
  it('accepts web links and adds https:// when missing', () => {
    expect(normalizeLink('https://zoom.us/j/1')).toEqual(['https://zoom.us/j/1', null]);
    expect(normalizeLink('zoom.us/j/1')[0]).toBe('https://zoom.us/j/1');
    expect(normalizeLink('  ')).toEqual([null, null]);
  });

  it('rejects links that could run code', () => {
    expect(normalizeLink('javascript:alert(1)')[1]).toMatch(/web link/);
    expect(normalizeLink('data:text/html,hi')[1]).toMatch(/web link/);
  });
});
