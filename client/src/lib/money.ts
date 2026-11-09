import { addDays, type BudgetSettings, type Period } from '@todo/shared';
import { shortDate } from './dates';

/** An amount as you'd type it into a field: "12.50". */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2);

/** "November 2026", or "Nov 2 – Nov 8" for a week. */
export function periodTitle(p: Period, kind: BudgetSettings['period']): string {
  if (kind === 'week') return `${shortDate(p.start)} – ${shortDate(addDays(p.end, -1))}`;
  return new Date(`${p.start}T12:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Just the month's name ("October"), or the week's range. */
export const periodShort = (p: Period, kind: BudgetSettings['period']) => (kind === 'week' ? periodTitle(p, kind) : new Date(`${p.start}T12:00`).toLocaleDateString('en-US', { month: 'long' }));

export const HOLDING_LABEL = { stock: 'Stock', etf: 'ETF', crypto: 'Crypto', savings: 'Savings', 'real-estate': 'Real estate', other: 'Other' } as const;
