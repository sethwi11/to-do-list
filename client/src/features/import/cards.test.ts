import { buildEvent, type EventType, type ExtractedItem } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { buildBlank } from '../calendar/testHelpers';
import { flagRepeats, makeCards, SYLLABUS_REMINDERS, toEventInput, toTaskInput, type CardContext } from './cards';

const types: EventType[] = [
  { id: 't-exam', name: 'Exam', sortOrder: 1 },
  { id: 't-deadline', name: 'Assignment Deadline', sortOrder: 2 },
];

const item = (over: Partial<ExtractedItem> = {}): ExtractedItem => ({
  id: '0',
  title: 'Midterm exam',
  start: '2026-11-20T00:00',
  end: '2026-11-21T00:00',
  allDay: true,
  typeName: 'Exam',
  location: null,
  link: null,
  confidence: 0.8,
  lowConfidence: false,
  snippet: 'Nov 20 · Midterm exam',
  charStart: 10,
  charEnd: 16,
  isDeadline: false,
  past: false,
  ...over,
});

const ctx = (over: Partial<CardContext> = {}): CardContext => ({ fileIndex: 0, syllabus: false, fromCalendarFile: false, eventTypes: types, events: [], tasks: [], ...over });

describe('makeCards', () => {
  it('checks a confident, upcoming, new item, as an event with its type filled in', () => {
    const [card] = makeCards([item()], ctx());
    expect(card).toMatchObject({ include: true, kind: 'event', typeId: 't-exam', title: 'Midterm exam', key: '0:0' });
    expect(card!.time).toMatchObject({ allDay: true, startDate: '2026-11-20', endDate: '2026-11-20' });
  });

  it('leaves doubtful items unchecked, and says why', () => {
    const [low, past, dup] = makeCards(
      [item({ confidence: 0.35, lowConfidence: true }), item({ past: true }), item({ title: 'Midterm' })],
      ctx({ events: [buildEvent({ title: 'Midterm exam', start: '2026-11-20T10:00', end: '2026-11-20T11:00' }, 'e1', '2026-11-01T00:00:00.000Z')] }),
    );
    expect(low).toMatchObject({ include: false, lowConfidence: true });
    expect(past).toMatchObject({ include: false, past: true });
    expect(dup).toMatchObject({ include: false, duplicateOf: 'Midterm exam' });
  });

  it('in a syllabus, makes deadlines to-dos with 3-day and 1-day reminders, and leaves other things as events', () => {
    const [deadline, exam] = makeCards([item({ title: 'Homework 4', typeName: 'Assignment Deadline', isDeadline: true }), item({ id: '1' })], ctx({ syllabus: true }));
    expect(deadline).toMatchObject({ kind: 'task', reminders: SYLLABUS_REMINDERS });
    expect(SYLLABUS_REMINDERS).toEqual([4320, 1440]);
    expect(exam).toMatchObject({ kind: 'event', reminders: [] });
  });

  it('outside a syllabus a deadline stays an event, with no reminders', () => {
    expect(makeCards([item({ isDeadline: true })], ctx())[0]).toMatchObject({ kind: 'event', reminders: [] });
  });

  it('works out the page of a date in a PDF', () => {
    expect(makeCards([item({ charStart: 500 })], ctx({ pageOf: (i) => (i >= 400 ? 2 : 1) }))[0]!.page).toBe(2);
  });
});

describe('turning a card into something to save', () => {
  const [card] = makeCards([item({ location: 'Room 120', title: 'Final exam', start: '2026-12-08T08:00', end: '2026-12-08T09:00', allDay: false })], ctx());

  it('builds an event with the times as stored', () => {
    expect(toEventInput(card!, 'https://zoom.us/j/1', { courseId: 'course-1' })).toMatchObject({
      title: 'Final exam',
      start: '2026-12-08T08:00',
      end: '2026-12-08T09:00',
      allDay: false,
      location: 'Room 120',
      link: 'https://zoom.us/j/1',
      typeId: 't-exam',
      courseId: 'course-1',
      source: 'file-import',
    });
  });

  it('builds a to-do due on the start date, at the start time if it has one', () => {
    expect(toTaskInput(card!, { courseId: null })).toMatchObject({ title: 'Final exam', dueDate: '2026-12-08', dueTime: '08:00', source: 'file-import' });
    const [allDay] = makeCards([item()], ctx());
    expect(toTaskInput(allDay!, { courseId: null })).toMatchObject({ dueDate: '2026-11-20', dueTime: null });
  });

  it('marks items from a calendar file as such, and keeps their repeat rule', () => {
    const rule = { freq: 'weekly' as const, byWeekday: null, until: null, exdates: [] };
    const [ics] = makeCards([item({ recurrence: rule, notes: 'Bring laptop' })], ctx({ fromCalendarFile: true }));
    expect(toEventInput(ics!, null, { courseId: null })).toMatchObject({ recurrence: rule, notes: 'Bring laptop', source: 'ics-import' });
  });
});

describe('flagRepeats', () => {
  it('flags and unchecks a later copy of the same thing, but not different things or different days', () => {
    const cards = makeCards([item({ title: 'ACM Career Panel' }), item({ id: '1', title: 'ACM career panel!' }), item({ id: '2', title: 'Career fair' }), item({ id: '3', title: 'ACM Career Panel', start: '2026-11-27T00:00', end: '2026-11-28T00:00' })], ctx());
    const flagged = flagRepeats(cards);
    expect(flagged.map((c) => c.include)).toEqual([true, false, true, true]);
    expect(flagged[1]!.duplicateOf).toContain('found above in this import');
    expect(flagged[0]!.duplicateOf).toBeNull();
  });
});
