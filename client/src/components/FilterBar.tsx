import { PRIORITIES, type Category } from '@todo/shared';
import { DEFAULT_FILTERS, isFiltering, SORT_MODES, type Filters, type SortMode } from '../lib/filters';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  categories: Category[];
  /** Hide filters the current view already decides (e.g. list filter inside a list view). */
  hideCategory: boolean;
  hideStatus: boolean;
}

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900';

export function FilterBar({ filters, onChange, sortMode, onSortChange, categories, hideCategory, hideStatus }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <label htmlFor="task-search" className="sr-only">
        Search tasks
      </label>
      <input
        id="task-search"
        type="search"
        value={filters.query}
        onChange={(e) => set('query', e.target.value)}
        placeholder="Search…"
        className={`${selectClass} w-full`}
      />

      <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => set('priority', e.target.value as Filters['priority'])} className={selectClass}>
        <option value="any">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p[0]!.toUpperCase() + p.slice(1)}
          </option>
        ))}
      </select>

      {!hideCategory && (
        <select aria-label="Filter by list" value={filters.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={selectClass}>
          <option value="any">Any list</option>
          <option value="none">No list</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {!hideStatus && (
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])} className={selectClass}>
          <option value="any">Open &amp; done</option>
          <option value="todo">Open only</option>
          <option value="done">Done only</option>
        </select>
      )}

      <select aria-label="Filter by due date" value={filters.due} onChange={(e) => set('due', e.target.value as Filters['due'])} className={selectClass}>
        <option value="any">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="tomorrow">Due tomorrow</option>
        <option value="week">Due within 7 days</option>
        <option value="none">No due date</option>
      </select>

      <select aria-label="Sort by" value={sortMode} onChange={(e) => onSortChange(e.target.value as SortMode)} className={selectClass}>
        {SORT_MODES.map((m) => (
          <option key={m.id} value={m.id}>
            Sort: {m.label}
          </option>
        ))}
      </select>

      {isFiltering(filters) && (
        <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="rounded-lg px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950">
          Clear filters
        </button>
      )}
    </div>
  );
}
