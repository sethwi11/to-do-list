import { useState } from 'react';
import type { Category, CategoryColor } from '@todo/shared';
import { categoryDotClass } from '../lib/categoryColors';
import { SMART_VIEWS, sameView, type View } from '../lib/views';
import { CategoryForm } from './CategoryForm';

interface Props {
  view: View;
  onSelect: (view: View) => void;
  countFor: (view: View) => number;
  categories: Category[];
  onCreateCategory: (name: string, color: CategoryColor) => Promise<boolean>;
  onUpdateCategory: (id: string, name: string, color: CategoryColor) => Promise<boolean>;
  onDeleteCategory: (category: Category) => void;
}

const itemClass = (active: boolean) =>
  `flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function Sidebar({ view, onSelect, countFor, categories, onCreateCategory, onUpdateCategory, onDeleteCategory }: Props) {
  // Which list is being edited ('new' = the create form).
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <nav aria-label="Views and lists" className="flex flex-col gap-5">
      <div className="flex items-center gap-2 px-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-lg font-semibold">Voice To-Do</span>
      </div>

      {/* Horizontal scrolling row on phones, vertical list from md up. */}
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
        {SMART_VIEWS.map((v) => {
          const target: View = { type: 'smart', id: v.id };
          const active = sameView(view, target);
          const count = countFor(target);
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(target)}
                aria-current={active ? 'page' : undefined}
                className={itemClass(active)}
              >
                <span className="flex-1 text-left">{v.label}</span>
                {v.id !== 'completed' && count > 0 && (
                  <span className={`text-xs tabular-nums ${v.id === 'overdue' ? 'text-red-500' : 'text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="lists-heading" className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-3">
          <h2 id="lists-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lists
          </h2>
          <button
            type="button"
            onClick={() => setEditing('new')}
            aria-label="New list"
            className="rounded px-1.5 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            +
          </button>
        </div>

        {editing === 'new' && (
          <CategoryForm
            submitLabel="Create"
            initialColor="indigo"
            onSubmit={onCreateCategory}
            onCancel={() => setEditing(null)}
          />
        )}

        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
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
              <li key={c.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onSelect(target)}
                  aria-current={active ? 'page' : undefined}
                  className={itemClass(active)}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${categoryDotClass[c.color]}`} aria-hidden />
                  <span className="flex-1 truncate text-left">{c.name}</span>
                  {count > 0 && <span className="text-xs tabular-nums text-slate-400">{count}</span>}
                </button>
                {/* Always visible on phones; appears on hover/focus on desktop. */}
                <button
                  type="button"
                  onClick={() => setEditing(c.id)}
                  aria-label={`Edit list ${c.name}`}
                  className="shrink-0 rounded px-1.5 py-1 text-sm leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  ⋯
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </nav>
  );
}
