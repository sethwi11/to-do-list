import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Course, CreateTaskInput, Event, EventType, IcsResult, Task } from '@todo/shared';
import { attachmentsApi } from '../../api/attachments';
import type { ImportOptions } from '../../app/AppContext';
import type { EventActions } from '../../app/useEventActions';
import { fileProblem, kindOf, type FileKind } from '../../lib/files/fileTypes';
import { createOcr } from '../../lib/files/ocr';
import { pageAt, readFileText } from '../../lib/files/readers';
import { fromTimeFields, normalizeLink, timeProblem } from '../events/eventForm';
import { flagRepeats, makeCards, toEventInput, toTaskInput, type Card } from './cards';

export interface FileEntry {
  file: File;
  kind: FileKind | null;
  status: 'waiting' | 'reading' | 'done' | 'failed';
  step: string;
  fraction: number | null;
  error: string | null;
  text: string;
  pageStarts: number[] | null;
  pageCount: number | null;
  usedOcr: boolean;
  ics: IcsResult | null;
}

export interface Session {
  entries: FileEntry[];
  phase: 'reading' | 'review' | 'saving';
  /** The headline while reading: "Reading file…", "Finding dates…". */
  stage: string;
  syllabus: boolean;
  courseId: string;
  cards: Card[];
  /** Things worth telling the person (an .ics repeat that was written out, old events left out). */
  notes: string[];
  /** Card key -> what's wrong with it, shown after a failed attempt to add. */
  errors: Record<string, string>;
}

export interface ImportDeps {
  eventTypes: EventType[];
  events: Event[];
  tasks: Task[];
  courses: Course[];
  createEvents: EventActions['createEvents'];
  addTasks: (inputs: CreateTaskInput[]) => Promise<{ ids: string[]; undo: () => Promise<void> }>;
  showToast: (message: string, onUndo?: () => void) => void;
}

const blankEntry = (file: File): FileEntry => ({
  file,
  kind: kindOf(file),
  status: 'waiting',
  step: 'Waiting…',
  fraction: null,
  error: null,
  text: '',
  pageStarts: null,
  pageCount: null,
  usedOcr: false,
  ics: null,
});

/** The first reason a card can't be saved yet, or null. */
export function cardProblem(card: Card): string | null {
  if (!card.title.trim()) return 'Give it a title.';
  if (!card.time.startDate) return card.kind === 'task' ? 'Choose a due date.' : 'Choose a date.';
  if (card.kind === 'event') {
    const timing = timeProblem(card.time);
    if (timing) return timing;
    const [, linkProblem] = normalizeLink(card.link);
    if (linkProblem) return linkProblem;
  }
  return null;
}

/**
 * Everything about adding events from files, in order: read each file (OCR, PDF, Word, text, calendar),
 * find what's in it, let the person review and edit, then save. Nothing is saved, and no file is uploaded,
 * until "Add" is pressed.
 */
export function useImportSession(deps: ImportDeps) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const run = useRef(0); // each import gets a number, so a cancelled one can tell it has been cancelled
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // The date-finding code is big, so it's fetched when the first import starts, not with the page.
  const extractor = useRef<typeof import('@todo/shared/extract') | null>(null);

  /** Work out the cards from what the files said. Quick, so it can be redone when "syllabus" is switched. */
  const buildCards = useCallback((entries: FileEntry[], syllabus: boolean): { cards: Card[]; notes: string[] } => {
    const d = depsRef.current;
    const now = new Date();
    const cards: Card[] = [];
    const notes: string[] = [];
    entries.forEach((entry, fileIndex) => {
      if (entry.status !== 'done') return;
      const ics = entry.kind === 'ics' ? entry.ics : null;
      const items = ics ? ics.items : extractor.current!.extractEvents(entry.text, { now, syllabus });
      if (ics) {
        notes.push(...ics.notes);
        if (ics.skippedOld > 0) notes.push(`${ics.skippedOld} older ${ics.skippedOld === 1 ? 'event' : 'events'} in “${entry.file.name}” ${ics.skippedOld === 1 ? 'was' : 'were'} left out because ${ics.skippedOld === 1 ? 'it is' : 'they are'} over.`);
        if (ics.truncated) notes.push(`“${entry.file.name}” has more events than fit in one review, so only the first 500 are shown.`);
      }
      cards.push(
        ...makeCards(items, {
          fileIndex,
          syllabus: syllabus && !ics,
          fromCalendarFile: ics !== null,
          eventTypes: d.eventTypes,
          events: d.events,
          tasks: d.tasks,
          pageOf: (i) => pageAt(entry.pageStarts, i),
        }),
      );
    });
    return { cards: flagRepeats(cards), notes };
  }, []);

  /** Cards with no calendar yet take the course's calendar, so a syllabus lands on the right one without picking it per card. */
  const withCourseCalendar = useCallback(
    (cards: Card[], courseId: string): Card[] => {
      const calendarId = depsRef.current.courses.find((c) => c.id === courseId)?.calendarId;
      return calendarId ? cards.map((c) => (c.calendarId ? c : { ...c, calendarId })) : cards;
    },
    [],
  );

  const start = useCallback(
    async (files: File[], options?: ImportOptions) => {
      if (files.length === 0) return;
      const id = ++run.current;
      const alive = () => run.current === id;
      const entries = files.map(blankEntry);
      const loading = import('@todo/shared/extract').then((m) => (extractor.current = m));
      // Files that can't be used say so right away; the others carry on.
      entries.forEach((e) => {
        const problem = fileProblem(e.file);
        if (problem) Object.assign(e, { status: 'failed', error: problem, step: 'Skipped' });
      });
      const patch = (index: number, change: Partial<FileEntry>) => {
        Object.assign(entries[index]!, change);
        if (alive()) setSession((s) => s && { ...s, entries: [...entries] });
      };
      const syllabus = options?.syllabus ?? false;
      const courseId = options?.courseId ?? '';
      setSession({ entries: [...entries], phase: 'reading', stage: 'Reading file…', syllabus, courseId, cards: [], notes: [], errors: {} });

      const ocr = createOcr();
      try {
        for (let i = 0; i < entries.length && alive(); i++) {
          if (entries[i]!.status === 'failed') continue;
          patch(i, { status: 'reading', step: 'Reading file…' });
          try {
            const result = await readFileText(entries[i]!.file, ocr, (p) => alive() && patch(i, { step: p.step, fraction: p.fraction }));
            if (!alive()) return;
            let ics: IcsResult | null = null;
            if (result.kind === 'ics') {
              patch(i, { step: 'Finding events…', fraction: null });
              ics = (await loading).importIcs(result.text, { now: new Date() });
            }
            patch(i, { status: 'done', step: 'Done', fraction: 1, text: result.text, pageStarts: result.pageStarts, pageCount: result.pageCount, usedOcr: result.usedOcr, ics });
          } catch (err) {
            patch(i, { status: 'failed', step: 'Failed', error: err instanceof Error ? err.message : 'That file couldn’t be read.' });
          }
        }
      } finally {
        void ocr.terminate();
      }
      await loading;
      if (!alive()) return;
      setSession((s) => s && { ...s, stage: 'Finding dates…' });
      await new Promise((r) => setTimeout(r, 0)); // let "Finding dates…" paint before the (quick) work
      if (!alive()) return;
      const { cards, notes } = buildCards(entries, syllabus);
      setSession((s) => s && { ...s, phase: 'review', cards: withCourseCalendar(cards, courseId), notes, entries: [...entries] });
    },
    [buildCards, withCourseCalendar],
  );

  const cancel = useCallback(() => {
    run.current++;
    setSession(null);
  }, []);

  const setSyllabus = useCallback(
    (syllabus: boolean) =>
      setSession((s) => {
        if (!s) return s;
        const { cards, notes } = buildCards(s.entries, syllabus);
        return { ...s, syllabus, cards, notes, errors: {} };
      }),
    [buildCards],
  );

  const setCourse = useCallback((courseId: string) => setSession((s) => s && { ...s, courseId, cards: withCourseCalendar(s.cards, courseId) }), [withCourseCalendar]);

  const updateCard = useCallback(
    (key: string, patch: Partial<Card>) =>
      setSession((s) => {
        if (!s) return s;
        const errors = { ...s.errors };
        delete errors[key]; // they're editing it: the old complaint no longer applies
        return { ...s, errors, cards: s.cards.map((c) => (c.key === key ? { ...c, ...patch } : c)) };
      }),
    [],
  );

  const setAllIncluded = useCallback((include: boolean) => setSession((s) => s && { ...s, cards: s.cards.map((c) => ({ ...c, include })) }), []);

  /** Save the checked cards (or every card). Resolves to false if something needs fixing first. */
  const save = useCallback(
    async (which: 'selected' | 'all'): Promise<boolean> => {
      const s = session;
      if (!s) return false;
      const chosen = s.cards.filter((c) => which === 'all' || c.include);
      if (chosen.length === 0) return false;

      const errors: Record<string, string> = {};
      for (const c of chosen) {
        const problem = cardProblem(c);
        if (problem) errors[c.key] = problem;
      }
      if (Object.keys(errors).length > 0) {
        setSession({ ...s, errors, cards: which === 'all' ? s.cards.map((c) => ({ ...c, include: true })) : s.cards });
        return false;
      }

      setSession({ ...s, phase: 'saving', errors: {} });
      const d = depsRef.current;
      const courseId = s.courseId || null;
      try {
        // 1. Keep the originals: one upload per file that has something being added from it.
        const uploaded = new Map<number, string>();
        for (const index of new Set(chosen.map((c) => c.fileIndex))) {
          uploaded.set(index, (await attachmentsApi.upload(s.entries[index]!.file)).id);
        }

        // 2. Make the events (one batch) and the to-dos.
        const eventCards = chosen.filter((c) => c.kind === 'event').map((c) => ({ card: c, id: crypto.randomUUID() }));
        const taskCards = chosen.filter((c) => c.kind === 'task').map((c) => ({ card: c, id: crypto.randomUUID() }));
        const eventsDone = eventCards.length
          ? await d.createEvents(eventCards.map(({ card, id }) => ({ ...toEventInput(card, normalizeLink(card.link)[0], { courseId }), id })))
          : { ids: [] as string[], undo: async () => undefined };
        if (!eventsDone) throw new Error('The events couldn’t be saved.');
        const tasksDone = taskCards.length ? await d.addTasks(taskCards.map(({ card, id }) => ({ ...toTaskInput(card, { courseId }), id }))) : { ids: [] as string[], undo: async () => undefined };

        // 3. Attach each file to the things made from it (and a syllabus to its course, so it's on the course's page).
        const links = [
          ...(s.syllabus && courseId ? [...uploaded.entries()].filter(([index]) => s.entries[index]!.kind !== 'ics').map(([, attachmentId]) => attachmentsApi.link(attachmentId, { ownerType: 'course', ownerId: courseId })) : []),
          ...eventCards.map(({ card, id }) => attachmentsApi.link(uploaded.get(card.fileIndex)!, { ownerType: 'event', ownerId: id })),
          ...taskCards.map(({ card, id }) => attachmentsApi.link(uploaded.get(card.fileIndex)!, { ownerType: 'task', ownerId: id })),
        ];
        await Promise.allSettled(links);
        void qc.invalidateQueries({ queryKey: ['attachments'] }); // pages showing an item's files should notice the new ones

        const parts = [eventCards.length && `${eventCards.length} ${eventCards.length === 1 ? 'event' : 'events'}`, taskCards.length && `${taskCards.length} ${taskCards.length === 1 ? 'to-do' : 'to-dos'}`].filter(Boolean);
        d.showToast(`Added ${parts.join(' and ')}`, () => {
          void eventsDone.undo();
          void tasksDone.undo();
        });
        run.current++;
        setSession(null);
        return true;
      } catch (err) {
        d.showToast(err instanceof Error ? err.message : 'That couldn’t be saved.');
        setSession((cur) => cur && { ...cur, phase: 'review' });
        return false;
      }
    },
    [session, qc],
  );

  return { session, start, cancel, setSyllabus, setCourse, updateCard, setAllIncluded, save };
}

/** Handy for the review: how the card's dates read in the form. */
export const cardSpan = (card: Card) => fromTimeFields(card.time);
