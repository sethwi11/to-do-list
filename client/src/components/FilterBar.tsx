import { useState } from 'react';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { PRIORITIES, type Calendar } from '@todo/shared';
import { DEFAULT_FILTERS, SORT_MODES, type Filters, type SortMode } from '../lib/filters';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  calendars: Calendar[];
  /** Hide filters the current view already decides (e.g. list filter inside a list view). */
  hideCalendar: boolean;
  hideStatus: boolean;
}

/**
 * Search is always visible; the rest of the filters live behind one
 * "Filters" button (with a count of active ones), since they're used rarely
 * and five always-visible dropdowns are mostly noise.
 */
export function FilterBar({ filters, onChange, sortMode, onSortChange, calendars, hideCalendar, hideStatus }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  const activeCount = (['priority', 'calendarId', 'status', 'due'] as const).filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;
  const showPanel = open || activeCount > 0;

  return (
    <div className="flex flex-col gap-2">
      <div role="search" className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <input
            id="task-search"
            type="search"
            value={filters.query}
            onChange={(e) => set('query', e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg bg-transparent py-1.5 pr-2 pl-8 text-sm hover:bg-slate-100 focus:bg-white dark:hover:bg-slate-900 dark:focus:bg-slate-900"
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          aria-expanded={showPanel}
          aria-controls="filter-panel"
          className={`pill ${activeCount ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] tabular-nums text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
              {activeCount}
            </span>
          )}
        </button>

        <span className="inline-flex items-center">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <select aria-label="Sort by" value={sortMode} onChange={(e) => onSortChange(e.target.value as SortMode)} className="select-quiet">
            {SORT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      {showPanel && (
        <div id="filter-panel" className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100/70 px-2 py-1.5 dark:bg-slate-900">
          <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => set('priority', e.target.value as Filters['priority'])} className="select-quiet">
            <option value="any">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0]!.toUpperCase() + p.slice(1)} priority
              </option>
            ))}
          </select>

          {!hideCalendar && (
            <select aria-label="Filter by calendar" value={filters.calendarId} onChange={(e) => set('calendarId', e.target.value)} className="select-quiet">
              <option value="any">Any calendar</option>
              <option value="none">No calendar</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {!hideStatus && (
            <select aria-label="Filter by status" value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])} className="select-quiet">
              <option value="any">Open &amp; done</option>
              <option value="todo">Open only</option>
              <option value="done">Done only</option>
            </select>
          )}

          <select aria-label="Filter by due date" value={filters.due} onChange={(e) => set('due', e.target.value as Filters['due'])} className="select-quiet">
            <option value="any">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="tomorrow">Due tomorrow</option>
            <option value="week">Due within 7 days</option>
            <option value="none">No due date</option>
          </select>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange({ ...DEFAULT_FILTERS, query: filters.query });
                setOpen(false);
              }}
              className="pill ml-auto text-indigo-600 dark:text-indigo-400"
            >
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
