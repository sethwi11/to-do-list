import { describe, expect, it } from 'vitest';
import { buildEvent, conflictMap, expandOccurrences, findConflicts, selfIds, type Event } from '../src';

const NOW = '2026-11-04T12:00:00.000Z';
let n = 0;
const ev = (title: string, start: string, end: string, extra: Partial<Event> = {}): Event =>
  buildEvent({ title, start, end, ...extra }, extra.id ?? `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, NOW);

const span = (start: string, end: string, allDay = false) => ({ start, end, allDay });
const titles = (list: { event: Event }[]) => list.map((o) => o.event.title);

describe('findConflicts', () => {
  const events = [ev('Class', '2026-11-04T10:00', '2026-11-04T11:00'), ev('Lab', '2026-11-04T14:00', '2026-11-04T16:00')];

  it('finds timed events that overlap the span', () => {
    expect(titles(findConflicts(events, span('2026-11-04T10:30', '2026-11-04T11:30')))).toEqual(['Class']);
    expect(titles(findConflicts(events, span('2026-11-04T09:00', '2026-11-04T17:00')))).toEqual(['Class', 'Lab']);
    expect(findConflicts(events, span('2026-11-04T12:00', '2026-11-04T13:00'))).toEqual([]);
  });

  it('does not count events that merely touch', () => {
    expect(findConflicts(events, span('2026-11-04T11:00', '2026-11-04T12:00'))).toEqual([]);
    expect(findConflicts(events, span('2026-11-04T09:00', '2026-11-04T10:00'))).toEqual([]);
  });

  it('catches an overlap across midnight', () => {
    const late = [ev('Party', '2026-11-04T22:00', '2026-11-05T01:00')];
    expect(titles(findConflicts(late, span('2026-11-05T00:30', '2026-11-05T02:00')))).toEqual(['Party']);
  });

  it('never involves all-day events, on either side', () => {
    const withAllDay = [...events, ev('Career fair', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true })];
    expect(titles(findConflicts(withAllDay, span('2026-11-04T10:30', '2026-11-04T11:30')))).toEqual(['Class']);
    expect(findConflicts(events, span('2026-11-04T00:00', '2026-11-05T00:00', true))).toEqual([]);
  });

  it('sees dates of a repeating event', () => {
    const series = ev('Daily standup', '2026-11-02T09:30', '2026-11-02T10:15', { recurrence: { freq: 'daily', byWeekday: null, until: null, exdates: [] } });
    expect(titles(findConflicts([series], span('2026-11-04T10:00', '2026-11-04T11:00')))).toEqual(['Daily standup']);
    expect(findConflicts([series], span('2026-11-04T10:15', '2026-11-04T11:00'))).toEqual([]);
  });

  it('can leave out an event (and its series) so it does not conflict with itself', () => {
    const series = ev('Class', '2026-11-02T10:00', '2026-11-02T11:00', { recurrence: { freq: 'daily', byWeekday: null, until: null, exdates: [] } });
    const other = ev('Other', '2026-11-04T10:30', '2026-11-04T11:30');
    const occ = expandOccurrences([series, other], '2026-11-04', '2026-11-05').find((o) => o.event.title === 'Class')!;
    expect(titles(findConflicts([series, other], span(occ.start, occ.end), selfIds(occ)))).toEqual(['Other']);
    expect(titles(findConflicts([series, other], span(occ.start, occ.end)))).toEqual(['Class', 'Other']);
  });

  it('ignores a nonsense span', () => {
    expect(findConflicts(events, span('2026-11-04T11:00', '2026-11-04T10:00'))).toEqual([]);
  });
});

describe('conflictMap', () => {
  it('lists, for each overlapping event, the events it overlaps', () => {
    const list = expandOccurrences(
      [
        ev('A', '2026-11-04T10:00', '2026-11-04T11:00'),
        ev('B', '2026-11-04T10:30', '2026-11-04T11:30'),
        ev('C', '2026-11-04T11:30', '2026-11-04T12:00'),
        ev('D', '2026-11-04T15:00', '2026-11-04T16:00'),
        ev('All day', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true }),
      ],
      '2026-11-04',
      '2026-11-05',
    );
    const map = conflictMap(list);
    const name = (key: string) => list.find((o) => o.key === key)!.event.title;
    expect([...map.entries()].map(([k, v]) => `${name(k)}: ${titles(v).join(',')}`).sort()).toEqual(['A: B', 'B: A']);
  });
});
