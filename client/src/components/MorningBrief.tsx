import { Sunrise, X } from 'lucide-react';
import type { Priority, Task } from '@todo/shared';

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** First-open-of-the-day summary: due today, overdue, and the top 3 priorities, in one slim banner. */
export function MorningBrief({ tasks, today, onDismiss }: { tasks: Task[]; today: string; onDismiss: () => void }) {
  const open = tasks.filter((t) => t.status === 'todo');
  const dueToday = open.filter((t) => t.dueDate === today);
  const overdue = open.filter((t) => t.dueDate !== null && t.dueDate < today);
  const top = [...overdue, ...dueToday, ...open.filter((t) => t.dueDate === null && t.priority === 'high')]
    .sort((a, b) => RANK[a.priority] - RANK[b.priority])
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <section aria-labelledby="brief-heading" className="flex items-start gap-3 rounded-2xl bg-indigo-50/80 px-4 py-3 dark:bg-indigo-950/40">
      <Sunrise className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <h2 id="brief-heading" className="font-medium">
          {greeting}. {dueToday.length} due today
          {overdue.length > 0 && <span className="whitespace-nowrap text-red-600 dark:text-red-400"> · {overdue.length} overdue</span>}
        </h2>
        <p className="mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-400">
          {top.length > 0 ? <>Start with {top.map((t) => t.title).join(', ')}.</> : 'Nothing urgent. Enjoy the free time.'}
        </p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss the daily brief" className="icon-btn -my-1 -mr-2 h-7 w-7 hover:bg-indigo-100 dark:hover:bg-indigo-900">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
