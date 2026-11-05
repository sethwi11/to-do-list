import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  applyPlan,
  buildEvent,
  daysBetween,
  expandOccurrences,
  firstOccurrenceDate,
  invertPlan,
  minutesBetween,
  planEventDelete,
  planEventEdit,
  type EditScope,
  type Event,
  type EventOccurrence,
  type EventRecurrence,
} from '../src';

const NOW = '2026-11-04T12:00:00.000Z';
let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

function event(overrides: Partial<Event> & { title?: string } = {}): Event {
  return buildEvent({ title: 'Event', start: '2026-11-02T10:00', end: '2026-11-02T11:00', ...overrides }, overrides.id ?? newId(), NOW);
}

function rule(freq: EventRecurrence['freq'], extra: Partial<EventRecurrence> = {}): EventRecurrence {
  return { freq, byWeekday: null, until: null, exdates: [], ...extra };
}

/** Monday Nov 2, 2026, 10:00-11:15, repeating. */
function series(r: EventRecurrence, extra: Partial<Event> = {}): Event {
  return event({ id: 'series-1' as never, title: 'Class', start: '2026-11-02T10:00', end: '2026-11-02T11:15', recurrence: r, ...extra });
}

const dates = (events: Event[], from: string, to: string) => expandOccurrences(events, from, to).map((o) => o.start.slice(0, 10));

describe('date-time arithmetic', () => {
  it('adds minutes across midnight and ignores daylight saving', () => {
    expect(addMinutes('2026-11-01T01:30', 60)).toBe('2026-11-01T02:30'); // the day clocks fall back
    expect(addMinutes('2026-11-01T23:30', 60)).toBe('2026-11-02T00:30');
    expect(minutesBetween('2026-11-04T10:00', '2026-11-04T11:15')).toBe(75);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('expandOccurrences', () => {
  it('returns one-off events that overlap the range, and no others', () => {
    const events = [
      event({ title: 'before', start: '2026-11-01T09:00', end: '2026-11-01T10:00' }),
      event({ title: 'inside', start: '2026-11-03T09:00', end: '2026-11-03T10:00' }),
      event({ title: 'after', start: '2026-11-09T09:00', end: '2026-11-09T10:00' }),
      event({ title: 'spans in', start: '2026-10-31T22:00', end: '2026-11-02T08:00' }),
    ];
    expect(expandOccurrences(events, '2026-11-02', '2026-11-09').map((o) => o.event.title)).toEqual(['spans in', 'inside']);
  });

  it('treats the range end as exclusive', () => {
    const events = [event({ start: '2026-11-09T00:00', end: '2026-11-09T01:00' })];
    expect(expandOccurrences(events, '2026-11-02', '2026-11-09')).toHaveLength(0);
  });

  it('repeats daily, and keeps the time of day and the length', () => {
    const occ = expandOccurrences([series(rule('daily'))], '2026-11-03', '2026-11-05');
    expect(occ.map((o) => [o.start, o.end])).toEqual([
      ['2026-11-03T10:00', '2026-11-03T11:15'],
      ['2026-11-04T10:00', '2026-11-04T11:15'],
    ]);
    expect(occ[0]!.key).toBe('series-1@2026-11-03');
    expect(occ[0]!.isRecurring).toBe(true);
  });

  it('does not repeat before the series starts', () => {
    expect(dates([series(rule('daily'))], '2026-10-25', '2026-11-04')).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('weekdays skips the weekend', () => {
    expect(dates([series(rule('weekdays'))], '2026-11-02', '2026-11-10')).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09',
    ]);
  });

  it('weekly repeats on the start date\'s weekday, or on the chosen weekdays', () => {
    expect(dates([series(rule('weekly'))], '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    // Mon, Wed, Fri
    expect(dates([series(rule('weekly', { byWeekday: [1, 3, 5] }))], '2026-11-02', '2026-11-10')).toEqual([
      '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09',
    ]);
  });

  it('monthly uses the same day of the month, and the last day of shorter months', () => {
    const jan31 = series(rule('monthly'), { start: '2026-01-31T10:00', end: '2026-01-31T11:00' });
    expect(dates([jan31], '2026-01-01', '2026-05-01')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('stops after `until` (inclusive)', () => {
    const s = series(rule('daily', { until: '2026-11-04' }));
    expect(dates([s], '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('leaves out removed dates (exdates)', () => {
    const s = series(rule('daily', { exdates: ['2026-11-03'] }));
    expect(dates([s], '2026-11-02', '2026-11-05')).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('includes a multi-day occurrence that began before the range', () => {
    const s = series(rule('weekly'), { start: '2026-11-02T00:00', end: '2026-11-05T00:00', allDay: true });
    const occ = expandOccurrences([s], '2026-11-04', '2026-11-05');
    expect(occ.map((o) => o.start)).toEqual(['2026-11-02T00:00']);
    expect(occ[0]!.allDay).toBe(true);
  });

  it('shows an override in place of its slot, wherever the override is', () => {
    const s = series(rule('daily'));
    const moved = event({ title: 'Class (moved)', start: '2026-11-03T14:00', end: '2026-11-03T15:00', recurringEventId: s.id, originalStart: '2026-11-03T10:00' });
    const occ = expandOccurrences([s, moved], '2026-11-02', '2026-11-05');
    expect(occ.map((o) => `${o.start.slice(5)} ${o.event.title}`)).toEqual(['11-02T10:00 Class', '11-03T14:00 Class (moved)', '11-04T10:00 Class']);
    const override = occ.find((o) => o.isOverride)!;
    expect(override.slotDate).toBe('2026-11-03');
    expect(override.seriesId).toBe(s.id);

    // Moved to another day: the original slot stays empty, and the override shows up on its new day.
    const nextWeek = { ...moved, start: '2026-11-10T14:00', end: '2026-11-10T15:00' };
    expect(dates([s, nextWeek], '2026-11-02', '2026-11-05')).toEqual(['2026-11-02', '2026-11-04']);
    expect(expandOccurrences([s, nextWeek], '2026-11-10', '2026-11-11').some((o) => o.isOverride)).toBe(true);
  });

  it('treats an override whose series is gone as an ordinary event', () => {
    const orphan = event({ recurringEventId: 'gone' as never, originalStart: '2026-11-03T10:00', start: '2026-11-03T14:00', end: '2026-11-03T15:00' });
    const [o] = expandOccurrences([orphan], '2026-11-03', '2026-11-04');
    expect(o!.isRecurring).toBe(false);
  });

  it('finds the first occurrence even when the start date is not one', () => {
    expect(firstOccurrenceDate(series(rule('weekly', { byWeekday: [3, 5] })))).toBe('2026-11-04'); // starts Mon, first Wed
  });
});

function plan(kind: 'edit' | 'delete', events: Event[], occurrenceStart: string, scope: EditScope, changes?: Parameters<typeof planEventEdit>[0]['changes']) {
  const occurrence = expandOccurrences(events, occurrenceStart.slice(0, 10), `${occurrenceStart.slice(0, 10)}T23:59`).find((o) => o.start === occurrenceStart) as EventOccurrence;
  expect(occurrence, `occurrence at ${occurrenceStart}`).toBeDefined();
  const ctx = { events, occurrence, scope, now: NOW, newId };
  return kind === 'edit' ? planEventEdit({ ...ctx, changes: changes! }) : planEventDelete(ctx);
}

describe('planEventEdit', () => {
  it('changes a one-off event in place, keeping its length when only the start moves', () => {
    const e = event({ id: 'one' as never });
    const p = plan('edit', [e], '2026-11-02T10:00', 'this', { start: '2026-11-03T09:00' });
    expect(p.put).toHaveLength(1);
    expect(p.put[0]).toMatchObject({ id: 'one', start: '2026-11-03T09:00', end: '2026-11-03T10:00' });
  });

  it('"this event" on a series makes an override and leaves the series alone', () => {
    const s = series(rule('weekly'));
    const p = plan('edit', [s], '2026-11-09T10:00', 'this', { title: 'Class (lab)', start: '2026-11-09T13:00' });
    expect(p.put).toHaveLength(1);
    expect(p.remove).toEqual([]);
    expect(p.put[0]).toMatchObject({ title: 'Class (lab)', start: '2026-11-09T13:00', end: '2026-11-09T14:15', recurrence: null, recurringEventId: s.id, originalStart: '2026-11-09T10:00' });
    const after = applyPlan([s], p);
    expect(expandOccurrences(after, '2026-11-02', '2026-11-16').map((o) => `${o.start} ${o.event.title}`)).toEqual([
      '2026-11-02T10:00 Class',
      '2026-11-09T13:00 Class (lab)',
    ]);
  });

  it('editing an override "this event" changes just that row', () => {
    const s = series(rule('weekly'));
    const o = event({ id: 'ov' as never, title: 'Class (moved)', start: '2026-11-09T13:00', end: '2026-11-09T14:00', recurringEventId: s.id, originalStart: '2026-11-09T10:00' });
    const p = plan('edit', [s, o], '2026-11-09T13:00', 'this', { title: 'Class (again)' });
    expect(p.put).toHaveLength(1);
    expect(p.put[0]).toMatchObject({ id: 'ov', title: 'Class (again)', start: '2026-11-09T13:00' });
  });

  it('"all events" moved by a day shifts the whole series, including its weekdays, removed dates and overrides', () => {
    const s = series(rule('weekly', { byWeekday: [1, 3], exdates: ['2026-11-11'], until: '2026-12-01' }));
    const o = event({ id: 'ov' as never, title: 'moved', start: '2026-11-16T15:00', end: '2026-11-16T16:00', recurringEventId: s.id, originalStart: '2026-11-16T10:00' });
    const p = plan('edit', [s, o], '2026-11-09T10:00', 'all', { start: '2026-11-10T10:00' }); // Monday's class dragged to Tuesday
    const after = applyPlan([s, o], p);
    const next = after.find((e) => e.id === s.id)!;
    expect(next.start).toBe('2026-11-03T10:00');
    expect(next.end).toBe('2026-11-03T11:15');
    expect(next.recurrence).toMatchObject({ byWeekday: [2, 4], exdates: ['2026-11-12'], until: '2026-12-02' });
    expect(after.find((e) => e.id === 'ov')!.originalStart).toBe('2026-11-17T10:00');
    // Tuesdays and Thursdays now, with the Nov 12 (was the 11th) removed and Nov 17's class replaced by the override.
    expect(expandOccurrences(after, '2026-11-02', '2026-11-20').map((x) => x.start.slice(0, 10))).toEqual([
      '2026-11-03', '2026-11-05', '2026-11-10', '2026-11-16', '2026-11-19',
    ]);
  });

  it('"all events" with a new time of day and length changes every occurrence', () => {
    const s = series(rule('daily'));
    const p = plan('edit', [s], '2026-11-04T10:00', 'all', { start: '2026-11-04T09:00', end: '2026-11-04T09:30' });
    const next = applyPlan([s], p).find((e) => e.id === s.id)!;
    expect([next.start, next.end]).toEqual(['2026-11-02T09:00', '2026-11-02T09:30']);
  });

  it('"this and following" ends the old series the day before and starts a new one', () => {
    const s = series(rule('weekly', { exdates: ['2026-11-02', '2026-11-23'] }));
    const later = event({ id: 'ov' as never, title: 'moved', start: '2026-11-30T15:00', end: '2026-11-30T16:00', recurringEventId: s.id, originalStart: '2026-11-30T10:00' });
    const p = plan('edit', [s, later], '2026-11-16T10:00', 'following', { title: 'New name', start: '2026-11-16T11:00' });
    const after = applyPlan([s, later], p);

    const old = after.find((e) => e.id === s.id)!;
    expect(old.recurrence).toMatchObject({ until: '2026-11-15', exdates: ['2026-11-02'] });
    const created = after.find((e) => e.title === 'New name' && e.recurrence)!;
    expect(created.id).not.toBe(s.id);
    expect(created.start).toBe('2026-11-16T11:00');
    expect(created.recurrence).toMatchObject({ freq: 'weekly', exdates: ['2026-11-23'], until: null });
    expect(after.find((e) => e.id === 'ov')!.recurringEventId).toBe(created.id);

    expect(expandOccurrences(after, '2026-11-01', '2026-12-08').map((o) => `${o.start.slice(5, 10)} ${o.event.title}`)).toEqual([
      '11-09 Class',
      '11-16 New name',
      '11-30 moved',
      '12-07 New name',
    ]);
  });

  it('"this and following" from the first occurrence is the same as "all events"', () => {
    const s = series(rule('weekly'));
    const p = plan('edit', [s], '2026-11-02T10:00', 'following', { title: 'Renamed' });
    expect(p.put).toHaveLength(1);
    expect(p.put[0]).toMatchObject({ id: s.id, title: 'Renamed' });
  });

  it('stopping a series from repeating removes its exceptions', () => {
    const s = series(rule('weekly'));
    const o = event({ id: 'ov' as never, recurringEventId: s.id, originalStart: '2026-11-09T10:00', start: '2026-11-09T13:00', end: '2026-11-09T14:00' });
    const p = plan('edit', [s, o], '2026-11-02T10:00', 'all', { recurrence: null });
    expect(p.remove).toEqual(['ov']);
    expect(p.put[0]!.recurrence).toBeNull();
  });

  it('a one-off event can become a repeating one', () => {
    const e = event({ id: 'one' as never });
    const p = plan('edit', [e], '2026-11-02T10:00', 'this', { recurrence: rule('weekly') });
    expect(p.put[0]!.recurrence).toMatchObject({ freq: 'weekly' });
  });
});

describe('planEventDelete', () => {
  it('removes a one-off event', () => {
    const e = event({ id: 'one' as never });
    expect(plan('delete', [e], '2026-11-02T10:00', 'this')).toEqual({ put: [], remove: ['one'] });
  });

  it('"this event" removes just that date of the series', () => {
    const s = series(rule('daily'));
    const after = applyPlan([s], plan('delete', [s], '2026-11-03T10:00', 'this'));
    expect(dates(after, '2026-11-02', '2026-11-05')).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('deleting an override also removes its slot, so the original does not come back', () => {
    const s = series(rule('daily'));
    const o = event({ id: 'ov' as never, recurringEventId: s.id, originalStart: '2026-11-03T10:00', start: '2026-11-03T14:00', end: '2026-11-03T15:00' });
    const p = plan('delete', [s, o], '2026-11-03T14:00', 'this');
    expect(p.remove).toEqual(['ov']);
    expect(dates(applyPlan([s, o], p), '2026-11-02', '2026-11-05')).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('"this and following" ends the series the day before, and removes later overrides', () => {
    const s = series(rule('daily'));
    const o = event({ id: 'ov' as never, recurringEventId: s.id, originalStart: '2026-11-05T10:00', start: '2026-11-05T14:00', end: '2026-11-05T15:00' });
    const p = plan('delete', [s, o], '2026-11-04T10:00', 'following');
    expect(p.remove).toEqual(['ov']);
    expect(dates(applyPlan([s, o], p), '2026-11-02', '2026-11-10')).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('"this and following" from the first occurrence deletes the whole series', () => {
    const s = series(rule('daily'));
    const o = event({ id: 'ov' as never, recurringEventId: s.id, originalStart: '2026-11-05T10:00', start: '2026-11-05T14:00', end: '2026-11-05T15:00' });
    expect(new Set(plan('delete', [s, o], '2026-11-02T10:00', 'following').remove)).toEqual(new Set([s.id, 'ov']));
  });

  it('"all events" removes the series and every override', () => {
    const s = series(rule('daily'));
    const o = event({ id: 'ov' as never, recurringEventId: s.id, originalStart: '2026-11-05T10:00', start: '2026-11-05T14:00', end: '2026-11-05T15:00' });
    const after = applyPlan([s, o], plan('delete', [s, o], '2026-11-03T10:00', 'all'));
    expect(after).toEqual([]);
  });
});

describe('invertPlan (undo)', () => {
  it('puts back changed and deleted rows and removes created ones', () => {
    const s = series(rule('weekly'));
    const edit = plan('edit', [s], '2026-11-09T10:00', 'this', { start: '2026-11-09T13:00' }); // creates an override
    const edited = applyPlan([s], edit);
    expect(invertPlan(edit, [s])).toEqual({ put: [], remove: [edit.put[0]!.id] });
    expect(applyPlan(edited, invertPlan(edit, [s]))).toEqual([s]);

    const del = plan('delete', [s], '2026-11-02T10:00', 'all');
    expect(applyPlan(applyPlan([s], del), invertPlan(del, [s]))).toEqual([s]);

    const split = plan('edit', [s], '2026-11-16T10:00', 'following', { title: 'New' });
    expect(applyPlan(applyPlan([s], split), invertPlan(split, [s]))).toEqual([s]);
  });
});
