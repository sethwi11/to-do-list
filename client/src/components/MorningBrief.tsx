import type { Priority, Task } from '@todo/shared';

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** First-open-of-the-day summary: due today, overdue, and the top 3 priorities. */
export function MorningBrief({ tasks, today, onDismiss, onPlan }: { tasks: Task[]; today: string; onDismiss: () => void; onPlan: () => void }) {
  const open = tasks.filter((t) => t.status === 'todo');
  const dueToday = open.filter((t) => t.dueDate === today);
  const overdue = open.filter((t) => t.dueDate !== null && t.dueDate < today);
  const top = [...overdue, ...dueToday, ...open.filter((t) => t.dueDate === null && t.priority === 'high')]
    .sort((a, b) => RANK[a.priority] - RANK[b.priority])
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <section aria-labelledby="brief-heading" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/50">
      <div className="flex items-start justify-between gap-2">
        <h2 id="brief-heading" className="font-semibold">
          {greeting}! Here's your day.
        </h2>
        <button type="button" onClick={onDismiss} aria-label="Dismiss the daily brief" className="rounded px-1.5 text-slate-500 hover:bg-indigo-100 dark:hover:bg-indigo-900">
          ✕
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        <strong>{dueToday.length}</strong> due today
        {overdue.length > 0 && (
          <>
            {' · '}
            <strong className="text-red-600 dark:text-red-400">{overdue.length}</strong> overdue
          </>
        )}
      </p>
      {top.length > 0 ? (
        <ol className="mt-2 list-decimal pl-5 text-sm">
          {top.map((t) => (
            <li key={t.id}>
              {t.title} <span className="text-xs text-slate-500">({t.priority})</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nothing urgent. Add something, or enjoy the free time.</p>
      )}
      {dueToday.length + overdue.length > 0 && (
        <button type="button" onClick={onPlan} className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
          Plan my day
        </button>
      )}
    </section>
  );
}
