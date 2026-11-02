import { useState } from 'react';
import { LOW_CONFIDENCE, PRIORITIES, type Category, type ExtractedTask, type Priority } from '@todo/shared';
import type { ReviewItem } from '../hooks/useAssistant';
import { formatDueDate, formatTime } from '../lib/dates';

interface Props {
  items: ReviewItem[];
  categories: Category[];
  today: string;
  autoAccept: boolean;
  onAutoAcceptChange: (on: boolean) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onClear: () => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, task: ExtractedTask) => void;
}

export function ReviewPanel({ items, categories, today, autoAccept, onAutoAcceptChange, onAccept, onReject, onAcceptAll, onClear, onToggle, onEdit }: Props) {
  const checkedCount = items.filter((i) => i.checked && !(i.kind === 'action' && i.action.type === 'delete')).length;

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 id="review-heading" className="font-semibold">
          Review {items.length > 0 && <span className="text-sm font-normal text-slate-500">({items.length})</span>}
        </h2>
        {items.length > 0 && (
          <div className="flex gap-1">
            <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              Clear
            </button>
            <button
              type="button"
              onClick={onAcceptAll}
              disabled={checkedCount === 0}
              className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Accept all ({checkedCount})
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Tasks I pick up from your voice or brain dump land here first, so nothing is added until you say so.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Items to review">
          {items.map((item) => (
            <li key={item.id}>
              {item.kind === 'task' ? (
                <TaskCard item={item} categories={categories} today={today} onAccept={onAccept} onReject={onReject} onToggle={onToggle} onEdit={onEdit} />
              ) : (
                <ActionCard item={item} onAccept={onAccept} onReject={onReject} onToggle={onToggle} />
              )}
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
        <input type="checkbox" checked={autoAccept} onChange={(e) => onAutoAcceptChange(e.target.checked)} className="accent-indigo-600" />
        Auto-add new tasks I'm very confident about (commands still need review)
      </label>
    </section>
  );
}

const cardClass = (low: boolean) =>
  `rounded-lg border p-3 text-sm ${
    low ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-700'
  }`;

function ConfidenceBadge({ value }: { value: number }) {
  const low = value < LOW_CONFIDENCE;
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
        low ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
      title="How sure the AI is"
    >
      {low ? '⚠ unsure' : ''} {Math.round(value * 100)}%
    </span>
  );
}

function TaskCard({
  item,
  categories,
  today,
  onAccept,
  onReject,
  onToggle,
  onEdit,
}: {
  item: Extract<ReviewItem, { kind: 'task' }>;
  categories: Category[];
  today: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, task: ExtractedTask) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { task } = item;
  const low = task.confidence < LOW_CONFIDENCE;

  return (
    <article className={cardClass(low)} aria-label={`New task: ${task.title}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggle(item.id)}
          aria-label={`Include "${task.title}" in Accept all`}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <TaskDraftEditor
              task={task}
              categories={categories}
              onCancel={() => setEditing(false)}
              onSave={(t) => {
                onEdit(item.id, t);
                setEditing(false);
              }}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium break-words">
                  <span className="mr-1 text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">New</span>
                  {task.title}
                </p>
                <ConfidenceBadge value={task.confidence} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[
                  task.dueDate && `${formatDueDate(task.dueDate, today)}${task.dueTime ? ` · ${formatTime(task.dueTime)}` : ''}`,
                  `${task.priority} priority`,
                  task.category,
                  task.recurrence !== 'none' && `↻ ${task.recurrence}`,
                  task.estimatedMinutes && `~${task.estimatedMinutes} min`,
                  task.subtasks.length > 0 && `${task.subtasks.length} subtasks`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {task.sourceSnippet && <p className="mt-1 text-xs italic text-slate-400">“{task.sourceSnippet}”</p>}
            </>
          )}
        </div>
      </div>
      {!editing && (
        <div className="mt-2 flex justify-end gap-1">
          <button type="button" onClick={() => onReject(item.id)} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Reject
          </button>
          <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Edit
          </button>
          <button type="button" onClick={() => onAccept(item.id)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">
            Accept
          </button>
        </div>
      )}
    </article>
  );
}

const ACTION_STYLE = {
  complete: { label: 'Complete', className: 'text-sky-600 dark:text-sky-400' },
  update: { label: 'Change', className: 'text-violet-600 dark:text-violet-400' },
  delete: { label: 'Delete', className: 'text-red-600 dark:text-red-400' },
  query: { label: 'Query', className: 'text-slate-500' },
} as const;

function ActionCard({
  item,
  onAccept,
  onReject,
  onToggle,
}: {
  item: Extract<ReviewItem, { kind: 'action' }>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { action } = item;
  const style = ACTION_STYLE[action.type];
  const isDelete = action.type === 'delete';
  const low = action.confidence < LOW_CONFIDENCE;

  return (
    <article className={cardClass(low || isDelete)} aria-label={`${style.label}: ${item.targetTitle}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={item.checked}
          disabled={isDelete}
          onChange={() => onToggle(item.id)}
          aria-label={isDelete ? 'Deletes are never included in Accept all' : `Include "${action.description}" in Accept all`}
          title={isDelete ? 'Deletes must be confirmed one at a time' : undefined}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium break-words">
              <span className={`mr-1 text-xs font-semibold uppercase ${style.className}`}>{style.label}</span>
              {action.description}
            </p>
            <ConfidenceBadge value={action.confidence} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Task: {item.targetTitle}</p>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <button type="button" onClick={() => onReject(item.id)} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Reject
        </button>
        <button
          type="button"
          onClick={() => onAccept(item.id)}
          className={`rounded-md px-2 py-1 text-xs font-medium text-white ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isDelete ? 'Delete…' : 'Accept'}
        </button>
      </div>
    </article>
  );
}

const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950';

function TaskDraftEditor({
  task,
  categories,
  onSave,
  onCancel,
}: {
  task: ExtractedTask;
  categories: Category[];
  onSave: (task: ExtractedTask) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(task);
  const set = <K extends keyof ExtractedTask>(k: K, v: ExtractedTask[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() });
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="flex flex-col gap-2"
    >
      <input value={draft.title} onChange={(e) => set('title', e.target.value)} aria-label="Title" autoFocus className={field} />
      <div className="flex flex-wrap gap-1.5">
        <input type="date" value={draft.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} aria-label="Due date" className={field} />
        <input type="time" value={draft.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} aria-label="Due time" className={field} />
        <select value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)} aria-label="Priority" className={field}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={draft.category ?? ''} onChange={(e) => set('category', e.target.value || null)} aria-label="List" className={field}>
          <option value="">No list</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-1">
        <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">
          Save
        </button>
      </div>
    </form>
  );
}
