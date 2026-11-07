import { describe, expect, it } from 'vitest';
import { HEATMAP, buildEvent, describeLoad, loadLevel, workloadByDay, type BlockLike, type Event, type Task } from '../src';

const NOW = '2026-11-01T12:00:00.000Z';
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const event = (start: string, end: string, extra: Partial<Parameters<typeof buildEvent>[0]> = {}): Event => buildEvent({ title: 'x', start, end, ...extra }, uuid(), NOW);
const block = (start: string, end: string): BlockLike => ({ id: uuid(), taskId: uuid(), start, end });
const task = (dueDate: string | null, priority: Task['priority'], status: Task['status'] = 'todo') => ({ dueDate, priority, status });

const week = (src: Parameters<typeof workloadByDay>[2]) => workloadByDay('2026-11-09', '2026-11-16', src);
const NONE = { events: [] as Event[], blocks: [] as BlockLike[], tasks: [] as ReturnType<typeof task>[] };

describe('the load score', () => {
  it('is event hours + time block hours + to-dos weighted by priority', () => {
    const load = week({
      events: [event('2026-11-10T10:00', '2026-11-10T12:00'), event('2026-11-10T14:00', '2026-11-10T15:30')],
      blocks: [block('2026-11-10T16:00', '2026-11-10T17:00')],
      tasks: [task('2026-11-10', 'high'), task('2026-11-10', 'medium'), task('2026-11-10', 'low')],
    }).get('2026-11-10')!;
    expect(load.eventMinutes).toBe(210);
    expect(load.blockMinutes).toBe(60);
    // 3.5h + 1h + (3 + 2 + 1)
    expect(load.score).toBeCloseTo(10.5);
    expect(load.events).toBe(2);
    expect(load.blocks).toBe(1);
    expect(load.tasksDue).toEqual({ high: 1, medium: 1, low: 1 });
  });

  it('uses the weights in the config constant', () => {
    expect(HEATMAP.taskWeight).toEqual({ high: 3, medium: 2, low: 1 });
    const load = week({ ...NONE, tasks: [task('2026-11-11', 'high')] }).get('2026-11-11')!;
    expect(load.score).toBe(HEATMAP.taskWeight.high);
  });

  it('counts only open to-dos, and only on their own day', () => {
    const days = week({ ...NONE, tasks: [task('2026-11-10', 'high'), task('2026-11-10', 'high', 'done'), task(null, 'high'), task('2026-12-25', 'high')] });
    expect(days.get('2026-11-10')!.taskCount).toBe(1);
    expect([...days.values()].reduce((sum, d) => sum + d.taskCount, 0)).toBe(1);
  });

  it('gives every day in the range an entry, empty ones included', () => {
    const days = week(NONE);
    expect(days.size).toBe(7);
    expect(days.get('2026-11-09')).toMatchObject({ score: 0, level: 0, events: 0 });
    expect(days.has('2026-11-16')).toBe(false); // the end of the range is exclusive
  });
});

describe('events across days', () => {
  it('counts only the part of an overnight event that falls on each day', () => {
    const days = week({ ...NONE, events: [event('2026-11-10T22:00', '2026-11-11T02:00')] });
    expect(days.get('2026-11-10')).toMatchObject({ events: 1, eventMinutes: 120 });
    expect(days.get('2026-11-11')).toMatchObject({ events: 1, eventMinutes: 120 });
  });

  it('counts an all-day event on each of its days, with no hours', () => {
    const days = week({ ...NONE, events: [event('2026-11-10T00:00', '2026-11-12T00:00', { allDay: true })] });
    expect(days.get('2026-11-10')).toMatchObject({ events: 1, eventMinutes: 0, score: 0, level: 0 });
    expect(days.get('2026-11-11')).toMatchObject({ events: 1, eventMinutes: 0 });
    expect(days.get('2026-11-12')).toMatchObject({ events: 0 });
  });

  it('expands repeating events (a class on Mondays and Wednesdays)', () => {
    const classes = event('2026-11-02T10:00', '2026-11-02T11:15', { recurrence: { freq: 'weekly', byWeekday: [1, 3], until: '2026-12-10', exdates: ['2026-11-11'] } });
    const days = week({ ...NONE, events: [classes] });
    expect(days.get('2026-11-09')!.eventMinutes).toBe(75); // Monday
    expect(days.get('2026-11-11')!.events).toBe(0); // Wednesday, cancelled
    expect(days.get('2026-11-10')!.events).toBe(0);
  });

  it('splits a time block that crosses midnight the same way', () => {
    const days = week({ ...NONE, blocks: [block('2026-11-10T23:00', '2026-11-11T01:00')] });
    expect(days.get('2026-11-10')!.blockMinutes).toBe(60);
    expect(days.get('2026-11-11')!.blockMinutes).toBe(60);
  });
});

describe('the four levels', () => {
  it('leaves an empty day unshaded and shades anything above zero', () => {
    expect(loadLevel(0)).toBe(0);
    expect(loadLevel(0.25)).toBe(1);
    expect(loadLevel(HEATMAP.moderateFrom - 0.01)).toBe(1);
  });

  it('steps up at each threshold', () => {
    expect(loadLevel(HEATMAP.moderateFrom)).toBe(2);
    expect(loadLevel(HEATMAP.busyFrom - 0.01)).toBe(2);
    expect(loadLevel(HEATMAP.busyFrom)).toBe(3);
    expect(loadLevel(HEATMAP.packedFrom - 0.01)).toBe(3);
    expect(loadLevel(HEATMAP.packedFrom)).toBe(4);
    expect(loadLevel(40)).toBe(4);
  });

  it('keeps the thresholds in increasing order', () => {
    expect(HEATMAP.moderateFrom).toBeLessThan(HEATMAP.busyFrom);
    expect(HEATMAP.busyFrom).toBeLessThan(HEATMAP.packedFrom);
  });

  it('reads a day of four classes (7.5 hours) as busy, and a lone hour as light', () => {
    const days = week({
      ...NONE,
      events: [event('2026-11-11T09:00', '2026-11-11T10:15'), event('2026-11-11T11:00', '2026-11-11T12:15'), event('2026-11-11T13:00', '2026-11-11T16:00'), event('2026-11-11T18:00', '2026-11-11T20:00'), event('2026-11-12T10:00', '2026-11-12T11:00')],
    });
    expect(days.get('2026-11-11')).toMatchObject({ score: 7.5, level: 3 });
    expect(days.get('2026-11-12')!.level).toBe(1);
  });

  it('assigns the level to each day', () => {
    const days = week({ ...NONE, events: [event('2026-11-10T09:00', '2026-11-10T17:00')], tasks: [task('2026-11-11', 'low')] });
    expect(days.get('2026-11-10')!.level).toBe(3); // 8h: busy, but not yet packed
    expect(days.get('2026-11-11')!.level).toBe(1);
    expect(days.get('2026-11-12')!.level).toBe(0);
  });
});

describe('the hover description', () => {
  it('reads like "2 events, 4h scheduled, 3 tasks due"', () => {
    const load = week({
      events: [event('2026-11-10T10:00', '2026-11-10T12:00'), event('2026-11-10T14:00', '2026-11-10T15:00')],
      blocks: [block('2026-11-10T16:00', '2026-11-10T17:00')],
      tasks: [task('2026-11-10', 'high'), task('2026-11-10', 'high'), task('2026-11-10', 'low')],
    }).get('2026-11-10')!;
    expect(describeLoad(load)).toBe('2 events, 4h scheduled, 3 tasks due');
  });

  it('uses singular words and leaves out what is not there', () => {
    expect(describeLoad(week({ ...NONE, events: [event('2026-11-10T10:00', '2026-11-10T10:30')] }).get('2026-11-10')!)).toBe('1 event, 30m scheduled');
    expect(describeLoad(week({ ...NONE, tasks: [task('2026-11-10', 'low')] }).get('2026-11-10')!)).toBe('1 task due');
    expect(describeLoad(week(NONE).get('2026-11-10')!)).toBe('Nothing planned');
  });
});
