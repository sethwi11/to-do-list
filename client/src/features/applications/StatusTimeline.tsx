import { daysBetween, localDateOf, type Application } from '@todo/shared';
import { cx } from '../../lib/cx';
import { longDate } from './format';

/**
 * Where an application has been: each status it has had, the day it changed, and how long it stayed. The server
 * writes this; there's nothing here to edit (a wrong click is fixed by moving it back, which the server tidies up).
 */
export function StatusTimeline({ application, today }: { application: Application; today: string }) {
  const entries = application.statusHistory;
  return (
    <ol aria-label="Status timeline" className="border-l border-rule">
      {entries.map((entry, i) => {
        const day = localDateOf(entry.date);
        const current = i === entries.length - 1;
        const stayed = daysBetween(day, current ? today : localDateOf(entries[i + 1]!.date));
        return (
          <li key={`${entry.status}-${entry.date}`} className="relative pb-4 pl-5 last:pb-0">
            {/* The square marks where it is now; earlier stops are hollow. */}
            <span aria-hidden className={cx('absolute top-1.5 -left-[5px] size-[9px] border border-ink', current ? 'bg-accent' : 'bg-paper')} />
            <p className="text-body">
              <span className={current ? 'font-medium' : undefined}>{entry.status}</span>
              {current && <span className="ml-2 text-meta text-accent-ink">now</span>}
            </p>
            <p className="font-mono text-meta text-ink-muted">
              {longDate(day)}
              <span className="font-sans"> · {stayed <= 0 ? (current ? 'today' : 'same day') : `${stayed} day${stayed === 1 ? '' : 's'}${current ? ' so far' : ''}`}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
