import { addDays, type Semester } from '@todo/shared';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon, Wed, Fri", or "Mon–Fri" when it is exactly the five weekdays. */
export function describeMeetingDays(days: readonly number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.join() === '1,2,3,4,5') return 'Mon–Fri';
  return set.map((d) => DAY_SHORT[d]).join(', ');
}

/**
 * The semester to show first: the one you're in now, else the one that starts soonest after today, else the most
 * recent one. Archived semesters are never chosen for you.
 */
export function currentSemester(semesters: readonly Semester[], today: string): Semester | undefined {
  const live = semesters.filter((s) => !s.archived);
  return (
    live.find((s) => s.startDate <= today && today <= s.endDate) ??
    [...live].filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ??
    [...live].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  );
}

export interface SemesterDraft {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * A starting point for "New semester", so the form isn't blank: the usual Fall / Spring / Summer dates for
 * the time of year. They are only a suggestion; every date is editable.
 */
export function suggestSemester(today: string): SemesterDraft {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (month <= 5) return { name: `Spring ${year}`, startDate: `${year}-01-12`, endDate: `${year}-05-08` };
  if (month <= 7) return { name: `Summer ${year}`, startDate: `${year}-06-01`, endDate: `${year}-07-31` };
  return { name: `Fall ${year}`, startDate: `${year}-08-24`, endDate: `${year}-12-11` };
}

/** The Thursday-to-Sunday of Thanksgiving week (US: the 4th Thursday of November), as a break to offer. */
export function thanksgivingBreak(year: number): { start: string; end: string; label: string } {
  const first = `${year}-11-01`;
  const dow = new Date(`${first}T12:00`).getDay(); // 0 = Sunday
  const firstThursday = addDays(first, (4 - dow + 7) % 7);
  const thursday = addDays(firstThursday, 21);
  return { start: thursday, end: addDays(thursday, 3), label: 'Thanksgiving' };
}
