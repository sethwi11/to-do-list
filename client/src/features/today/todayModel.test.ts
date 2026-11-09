import { buildEvent, expandOccurrences, type Event, type PlanItem } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { buildBlank } from '../calendar/testHelpers';
import { agendaRange, currentItem, duringBlock, layoutLanes, nextItem, nextUpcoming, summarize, supposedToBeDoing } from './todayModel';

const NOW = '2026-11-04T12:00:00.000Z';
let n = 0;
const ev = (title: string, start: string, end: string, extra: Partial<Event> = {}): Event =>
  buildEvent({ title, start, end, ...extra }, `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, NOW);

const day = (events: Event[]) => expandOccurrences(events, '2026-11-04', '2026-11-05');
const item = (title: string, start: string, end: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  key: title, kind: 'routine', start: `2026-11-04T${start}`, end: `2026-11-04T${end}`, title, calendarId: null, color: null, priority: 'normal', focus: false, soundtrack: null, altTitle: null, altCalendarId: null, sourceId: null, status: 'planned', replaces: [], clashes: [], makeup: false, hidden: [], ...extra,
});

describe('nextUpcoming', () => {
  const events = [
    ev('Class', '2026-11-04T10:00', '2026-11-04T11:00'),
    ev('Interview', '2026-11-04T14:30', '2026-11-04T15:30'),
    ev('Career fair', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true }),
    ev('Tomorrow thing', '2026-11-05T09:00', '2026-11-05T10:00'),
  ];

  it('is the next timed event to start, ignoring ones already begun and all-day ones', () => {
    expect(nextUpcoming(events, '2026-11-04T09:00')?.event.title).toBe('Class');
    expect(nextUpcoming(events, '2026-11-04T10:30')?.event.title).toBe('Interview'); // the class is under way
    expect(nextUpcoming(events, '2026-11-04T10:00')?.event.title).toBe('Interview'); // starting this minute counts as begun
  });

  it('looks into the following days when today is finished', () => {
    expect(nextUpcoming(events, '2026-11-04T18:00')?.event.title).toBe('Tomorrow thing');
  });

  it('finds the next date of a repeating event, and gives up after two weeks', () => {
    const weekly = ev('Lab', '2026-10-27T14:00', '2026-10-27T16:00', { recurrence: { freq: 'weekly', byWeekday: null, until: null, exdates: [] } });
    expect(nextUpcoming([weekly], '2026-11-04T18:00')?.start).toBe('2026-11-10T14:00');
    expect(nextUpcoming([ev('Far', '2026-12-30T09:00', '2026-12-30T10:00')], '2026-11-04T18:00')).toBeUndefined();
  });
});

describe('summarize', () => {
  it('counts events, open to-dos due today, overdue ones, and overlapping pairs', () => {
    const todays = day([
      ev('A', '2026-11-04T10:00', '2026-11-04T11:00'),
      ev('B', '2026-11-04T10:30', '2026-11-04T11:30'),
      ev('C', '2026-11-04T15:00', '2026-11-04T16:00'),
      ev('All day', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true }),
    ]);
    const tasks = [
      buildBlank('due', '2026-11-04'),
      buildBlank('due 2', '2026-11-04'),
      buildBlank('done', '2026-11-04', { status: 'done' }),
      buildBlank('late', '2026-11-02'),
      buildBlank('late but done', '2026-11-02', { status: 'done' }),
      buildBlank('later', '2026-11-09'),
      buildBlank('undated', null),
    ];
    expect(summarize(todays, tasks, '2026-11-04')).toEqual({ events: 4, blocks: 0, tasks: 2, overdue: 1, conflicts: 1 });
    expect(summarize(todays, tasks, '2026-11-04', 2).blocks).toBe(2);
  });
});

describe('the Now card', () => {
  const items = [
    item('Study', '09:00', '11:00'),
    item('Lecture', '10:00', '11:00', { kind: 'class' }),
    item('Open', '11:00', '12:00', { kind: 'open', priority: null }),
    item('Lunch', '12:00', '13:00'),
  ];
  it('shows a class over the routine block it overlaps', () => {
    expect(currentItem(items, '2026-11-04T09:30')?.title).toBe('Study');
    expect(currentItem(items, '2026-11-04T10:15')?.title).toBe('Lecture');
    expect(currentItem(items, '2026-11-04T13:00')).toBeUndefined();
  });
  it('says what comes next, skipping open time', () => {
    expect(nextItem(items, '2026-11-04T10:30')?.title).toBe('Lunch');
  });
  it('during a block, lists every open to-do in its category and alt category: soonest due, then priority, undated last', () => {
    const tasks = [
      buildBlank('later', '2026-11-09', { calendarId: 'c' }),
      buildBlank('undated', null, { calendarId: 'c' }),
      buildBlank('soon, low', '2026-11-05', { calendarId: 'c', priority: 'low' }),
      buildBlank('soon, high', '2026-11-05', { calendarId: 'c', priority: 'high' }),
      buildBlank('alt category', '2026-11-06', { calendarId: 'alt' }),
      buildBlank('done', '2026-11-04', { calendarId: 'c', status: 'done' }),
      buildBlank('other category', '2026-11-04', { calendarId: 'x' }),
      buildBlank('no category', '2026-11-04'),
    ];
    const block = item('POSH work', '15:50', '17:50', { calendarId: 'c', altCalendarId: 'alt' });
    expect(duringBlock(tasks, block).map((t) => t.title)).toEqual(['soon, high', 'soon, low', 'alt category', 'later', 'undated']);
    expect(duringBlock(tasks, { ...block, calendarId: null, altCalendarId: null })).toEqual([]); // a block with no category matches nothing
    expect(duringBlock(tasks, { ...block, kind: 'class' })).toEqual([]);
  });

  it('knows what you set out to do now: time set aside now, and to-dos due during the current item', () => {
    const tasks = [
      buildBlank('scheduled now', null, { id: 's' }),
      buildBlank('due at 4', '2026-11-04', { dueTime: '16:00' }),
      buildBlank('due at 7', '2026-11-04', { dueTime: '19:00' }),
      buildBlank('due today, no time', '2026-11-04'),
    ];
    const blocks = [{ id: 'b', taskId: 's', start: '2026-11-04T15:30', end: '2026-11-04T16:30', createdAt: '', updatedAt: '' }];
    const now = '2026-11-04T15:45';
    expect(supposedToBeDoing(tasks, blocks, now, { start: '2026-11-04T15:00', end: '2026-11-04T17:00' }).map((t) => t.title)).toEqual(['due at 4', 'scheduled now']);
    expect(supposedToBeDoing(tasks, [], now, undefined).map((t) => t.title)).toEqual(['due at 4']); // nothing on: the next hour
  });
});

describe('the agenda', () => {
  it('puts overlapping items side by side and the rest full width', () => {
    const lanes = layoutLanes([item('A', '09:00', '11:00'), item('B', '10:00', '11:00'), item('C', '11:00', '12:00')]);
    expect(lanes.get('A')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('B')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('C')).toEqual({ lane: 0, lanes: 1 });
  });
  it('shows 6 AM to 10 PM, stretched for an early start or a late night past midnight', () => {
    expect(agendaRange({ date: '2026-11-04', items: [item('A', '09:00', '10:00')] })).toEqual({ from: 360, to: 1320 });
    expect(agendaRange({ date: '2026-11-04', items: [item('Gym', '05:30', '06:30'), { ...item('Free', '22:00', '23:00'), end: '2026-11-05T02:00' }] })).toEqual({ from: 300, to: 1560 });
  });
});
