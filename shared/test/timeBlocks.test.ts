import { describe, expect, it } from 'vitest';
import {
  BLOCK_LENGTHS,
  DEFAULT_BLOCK_MINUTES,
  blockMinutes,
  blockMinutesFor,
  blockSpan,
  buildEvent,
  findBlockClashes,
  findClashes,
  formatMinutes,
  scheduledMinutesByTask,
  type BlockLike,
  type Event,
} from '../src';

const NOW = '2026-11-01T12:00:00.000Z';
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const event = (title: string, start: string, end: string, extra: Partial<Parameters<typeof buildEvent>[0]> = {}): Event => buildEvent({ title, start, end, ...extra }, uuid(), NOW);
const block = (taskId: string, start: string, end: string): BlockLike => ({ id: uuid(), taskId, start, end });

describe('how long a block is', () => {
  it('is the to-do\'s estimate, or an hour', () => {
    expect(blockMinutesFor({ estimatedMinutes: 45 })).toBe(45);
    expect(blockMinutesFor({ estimatedMinutes: null })).toBe(DEFAULT_BLOCK_MINUTES);
    expect(DEFAULT_BLOCK_MINUTES).toBe(60);
  });

  it('offers sensible lengths, including the default', () => {
    expect(BLOCK_LENGTHS).toContain(DEFAULT_BLOCK_MINUTES);
    expect([...BLOCK_LENGTHS]).toEqual([...BLOCK_LENGTHS].sort((a, b) => a - b));
  });

  it('starts where you drop it and runs for its length', () => {
    expect(blockSpan('2026-11-12T10:00', 90)).toEqual({ start: '2026-11-12T10:00', end: '2026-11-12T11:30' });
  });

  it('stops at midnight rather than carrying into the next day', () => {
    expect(blockSpan('2026-11-12T23:00', 120)).toEqual({ start: '2026-11-12T23:00', end: '2026-11-13T00:00' });
    expect(blockSpan('2026-11-12T22:00', 120)).toEqual({ start: '2026-11-12T22:00', end: '2026-11-13T00:00' });
  });

  it('measures a block', () => {
    expect(blockMinutes({ start: '2026-11-12T10:00', end: '2026-11-12T11:15' })).toBe(75);
  });
});

describe('time set aside per to-do', () => {
  it('adds up all of a to-do\'s blocks, and keeps to-dos apart', () => {
    const totals = scheduledMinutesByTask([
      block('a', '2026-11-12T09:00', '2026-11-12T10:00'),
      block('a', '2026-11-13T14:00', '2026-11-13T14:30'),
      block('b', '2026-11-12T09:00', '2026-11-12T11:00'),
    ]);
    expect(totals.get('a')).toBe(90);
    expect(totals.get('b')).toBe(120);
    expect(totals.get('c')).toBeUndefined();
  });

  it('writes lengths of time briefly', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(0)).toBe('0m');
  });
});

describe('overlaps that include time blocks', () => {
  const titles: Record<string, string> = { a: 'Write lab report', b: 'Read chapter 4' };
  const titleOf = (id: string) => titles[id];
  const span = { start: '2026-11-12T10:00', end: '2026-11-12T11:00', allDay: false };

  it('finds a block that overlaps by at least a minute, and ignores one that only touches', () => {
    const overlapping = block('a', '2026-11-12T10:30', '2026-11-12T11:30');
    const touching = block('b', '2026-11-12T11:00', '2026-11-12T12:00');
    const clashes = findBlockClashes([overlapping, touching], titleOf, span);
    expect(clashes.map((c) => c.title)).toEqual(['Write lab report']);
    expect(clashes[0]).toMatchObject({ kind: 'block', start: '2026-11-12T10:30', end: '2026-11-12T11:30' });
  });

  it('never clashes with the block being moved, an all-day span, or a block whose to-do was deleted', () => {
    const mine = block('a', '2026-11-12T10:00', '2026-11-12T11:00');
    const orphan = block('gone', '2026-11-12T10:00', '2026-11-12T11:00');
    expect(findBlockClashes([mine], titleOf, span, new Set([mine.id]))).toEqual([]);
    expect(findBlockClashes([orphan], titleOf, span)).toEqual([]);
    expect(findBlockClashes([mine], titleOf, { ...span, allDay: true })).toEqual([]);
  });

  it('lists events and blocks together, earliest first', () => {
    const meeting = event('Standup', '2026-11-12T10:15', '2026-11-12T10:45');
    const earlier = block('b', '2026-11-12T09:30', '2026-11-12T10:10');
    const later = block('a', '2026-11-12T10:50', '2026-11-12T12:00');
    const clashes = findClashes({ events: [meeting], blocks: [later, earlier], titleOf }, span);
    expect(clashes.map((c) => `${c.kind}:${c.title}`)).toEqual(['block:Read chapter 4', 'event:Standup', 'block:Write lab report']);
  });

  it('leaves out the event being edited and its series, and the block being moved, independently', () => {
    const meeting = event('Standup', '2026-11-12T10:15', '2026-11-12T10:45');
    const mine = block('a', '2026-11-12T10:00', '2026-11-12T11:00');
    const clashes = findClashes({ events: [meeting], blocks: [mine], titleOf }, span, { events: new Set([meeting.id]), blocks: new Set([mine.id]) });
    expect(clashes).toEqual([]);
  });
});
