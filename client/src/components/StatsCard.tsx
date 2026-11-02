import type { Stats } from '../lib/stats';

/** Completions per day this week as a tiny bar chart, plus the current streak. */
export function StatsCard({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.week.map((d) => d.count));
  const total = stats.week.reduce((sum, d) => sum + d.count, 0);

  return (
    <section aria-labelledby="stats-heading" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline justify-between">
        <h2 id="stats-heading" className="font-semibold">
          This week
        </h2>
        <span className="text-sm text-slate-500">
          🔥 {stats.streak}-day streak
        </span>
      </div>
      {/* The bars are decorative; the text list below carries the same data for screen readers. */}
      <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden>
        {stats.week.map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${i === stats.week.length - 1 ? 'bg-indigo-500' : 'bg-indigo-300 dark:bg-indigo-700'}`}
              style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / max) * 64)}px` }}
              title={`${d.date}: ${d.count}`}
            />
            <span className="text-[10px] text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{total} completed in the last 7 days · {stats.completedToday} today</p>
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
