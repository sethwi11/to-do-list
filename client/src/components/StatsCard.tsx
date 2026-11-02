import { Flame } from 'lucide-react';
import type { Stats } from '../lib/stats';

/** Completions per day this week as a tiny bar chart, plus the current streak. */
export function StatsCard({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.week.map((d) => d.count));
  const total = stats.week.reduce((sum, d) => sum + d.count, 0);

  return (
    <section aria-labelledby="stats-heading" className="px-3">
      <div className="flex items-baseline justify-between">
        <h2 id="stats-heading" className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          This week
        </h2>
        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title="Days in a row with at least one task done">
          <Flame className={`h-3.5 w-3.5 ${stats.streak > 0 ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600'}`} aria-hidden />
          {stats.streak}-day streak
        </span>
      </div>
      {/* The bars are decorative; the visually hidden list carries the same data for screen readers. */}
      <div className="mt-2 flex h-10 items-end gap-1" aria-hidden>
        {stats.week.map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${i === stats.week.length - 1 ? 'bg-indigo-500' : d.count ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-800'}`}
              style={{ height: `${d.count ? Math.max(6, (d.count / max) * 28) : 3}px` }}
              title={`${d.date}: ${d.count}`}
            />
            <span className="text-[10px] leading-none text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {total} done this week · {stats.completedToday} today
      </p>
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
