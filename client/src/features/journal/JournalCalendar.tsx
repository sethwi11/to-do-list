import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { JournalEntry } from '@todo/shared';
import { cx } from '../../lib/cx';
import { fullDate } from '../../lib/dates';
import { ratingShade } from '../../lib/journal';
import { monthGrid, shiftMonth } from '../../lib/monthGrid';
import { Button, IconButton } from '../../ui/Button';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  month: { year: number; month: number };
  onMonth: (month: { year: number; month: number }) => void;
  entries: ReadonlyMap<string, JournalEntry>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

/** A month to click through: days you wrote about are shaded by their score (darker is a better day), and a day with words but no score has a dot. Days that haven't happened yet can't be picked. */
export function JournalCalendar({ month, onMonth, entries, selected, today, onSelect }: Props) {
  const todayMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  return (
    <section aria-label="Journal calendar">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-title" aria-live="polite">
          {MONTHS[month.month - 1]} <span className="font-mono text-meta text-ink-muted">{month.year}</span>
        </h2>
        <div className="flex items-center">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => onMonth(shiftMonth(month.year, month.month, -1))} />
          <Button variant="ghost" disabled={month.year === todayMonth.year && month.month === todayMonth.month} onClick={() => onMonth(todayMonth)}>
            This month
          </Button>
          <IconButton icon={ChevronRight} label="Next month" disabled={month.year * 12 + month.month >= todayMonth.year * 12 + todayMonth.month} onClick={() => onMonth(shiftMonth(month.year, month.month, 1))} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden className="py-1 font-mono text-time text-ink-muted">
            {d}
          </span>
        ))}
        {monthGrid(month.year, month.month).map((c) => {
          const e = entries.get(c.date);
          const wrote = !!e && (e.text.trim() !== '' || e.rating !== null);
          const future = c.date > today;
          const note = !wrote ? '' : e.rating !== null ? `, scored ${e.rating} of 10` : ', has notes';
          return (
            <button
              key={c.date}
              type="button"
              disabled={future}
              aria-label={`${fullDate(c.date)}${note}`}
              aria-current={c.date === today ? 'date' : undefined}
              aria-pressed={c.date === selected}
              onClick={() => onSelect(c.date)}
              style={wrote && e.rating !== null ? { backgroundColor: `var(--heat-${ratingShade(e.rating)})` } : undefined}
              className={cx(
                'relative grid h-12 place-items-center border font-mono text-time transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:text-ink-faint',
                c.date === selected ? 'border-ink' : 'border-hairline hover:border-ink-muted',
                !c.inMonth && 'text-ink-muted',
                c.date === today && 'font-semibold',
              )}
            >
              <span>{c.day}</span>
              {wrote && (
                <span aria-hidden className="absolute bottom-0.5 text-[10px] leading-none text-ink">
                  {e.rating ?? '•'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-meta text-ink-muted">Darker means a better day. A dot means you wrote but didn’t score it.</p>
    </section>
  );
}
