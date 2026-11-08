import { addDays, dayOfWeek } from '@todo/shared';

export interface MonthCell {
  date: string; // "YYYY-MM-DD"
  day: number;
  inMonth: boolean;
}

/** The cells of a month calendar: whole weeks (Sunday first), padded with days from the neighboring months so every row is full. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = addDays(first, -dayOfWeek(first));
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    const inMonth = date.slice(0, 7) === first.slice(0, 7);
    // Stop after the week that contains the month's last day.
    if (i % 7 === 0 && i >= 28 && !inMonth) break;
    cells.push({ date, day: Number(date.slice(8)), inMonth });
  }
  return cells;
}

/** Month `delta` months away from year/month (month 1-12), handling year boundaries. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
