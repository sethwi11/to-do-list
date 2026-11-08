import {
  type CreateEventInput,
  type CreateTaskInput,
  type EventRecurrence,
  type EventType,
  type Event,
  type ExtractedItem,
  type Task,
} from '@todo/shared';
import { fromTimeFields, toTimeFields, type TimeFields } from '../events/eventForm';
import { findDuplicate, titlesAlike } from './duplicates';

/** Reminders a deadline from a syllabus gets unless changed: 3 days and 1 day before, in minutes. */
export const SYLLABUS_REMINDERS = [3 * 24 * 60, 24 * 60];

export type CardKind = 'event' | 'task';

/** One thing found in a file, as the person edits it in the review. */
export interface Card {
  key: string;
  fileIndex: number;
  include: boolean;
  kind: CardKind;
  title: string;
  time: TimeFields;
  typeId: string;
  calendarId: string;
  location: string;
  link: string;
  notes: string;
  /** For a to-do: minutes before it's due to be reminded. */
  reminders: number[];
  /** Only from an .ics file. */
  recurrence: EventRecurrence | null;
  fromCalendarFile: boolean;
  snippet: string;
  charStart: number;
  charEnd: number;
  page: number | null;
  lowConfidence: boolean;
  past: boolean;
  /** The title of an existing item that looks like this one. */
  duplicateOf: string | null;
}

export interface CardContext {
  fileIndex: number;
  syllabus: boolean;
  fromCalendarFile: boolean;
  eventTypes: EventType[];
  events: Event[];
  tasks: Task[];
  /** For a PDF: the page a position in the text is on. */
  pageOf?: (charIndex: number) => number | null;
}

/** Turn what was found into cards to review. */
export function makeCards(items: ExtractedItem[], ctx: CardContext): Card[] {
  const typeIdByName = new Map(ctx.eventTypes.map((t) => [t.name, t.id]));
  return items.map((item) => {
    const kind: CardKind = ctx.syllabus && item.isDeadline ? 'task' : 'event';
    const duplicateOf = findDuplicate(item, ctx.events, ctx.tasks);
    const lowConfidence = item.lowConfidence;
    return {
      key: `${ctx.fileIndex}:${item.id}`,
      fileIndex: ctx.fileIndex,
      include: !lowConfidence && !item.past && duplicateOf === null,
      kind,
      title: item.title,
      time: toTimeFields(item.start, item.end, item.allDay),
      typeId: (item.typeName && typeIdByName.get(item.typeName)) || '',
      calendarId: '',
      location: item.location ?? '',
      link: item.link ?? '',
      notes: item.notes ?? '',
      reminders: kind === 'task' && ctx.syllabus ? [...SYLLABUS_REMINDERS] : [],
      recurrence: item.recurrence ?? null,
      fromCalendarFile: ctx.fromCalendarFile,
      snippet: item.snippet,
      charStart: item.charStart,
      charEnd: item.charEnd,
      page: ctx.pageOf?.(item.charStart) ?? null,
      lowConfidence,
      past: item.past,
      duplicateOf,
    };
  });
}

interface Extras {
  courseId: string | null;
}

/** The event this card would create. (Its link has been checked by the caller.) */
export function toEventInput(card: Card, link: string | null, { courseId }: Extras): CreateEventInput {
  const { start, end } = fromTimeFields(card.time);
  return {
    title: card.title.trim(),
    start,
    end,
    allDay: card.time.allDay,
    calendarId: card.calendarId || null,
    typeId: card.typeId || null,
    location: card.location.trim() || null,
    link,
    notes: card.notes.trim() || null,
    recurrence: card.recurrence,
    courseId,
    source: card.fromCalendarFile ? 'ics-import' : 'file-import',
  };
}

/** The to-do this card would create: due on its start date, at its start time if it has one. */
export function toTaskInput(card: Card, { courseId }: Extras): CreateTaskInput {
  return {
    title: card.title.trim(),
    dueDate: card.time.startDate,
    dueTime: card.time.allDay ? null : card.time.startTime,
    calendarId: card.calendarId || null,
    courseId,
    reminders: card.reminders,
    notes: [card.location.trim() && `Where: ${card.location.trim()}`, card.link.trim()].filter(Boolean).join('\n') || null,
    source: card.fromCalendarFile ? 'ics-import' : 'file-import',
    sourceSnippet: card.snippet.slice(0, 2000) || null,
  };
}

/** The same thing found in more than one place (a flyer attached as a picture AND a PDF): the later copies are flagged and left unchecked, so you don't add it twice. */
export function flagRepeats(cards: Card[]): Card[] {
  return cards.map((card, i) => {
    if (card.duplicateOf) return card;
    const earlier = cards.slice(0, i).find((c) => c.time.startDate === card.time.startDate && titlesAlike(c.title, card.title));
    return earlier ? { ...card, include: false, duplicateOf: `${earlier.title}”, found above in this import` } : card;
  });
}
