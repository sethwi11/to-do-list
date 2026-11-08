import { addDays, datePart, expandOccurrences, type Event, type Task } from '@todo/shared';

/** Lower-case words only: "Quiz #2 (Ch. 1-3)" -> ["quiz", "2", "ch", "1", "3"]. */
const words = (title: string) => title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Whether two titles are probably the same thing: identical, one inside the other ("Midterm" and "Midterm exam"), or sharing most of their words. */
export function titlesAlike(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (x.length === 0 || y.length === 0) return false;
  const joinedA = x.join(' ');
  const joinedB = y.join(' ');
  if (joinedA === joinedB) return true;
  if (Math.min(joinedA.length, joinedB.length) >= 4 && (joinedA.includes(joinedB) || joinedB.includes(joinedA))) return true;
  const shared = x.filter((w) => y.includes(w)).length;
  return shared / new Set([...x, ...y]).size >= 0.6;
}

/** The title of an existing event or to-do on the same day with a similar title, or null. */
export function findDuplicate(candidate: { title: string; start: string; end: string }, events: Event[], tasks: Task[]): string | null {
  const first = datePart(candidate.start);
  const lastExclusive = candidate.end > candidate.start && datePart(candidate.end) > first ? datePart(candidate.end) : addDays(first, 1);
  const clash = expandOccurrences(events, first, lastExclusive).find((o) => titlesAlike(o.event.title, candidate.title));
  if (clash) return clash.event.title;
  return tasks.find((t) => t.dueDate !== null && t.dueDate >= first && t.dueDate < lastExclusive && titlesAlike(t.title, candidate.title))?.title ?? null;
}
