import { Flame } from 'lucide-react';
import type { Stats } from '../../lib/stats';
import { SectionLabel } from '../../ui/fields';

/** Tasks completed per day over the last week, and the current streak. */
export function StatsBlock({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.week.map((d) => d.count));
  const total = stats.week.reduce((sum, d) => sum + d.count, 0);

  return (
    <section aria-label="This week">
      <SectionLabel>This week</SectionLabel>
      <div className="mt-4 flex items-end gap-8">
        {/* The bars are decorative; the visually hidden list below carries the same numbers. */}
        <div aria-hidden className="flex h-16 items-end gap-2">
          {stats.week.map((d, i) => (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div
                className={i === stats.week.length - 1 ? 'w-5 bg-ink' : d.count ? 'w-5 bg-ink-muted' : 'w-5 bg-hairline'}
                style={{ height: `${d.count ? Math.max(6, (d.count / max) * 40) : 3}px` }}
                title={`${d.date}: ${d.count}`}
              />
              <span className="font-mono text-time text-ink-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="pb-5 text-meta text-ink-muted">
          <p>
            <span className="font-mono text-ink tabular-nums">{total}</span> done this week
          </p>
          <p>
            <span className="font-mono text-ink tabular-nums">{stats.completedToday}</span> done today
          </p>
          <p className="inline-flex items-center gap-1">
            <Flame className="size-4" aria-hidden />
            {/* One element, so the flex gap doesn't open a space inside "1-day". */}
            <span>
              <span className="font-mono text-ink tabular-nums">{stats.streak}</span>-day streak
            </span>
          </p>
        </div>
      </div>
      <ul className="sr-only">
        {stats.week.map((d) => (
          <li key={d.date}>
            {d.date}: {d.count} completed
          </li>
        ))}
      </ul>
    </section>
  );
}
