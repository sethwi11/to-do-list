import { useState } from 'react';
import { CalendarDays, CircleAlert, CircleCheck, Inbox, MoreHorizontal, Plus, Settings, Sun, type LucideIcon } from 'lucide-react';
import type { Category, CategoryColor } from '@todo/shared';
import { categoryDotClass } from '../lib/categoryColors';
import type { Stats } from '../lib/stats';
import { SMART_VIEWS, sameView, type SmartViewId, type View } from '../lib/views';
import { CategoryForm } from './CategoryForm';
import { StatsCard } from './StatsCard';

interface Props {
  view: View;
  onSelect: (view: View) => void;
  countFor: (view: View) => number;
  categories: Category[];
  stats: Stats;
  onCreateCategory: (name: string, color: CategoryColor) => Promise<boolean>;
  onUpdateCategory: (id: string, name: string, color: CategoryColor) => Promise<boolean>;
  onDeleteCategory: (category: Category) => void;
  onOpenSettings: () => void;
}

const VIEW_ICONS: Record<SmartViewId, LucideIcon> = {
  today: Sun,
  upcoming: CalendarDays,
  overdue: CircleAlert,
  all: Inbox,
  completed: CircleCheck,
};

const itemClass = (active: boolean) =>
  `flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
    active
      ? 'bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/60'
  }`;

export function Sidebar({ view, onSelect, countFor, categories, stats, onCreateCategory, onUpdateCategory, onDeleteCategory, onOpenSettings }: Props) {
  // Which list is being edited ('new' = the create form).
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <nav aria-label="Views and lists" className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center gap-2 px-2">
        <img src="/favicon.svg" alt="" className="h-6 w-6" />
        <span className="flex-1 font-semibold">Voice To-Do</span>
        <button type="button" onClick={onOpenSettings} aria-label="Settings" className="icon-btn">
          <Settings className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Horizontal scrolling row on phones, vertical list from md up. */}
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0.5 md:px-0">
        {SMART_VIEWS.map((v) => {
          const target: View = { type: 'smart', id: v.id };
          const active = sameView(view, target);
          const count = countFor(target);
          const Icon = VIEW_ICONS[v.id];
          return (
            <li key={v.id}>
              <button type="button" onClick={() => onSelect(target)} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-500' : v.id === 'overdue' && count > 0 ? 'text-red-500' : 'text-slate-400'}`}
                  aria-hidden
                />
                <span className="flex-1 text-left">{v.label}</span>
                {v.id !== 'completed' && count > 0 && (
                  <span className={`text-xs tabular-nums ${v.id === 'overdue' ? 'font-medium text-red-500' : 'text-slate-400'}`}>{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="lists-heading" className="flex flex-col gap-1">
        <div className="flex items-center justify-between pr-1 pl-3">
          <h2 id="lists-heading" className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Lists
          </h2>
          <button type="button" onClick={() => setEditing('new')} aria-label="New list" className="icon-btn h-6 w-6">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {editing === 'new' && (
          <CategoryForm submitLabel="Create" initialColor="indigo" onSubmit={onCreateCategory} onCancel={() => setEditing(null)} />
        )}

        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0.5 md:px-0">
          {categories.map((c) => {
            const target: View = { type: 'category', id: c.id };
            const active = sameView(view, target);
            const count = countFor(target);

            if (editing === c.id) {
              return (
                <li key={c.id} className="min-w-64 md:min-w-0">
                  <CategoryForm
                    initialName={c.name}
                    initialColor={c.color}
                    submitLabel="Save"
                    onSubmit={(name, color) => onUpdateCategory(c.id, name, color)}
                    onCancel={() => setEditing(null)}
                    onDelete={() => {
                      setEditing(null);
                      onDeleteCategory(c);
                    }}
                  />
                </li>
              );
            }

            return (
              <li key={c.id} className="group relative flex items-center">
                <button type="button" onClick={() => onSelect(target)} aria-current={active ? 'page' : undefined} className={`${itemClass(active)} md:pr-8`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${categoryDotClass[c.color]}`} aria-hidden />
                  <span className="flex-1 truncate text-left">{c.name}</span>
                  {count > 0 && <span className="text-xs text-slate-400 tabular-nums md:group-hover:opacity-0">{count}</span>}
                </button>
                {/* Phones: only the selected list shows it. Desktop: appears on hover/focus. */}
                <button
                  type="button"
                  onClick={() => setEditing(c.id)}
                  aria-label={`Edit list ${c.name}`}
                  className={`icon-btn h-7 w-7 shrink-0 focus:opacity-100 md:absolute md:right-0.5 md:flex md:opacity-0 md:group-hover:opacity-100 ${active ? 'flex' : 'hidden'}`}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="hidden md:block">
        <StatsCard stats={stats} />
      </div>
    </nav>
  );
}
