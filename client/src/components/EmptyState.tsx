import type { View } from '../lib/views';

const smartCopy = {
  today: ['Nothing due today', 'Add a task above. It will be due today by default.'],
  upcoming: ['Nothing in the next 7 days', 'Tasks due tomorrow through next week show up here.'],
  overdue: ['Nothing overdue', "You're all caught up. Nice."],
  all: ['No tasks yet', 'Type your first task in the box above and press Enter.'],
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
    ? ['No tasks match your filters', 'Try a different search, or clear the filters.']
    : view.type === 'category'
      ? ['This list is empty', 'Add a task above. It will go into this list.']
      : smartCopy[view.id];

  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      {filtered && (
        <button type="button" onClick={onClearFilters} className="mt-3 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Clear filters
        </button>
      )}
    </div>
  );
}
