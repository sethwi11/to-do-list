import { describe, expect, it } from 'vitest';
import { buildEvent, type Calendar, type Task, type TimeBlock } from '@todo/shared';
import {
  buildItems,
  calendarUrl,
  dataRange,
  daysWithItems,
  itemsOnDay,
  localDateTime,
  newEventSpan,
  parseCalendarQuery,
  selectionToSpan,
  shiftDate,
  spanFromFullCalendar,
  taskSpan,
  viewTitle,
  weekStart,
} from './calendarModel';
import { buildBlank } from './testHelpers';

const TODAY = '2026-11-04';
const params = (s: string) => new URLSearchParams(s);

describe('calendar URL', () => {
  it('reads a view and a date, and falls back for bad values', () => {
    expect(parseCalendarQuery(params('view=week&date=2026-11-10'), TODAY)).toEqual({ view: 'week', date: '2026-11-10' });
    expect(parseCalendarQuery(params(''), TODAY)).toEqual({ view: null, date: TODAY });
    expect(parseCalendarQuery(params('view=year&date=2026-13-45'), TODAY)).toEqual({ view: null, date: TODAY });
    expect(parseCalendarQuery(params('date=2026-02-30'), TODAY).date).toBe(TODAY);
  });

  it('builds links', () => {
    expect(calendarUrl()).toBe('/calendar');
    expect(calendarUrl({ view: 'day', date: '2026-11-04' })).toBe('/calendar?view=day&date=2026-11-04');
  });
});

describe('moving between dates', () => {
  it('month goes to the 1st of the neighbouring month (so the 31st cannot skip one)', () => {
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDate('month', '2026-03-31', -1)).toBe('2026-02-01');
  });
  it('week and agenda move 7 days, day moves 1', () => {
    expect(shiftDate('week', '2026-11-04', 1)).toBe('2026-11-11');
    expect(shiftDate('agenda', '2026-11-04', -1)).toBe('2026-10-28');
    expect(shiftDate('day', '2026-11-30', 1)).toBe('2026-12-01');
  });
  it('weeks start on Sunday', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-01'); // a Wednesday
    expect(weekStart('2026-11-01')).toBe('2026-11-01');
  });
});

describe('viewTitle', () => {
  it('names each view', () => {
    expect(viewTitle('month', '2026-11-04')).toBe('November 2026');
    expect(viewTitle('week', '2026-11-04')).toBe('Nov 1 – 7, 2026');
    expect(viewTitle('week', '2026-11-30')).toBe('Nov 29 – Dec 5, 2026');
    expect(viewTitle('week', '2026-12-30')).toBe('Dec 27, 2026 – Jan 2, 2027');
    expect(viewTitle('day', '2026-11-04')).toMatch(/Wednesday, November 4, 2026/);
  });
});

describe('dataRange', () => {
  it('covers the whole month grid and the weeks around it', () => {
    const [from, to] = dataRange('2026-11-15');
    expect(from <= '2026-10-25' && to >= '2026-12-06').toBe(true);
  });
});

const calendar: Calendar = { id: 'cal-school', name: 'School', color: 'dusty-blue', sortOrder: 1, createdAt: '' };
const calendarsById = new Map([[calendar.id, calendar]]);
const sources = (over: Partial<Parameters<typeof buildItems>[0]> = {}) => ({
  events: [] as ReturnType<typeof buildEvent>[],
  tasks: [] as Task[],
  calendarsById,
  hiddenCalendarIds: new Set<string>(),
  showEvents: true,
  showTasks: true,
  ...over,
});

const ev = (title: string, start: string, end: string, extra = {}) => buildEvent({ title, start, end, ...extra }, `id-${title}`, '2026-11-04T00:00:00.000Z');
const task = (title: string, dueDate: string | null, extra: Partial<Task> = {}) => buildBlank(title, dueDate, extra);
const block = (taskTitle: string, start: string, end: string): TimeBlock => ({ id: `block-${taskTitle}-${start}`, taskId: taskTitle, start, end, createdAt: '', updatedAt: '' });

describe('buildItems', () => {
  it('includes events and to-dos in range, coloured by their calendar', () => {
    const items = buildItems(
      sources({
        events: [ev('Class', '2026-11-04T10:00', '2026-11-04T11:00', { calendarId: calendar.id }), ev('Later', '2026-12-30T10:00', '2026-12-30T11:00')],
        tasks: [task('Read', '2026-11-05', { calendarId: calendar.id }), task('No date', null), task('Far', '2027-01-01')],
      }),
      '2026-11-01',
      '2026-12-01',
    );
    expect(items.map((i) => i.id)).toEqual(['id-Class', 'task:' + 'Read']);
    expect(items.every((i) => i.color === 'dusty-blue')).toBe(true);
    expect(items[0]!.calendarName).toBe('School');
  });

  it('honours hidden calendars and the two layer switches, but keeps items with no calendar', () => {
    const base = sources({
      events: [ev('A', '2026-11-04T10:00', '2026-11-04T11:00', { calendarId: calendar.id }), ev('B', '2026-11-04T12:00', '2026-11-04T13:00')],
      tasks: [task('T', '2026-11-04', { calendarId: calendar.id })],
    });
    const hidden = new Set([calendar.id]);
    expect(buildItems({ ...base, hiddenCalendarIds: hidden }, '2026-11-01', '2026-12-01').map((i) => i.id)).toEqual(['id-B']);
    expect(buildItems({ ...base, showTasks: false }, '2026-11-01', '2026-12-01').map((i) => i.kind)).toEqual(['event', 'event']);
    expect(buildItems({ ...base, showEvents: false }, '2026-11-01', '2026-12-01').map((i) => i.kind)).toEqual(['task']);
  });

  it('an event\'s own colour wins over its calendar\'s', () => {
    const [item] = buildItems(sources({ events: [ev('A', '2026-11-04T10:00', '2026-11-04T11:00', { calendarId: calendar.id, color: 'plum' })] }), '2026-11-01', '2026-12-01');
    expect(item!.color).toBe('plum');
  });
});

describe('buildItems with time blocks', () => {
  const lab = task('Lab report', '2026-11-06', { calendarId: calendar.id });
  const reading = task('Reading', null);
  const base = sources({
    tasks: [lab, reading],
    blocks: [block('Lab report', '2026-11-04T10:00', '2026-11-04T11:30'), block('Reading', '2026-11-04T14:00', '2026-11-04T15:00')],
    showBlocks: true,
  });

  it('draws a block in its to-do\'s calendar colour, even when the to-do has no due date', () => {
    const items = buildItems(base, '2026-11-01', '2026-12-01').filter((i) => i.kind === 'block');
    expect(items.map((i) => i.kind === 'block' && i.task.title)).toEqual(['Lab report', 'Reading']);
    expect(items[0]).toMatchObject({ color: 'dusty-blue', calendarName: 'School' });
    expect(items[1]!.color).toBe('slate'); // no calendar: the neutral colour
  });

  it('only shows blocks in range, and not at all when the layer is off', () => {
    expect(buildItems(base, '2026-11-05', '2026-12-01').filter((i) => i.kind === 'block')).toEqual([]);
    expect(buildItems(base, '2026-11-04T10:30', '2026-11-04T12:00').filter((i) => i.kind === 'block')).toHaveLength(1); // overlapping the range counts
    expect(buildItems({ ...base, showBlocks: false }, '2026-11-01', '2026-12-01').filter((i) => i.kind === 'block')).toEqual([]);
  });

  it('hides blocks of a hidden calendar, and of a to-do that no longer exists', () => {
    const hidden = buildItems({ ...base, hiddenCalendarIds: new Set([calendar.id]) }, '2026-11-01', '2026-12-01').filter((i) => i.kind === 'block');
    expect(hidden.map((i) => i.kind === 'block' && i.task.title)).toEqual(['Reading']);
    const orphaned = buildItems({ ...base, tasks: [lab] }, '2026-11-01', '2026-12-01').filter((i) => i.kind === 'block');
    expect(orphaned.map((i) => i.kind === 'block' && i.task.title)).toEqual(['Lab report']);
  });

  it('sorts blocks between events and to-dos that start at the same time', () => {
    const items = buildItems(
      sources({
        events: [ev('Class', '2026-11-04T10:00', '2026-11-04T11:00')],
        tasks: [task('Quiz', '2026-11-04', { dueTime: '10:00' }), lab],
        blocks: [block('Lab report', '2026-11-04T10:00', '2026-11-04T11:00')],
        showBlocks: true,
      }),
      '2026-11-01',
      '2026-12-01',
    );
    expect(itemsOnDay(items, '2026-11-04').map((i) => i.kind)).toEqual(['event', 'block', 'task']);
  });
});

describe('taskSpan', () => {
  it('is all-day without a time, else the estimate (30 minutes by default)', () => {
    expect(taskSpan(task('a', '2026-11-04'))).toEqual({ start: '2026-11-04', end: '2026-11-05', allDay: true });
    expect(taskSpan(task('a', '2026-11-04', { dueTime: '09:00' }))).toEqual({ start: '2026-11-04T09:00', end: '2026-11-04T09:30', allDay: false });
    expect(taskSpan(task('a', '2026-11-04', { dueTime: '09:00', estimatedMinutes: 90 })).end).toBe('2026-11-04T10:30');
  });
  it('stays within its day', () => {
    expect(taskSpan(task('a', '2026-11-04', { dueTime: '23:45', estimatedMinutes: 120 })).end).toBe('2026-11-04T23:59');
  });
});

describe('itemsOnDay / daysWithItems', () => {
  const items = buildItems(
    sources({
      events: [
        ev('Timed', '2026-11-04T10:00', '2026-11-04T11:00'),
        ev('All day', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true }),
        ev('Three days', '2026-11-03T00:00', '2026-11-06T00:00', { allDay: true }),
      ],
      tasks: [task('Todo', '2026-11-04')],
    }),
    '2026-11-01',
    '2026-12-01',
  );

  it('lists all-day first, then by time, with a multi-day event on every day it covers', () => {
    expect(itemsOnDay(items, '2026-11-04').map((i) => (i.kind === 'event' ? i.occurrence.event.title : i.task.title))).toEqual(['Three days', 'All day', 'Todo', 'Timed']);
    expect(itemsOnDay(items, '2026-11-05').map((i) => (i.kind === 'event' ? i.occurrence.event.title : ''))).toEqual(['Three days']);
    expect(itemsOnDay(items, '2026-11-06')).toEqual([]); // the end of an all-day event is exclusive
  });

  it('finds the days that have something, plus any requested ones', () => {
    expect(daysWithItems(items, '2026-11-01', '2026-11-08')).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(daysWithItems(items, '2026-11-01', '2026-11-08', ['2026-11-07'])).toContain('2026-11-07');
  });
});

describe('FullCalendar conversions', () => {
  it('formats a Date by its local clock', () => {
    expect(localDateTime(new Date(2026, 10, 4, 9, 5))).toBe('2026-11-04T09:05');
  });

  it('fills in a missing end', () => {
    expect(spanFromFullCalendar(new Date(2026, 10, 4, 14, 0), null, false)).toEqual({ start: '2026-11-04T14:00', end: '2026-11-04T15:00', allDay: false });
    expect(spanFromFullCalendar(new Date(2026, 10, 4), null, true)).toEqual({ start: '2026-11-04T00:00', end: '2026-11-05T00:00', allDay: true });
    expect(spanFromFullCalendar(new Date(2026, 10, 4), new Date(2026, 10, 7), true)).toEqual({ start: '2026-11-04T00:00', end: '2026-11-07T00:00', allDay: true });
  });
});

describe('selectionToSpan', () => {
  it('turns a click on a half-hour slot into an hour, and keeps a dragged range', () => {
    expect(selectionToSpan('2026-11-04T10:00', '2026-11-04T10:30', false)).toEqual({ start: '2026-11-04T10:00', end: '2026-11-04T11:00' });
    expect(selectionToSpan('2026-11-04T23:30', '2026-11-05T00:00', false)).toEqual({ start: '2026-11-04T23:30', end: '2026-11-05T00:30' });
    expect(selectionToSpan('2026-11-04T10:00', '2026-11-04T12:00', false).end).toBe('2026-11-04T12:00');
    expect(selectionToSpan('2026-11-04T00:00', '2026-11-05T00:00', true).end).toBe('2026-11-05T00:00');
  });
});

describe('newEventSpan', () => {
  it('starts at the next full hour today', () => {
    expect(newEventSpan(null, new Date(2026, 10, 4, 14, 20))).toEqual({ start: '2026-11-04T15:00', end: '2026-11-04T16:00' });
    expect(newEventSpan('2026-11-04', new Date(2026, 10, 4, 14, 20)).start).toBe('2026-11-04T15:00');
  });
  it('rolls over late at night', () => {
    expect(newEventSpan(null, new Date(2026, 10, 4, 23, 10))).toEqual({ start: '2026-11-05T09:00', end: '2026-11-05T10:00' });
  });
  it('uses 9 AM on another day you are looking at', () => {
    expect(newEventSpan('2026-11-20', new Date(2026, 10, 4, 14, 20))).toEqual({ start: '2026-11-20T09:00', end: '2026-11-20T10:00' });
  });
});
