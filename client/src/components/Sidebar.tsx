import type { Category } from '@todo/shared';
import { categoryDotClass } from '../lib/categoryColors';
import { VIEWS, type ViewId } from '../lib/taskViews';

interface Props {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  counts: Record<ViewId, number>;
  categories: Category[];
}

export function Sidebar({ view, onViewChange, counts, categories }: Props) {
  return (
    <nav aria-label="Views" className="flex flex-col gap-6">
      <div className="flex items-center gap-2 px-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-lg font-semibold">Voice To-Do</span>
      </div>

      {/* Horizontal row on phones, vertical list from md up. */}
      <ul className="flex gap-1 md:flex-col">
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onViewChange(v.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {v.label}
                <span className="text-xs tabular-nums text-slate-400">{counts[v.id]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="lists-heading" className="hidden md:block">
        <h2 id="lists-heading" className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lists
        </h2>
        <ul className="flex flex-col gap-1">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${categoryDotClass[c.color]}`} aria-hidden />
              {c.name}
            </li>
          ))}
        </ul>
        <p className="px-3 pt-2 text-xs text-slate-400">List views and editing arrive in Phase 2.</p>
      </section>
    </nav>
  );
}
