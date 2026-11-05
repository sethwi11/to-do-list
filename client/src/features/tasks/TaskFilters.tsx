import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PRIORITIES, type Calendar } from '@todo/shared';
import { DEFAULT_FILTERS, SORT_MODES, type Filters, type SortMode } from '../../lib/filters';
import { Button } from '../../ui/Button';
import { Input, Select } from '../../ui/fields';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  calendars: Calendar[];
  /** Hide filters that the page already decides (the calendar filter when viewing one calendar). */
  hideCalendar?: boolean;
  hideStatus?: boolean;
}

/**
 * Search is always visible; the other filters sit behind one "Filters" button (with a count
 * of the active ones), because they're used occasionally and four always-open menus are noise.
 */
export function TaskFilters({ filters, onChange, sortMode, onSortChange, calendars, hideCalendar, hideStatus }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const active = (['priority', 'calendarId', 'status', 'due'] as const).filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;
  const showPanel = open || active > 0;

  return (
    <div className="space-y-3">
      <div role="search" className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input id="task-search" type="search" aria-label="Search tasks" placeholder="Search" value={filters.query} onChange={(e) => set('query', e.target.value)} className="pl-9" />
        </div>
        <Button variant={active ? 'secondary' : 'ghost'} icon={SlidersHorizontal} aria-expanded={showPanel} aria-controls="filter-panel" onClick={() => setOpen((o) => !o)}>
          Filters
          {active > 0 && <span className="font-mono text-meta">{active}</span>}
        </Button>
        <Select aria-label="Sort by" value={sortMode} onChange={(e) => onSortChange(e.target.value as SortMode)} wrapperClassName="ml-auto w-44">
          {SORT_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              Sort: {m.label}
            </option>
          ))}
        </Select>
      </div>

      {showPanel && (
        <div id="filter-panel" className="grid grid-cols-2 gap-3 border-y border-hairline py-3 sm:flex sm:flex-wrap sm:items-center">
          <Select aria-label="Filter by priority" value={filters.priority} onChange={(e) => set('priority', e.target.value as Filters['priority'])} wrapperClassName="sm:w-40">
            <option value="any">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0]!.toUpperCase() + p.slice(1)} priority
              </option>
            ))}
          </Select>
          {!hideCalendar && (
            <Select aria-label="Filter by calendar" value={filters.calendarId} onChange={(e) => set('calendarId', e.target.value)} wrapperClassName="sm:w-44">
              <option value="any">Any calendar</option>
              <option value="none">No calendar</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {!hideStatus && (
            <Select aria-label="Filter by status" value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])} wrapperClassName="sm:w-40">
              <option value="any">Open and done</option>
              <option value="todo">Open only</option>
              <option value="done">Done only</option>
            </Select>
          )}
          <Select aria-label="Filter by due date" value={filters.due} onChange={(e) => set('due', e.target.value as Filters['due'])} wrapperClassName="sm:w-44">
            <option value="any">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="tomorrow">Due tomorrow</option>
            <option value="week">Due within 7 days</option>
            <option value="none">No due date</option>
          </Select>
          {active > 0 && (
            <Button
              variant="ghost"
              icon={X}
              onClick={() => {
                onChange({ ...DEFAULT_FILTERS, query: filters.query });
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
