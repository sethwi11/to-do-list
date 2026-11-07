import { buildEvent, expandOccurrences, type Event, type TimeBlock } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { buildBlank } from '../calendar/testHelpers';
import { blocksOnDay, isInProgress, nextUpcoming, summarize, timelineRows } from './todayModel';

const NOW = '2026-11-04T12:00:00.000Z';
let n = 0;
const ev = (title: string, start: string, end: string, extra: Partial<Event> = {}): Event =>
  buildEvent({ title, start, end, ...extra }, `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, NOW);

const day = (events: Event[]) => expandOccurrences(events, '2026-11-04', '2026-11-05');
const label = (rows: ReturnType<typeof timelineRows>) =>
  rows.map((r) => (r.kind === 'now-line' ? '--now--' : r.kind === 'block' ? `[block ${r.task.title}]:${r.state}` : `${r.occurrence.event.title}:${r.state}`));

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

describe('isInProgress', () => {
  const [o] = day([ev('Class', '2026-11-04T10:00', '2026-11-04T11:00')]);
  it('is true from the start up to (not including) the end', () => {
    expect(isInProgress(o!, '2026-11-04T09:59')).toBe(false);
    expect(isInProgress(o!, '2026-11-04T10:00')).toBe(true);
    expect(isInProgress(o!, '2026-11-04T10:59')).toBe(true);
    expect(isInProgress(o!, '2026-11-04T11:00')).toBe(false);
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

describe('timelineRows', () => {
  const todays = day([
    ev('Class', '2026-11-04T10:00', '2026-11-04T11:00'),
    ev('Sync', '2026-11-04T10:30', '2026-11-04T11:30'),
    ev('Interview', '2026-11-04T14:30', '2026-11-04T15:30'),
    ev('Career fair', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true }),
  ]);

  it('puts all-day first, then timed events, with the now-line before the first one still to come', () => {
    expect(label(timelineRows(todays, '2026-11-04T12:00'))).toEqual(['Career fair:all-day', 'Class:past', 'Sync:past', '--now--', 'Interview:upcoming']);
  });

  it('marks an event that is under way, and puts the line after it', () => {
    expect(label(timelineRows(todays, '2026-11-04T10:45'))).toEqual(['Career fair:all-day', 'Class:now', 'Sync:now', '--now--', 'Interview:upcoming']);
  });

  it('puts the line first before the day starts and last after it ends', () => {
    expect(label(timelineRows(todays, '2026-11-04T07:00'))[1]).toBe('--now--');
    const late = label(timelineRows(todays, '2026-11-04T22:00'));
    expect(late[late.length - 1]).toBe('--now--');
  });

  it('has no line when there is nothing timed, and lists overlaps on each row', () => {
    expect(label(timelineRows(day([ev('Career fair', '2026-11-04T00:00', '2026-11-05T00:00', { allDay: true })]), '2026-11-04T12:00'))).toEqual(['Career fair:all-day']);
    const rows = timelineRows(todays, '2026-11-04T12:00');
    const clashesOf = (title: string) => rows.flatMap((r) => (r.kind === 'event' && r.occurrence.event.title === title ? [r.clashes.map((c) => c.event.title)] : []))[0];
    expect(clashesOf('Class')).toEqual(['Sync']);
    expect(clashesOf('Interview')).toEqual([]);
  });
});

describe('time blocks on the timeline', () => {
  const todays = day([ev('Class', '2026-11-04T10:00', '2026-11-04T11:00'), ev('Interview', '2026-11-04T14:30', '2026-11-04T15:30')]);
  const block = (id: string, taskId: string, start: string, end: string): TimeBlock => ({ id, taskId, start, end, createdAt: NOW, updatedAt: NOW });
  const tasks = [buildBlank('Lab report', '2026-11-06'), buildBlank('Read ch. 4', null)];
  const blocks = [block('b1', 'Lab report', '2026-11-04T12:00', '2026-11-04T13:30'), block('b2', 'Read ch. 4', '2026-11-04T16:00', '2026-11-04T17:00')];

  it('sit among the events by start time, with their own state', () => {
    const rows = timelineRows(todays, '2026-11-04T12:30', blocksOnDay(blocks, tasks, '2026-11-04'));
    expect(label(rows)).toEqual(['Class:past', '[block Lab report]:now', '--now--', 'Interview:upcoming', '[block Read ch. 4]:upcoming']);
  });

  it('put an event first when it starts at the same time as a block', () => {
    const same = [block('b3', 'Lab report', '2026-11-04T10:00', '2026-11-04T11:00')];
    expect(label(timelineRows(todays, '2026-11-04T09:00', blocksOnDay(same, tasks, '2026-11-04'))).slice(0, 3)).toEqual(['--now--', 'Class:upcoming', '[block Lab report]:upcoming']);
  });

  it('are all there is to place the now-line among when the day has no timed events', () => {
    expect(label(timelineRows([], '2026-11-04T12:30', blocksOnDay(blocks, tasks, '2026-11-04')))).toEqual(['[block Lab report]:now', '--now--', '[block Read ch. 4]:upcoming']);
  });

  it('only include blocks that touch the day and whose to-do still exists', () => {
    const other = [...blocks, block('b4', 'Lab report', '2026-11-05T09:00', '2026-11-05T10:00'), block('b5', 'deleted', '2026-11-04T09:00', '2026-11-04T10:00')];
    expect(blocksOnDay(other, tasks, '2026-11-04').map((b) => b.block.id)).toEqual(['b1', 'b2']);
  });

  it('count a block that ends at midnight as belonging to the day it started on', () => {
    const late = [block('b6', 'Lab report', '2026-11-04T23:00', '2026-11-05T00:00')];
    expect(blocksOnDay(late, tasks, '2026-11-04')).toHaveLength(1);
    expect(blocksOnDay(late, tasks, '2026-11-05')).toHaveLength(0);
  });
});
