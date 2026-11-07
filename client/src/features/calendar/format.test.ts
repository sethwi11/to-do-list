import { describe, expect, it } from 'vitest';
import type { Clash } from '@todo/shared';
import { describeConflicts, describeRepeat, formatClockShort, formatEventTimeOnDay, formatTimeRange, formatWhen } from './format';

describe('formatTimeRange', () => {
  it('shares the AM/PM when both ends have it', () => {
    expect(formatTimeRange('10:00', '11:15')).toMatch(/^10:00 – 11:15 AM$/);
    expect(formatTimeRange('11:00', '13:00')).toMatch(/^11:00 AM – 1:00 PM$/);
  });
});

describe('formatWhen', () => {
  it('describes timed, all-day, multi-day and overnight events', () => {
    expect(formatWhen('2026-11-04T10:00', '2026-11-04T11:15', false)).toBe('Wed, Nov 4 · 10:00 – 11:15 AM');
    expect(formatWhen('2026-11-04T00:00', '2026-11-05T00:00', true)).toBe('Wed, Nov 4 · All day');
    expect(formatWhen('2026-11-04T00:00', '2026-11-07T00:00', true)).toBe('Wed, Nov 4 – Fri, Nov 6 · All day');
    expect(formatWhen('2026-11-04T22:00', '2026-11-05T01:00', false)).toBe('Wed, Nov 4, 10:00 PM – Thu, Nov 5, 1:00 AM');
  });
});

describe('describeRepeat', () => {
  it('names the rule', () => {
    const rule = { byWeekday: null, until: null, exdates: [] };
    expect(describeRepeat({ ...rule, freq: 'daily' })).toBe('Every day');
    expect(describeRepeat({ ...rule, freq: 'weekly', byWeekday: [1, 3], until: '2026-12-01' })).toBe('Every week on Mon, Wed, until Dec 1');
    expect(describeRepeat({ ...rule, freq: 'weekdays' })).toBe('Every weekday');
  });
});

describe('formatClockShort', () => {
  it('abbreviates', () => {
    expect(formatClockShort('09:00')).toBe('9a');
    expect(formatClockShort('14:30')).toBe('2:30p');
    expect(formatClockShort('00:15')).toBe('12:15a');
    expect(formatClockShort('12:00')).toBe('12p');
  });
});

const occ = (title: string): Clash => ({ key: title, title, start: '', end: '', kind: 'event' });
const block = (title: string): Clash => ({ key: `block:${title}`, title, start: '', end: '', kind: 'block' });

describe('describeConflicts', () => {
  it('names one, two, or many', () => {
    expect(describeConflicts([])).toBe('');
    expect(describeConflicts([occ('A')])).toBe('Overlaps with “A”');
    expect(describeConflicts([occ('A'), occ('B')])).toBe('Overlaps with “A” and “B”');
    expect(describeConflicts([occ('A'), occ('B'), occ('C'), occ('D')])).toBe('Overlaps with “A” and 3 more');
  });

  it('says when it is time set aside for a to-do that overlaps', () => {
    expect(describeConflicts([block('Lab report')])).toBe('Overlaps with time for “Lab report”');
    expect(describeConflicts([occ('Standup'), block('Lab report')])).toBe('Overlaps with “Standup” and time for “Lab report”');
  });
});

describe('formatEventTimeOnDay', () => {
  it('shows hours, all day, and how an overnight event continues', () => {
    expect(formatEventTimeOnDay('2026-11-04T10:00', '2026-11-04T11:15', false, '2026-11-04')).toBe('10:00 – 11:15 AM');
    expect(formatEventTimeOnDay('2026-11-04T00:00', '2026-11-05T00:00', true, '2026-11-04')).toBe('All day');
    expect(formatEventTimeOnDay('2026-11-04T22:00', '2026-11-05T01:00', false, '2026-11-04')).toBe('10:00 PM →');
    expect(formatEventTimeOnDay('2026-11-04T22:00', '2026-11-05T01:00', false, '2026-11-05')).toBe('until 1:00 AM');
  });
});
