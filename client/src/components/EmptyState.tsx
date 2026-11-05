import { CheckCircle2, SearchX } from 'lucide-react';
import type { View } from '../lib/views';

const smartCopy = {
  today: ['Nothing due today', 'Add a task above and it will be due today.'],
  upcoming: ['Nothing in the next 7 days', 'Tasks due tomorrow through next week show up here.'],
  overdue: ['Nothing overdue', "You're all caught up."],
  all: ['No tasks yet', 'Add your first task in the box above.'],
  completed: ['Nothing completed yet', 'Tasks you check off land here.'],
} as const;

interface Props {
  view: View;
  /** True when filters/search are hiding tasks that would otherwise show. */
  filtered: boolean;
  onClearFilters: () => void;
}

export function EmptyState({ view, filtered, onClearFilters }: Props) {
  const [title, hint] = filtered
    ? ['No matching tasks', 'Try a different search, or clear the filters.']
    : view.type === 'calendar'
      ? ['This calendar is empty', 'Add a task above and it goes into this calendar.']
      : smartCopy[view.id];
  const Icon = filtered ? SearchX : CheckCircle2;

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon className="h-10 w-10 text-slate-300 dark:text-slate-700" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{hint}</p>
      {filtered && (
        <button type="button" onClick={onClearFilters} className="mt-3 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Clear filters
        </button>
      )}
    </div>
  );
}
