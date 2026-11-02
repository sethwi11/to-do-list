import { useState } from 'react';
import { Check, CircleCheck, PenLine, Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import { LOW_CONFIDENCE, PRIORITIES, type Category, type ExtractedTask, type Priority } from '@todo/shared';
import type { ReviewItem } from '../hooks/useAssistant';
import { formatDueDate, formatTime } from '../lib/dates';

interface Props {
  items: ReviewItem[];
  categories: Category[];
  today: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onClear: () => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, task: ExtractedTask) => void;
}

/** Shown only while something is waiting for review; the parent hides it when empty. */
export function ReviewPanel({ items, categories, today, onAccept, onReject, onAcceptAll, onClear, onToggle, onEdit }: Props) {
  const checkedCount = items.filter((i) => i.checked && !(i.kind === 'action' && i.action.type === 'delete')).length;

  return (
    <section id="review" aria-labelledby="review-heading" className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="review-heading" className="text-sm font-semibold">
          Review <span className="font-normal text-slate-400">{items.length}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onClear} className="pill">
            Clear
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            disabled={checkedCount === 0}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> Accept {checkedCount}
          </button>
        </div>
      </div>

      <ul className="-mx-1 flex flex-col gap-1" aria-label="Items to review">
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
    </section>
  );
}

const rowClass = (warn: boolean) =>
  `group flex items-start gap-2.5 rounded-xl px-2 py-2 text-sm ${warn ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`;

function LowConfidence({ value }: { value: number }) {
  if (value >= LOW_CONFIDENCE) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400" title={`The AI is only ${Math.round(value * 100)}% sure`}>
      <TriangleAlert className="h-3 w-3" aria-hidden />
      Unsure
    </span>
  );
}

function RowButtons({ id, onAccept, onReject, danger }: { id: string; onAccept: (id: string) => void; onReject: (id: string) => void; danger?: boolean }) {
  return (
    <div className="-my-1 flex shrink-0 items-center">
      <button type="button" onClick={() => onReject(id)} aria-label="Reject" title="Reject" className="icon-btn h-7 w-7">
        <X className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onAccept(id)}
        aria-label={danger ? 'Delete (asks to confirm)' : 'Accept'}
        title={danger ? 'Delete (asks to confirm)' : 'Accept'}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
          danger
            ? 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950'
            : 'text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950'
        }`}
      >
        {danger ? <Trash2 className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
      </button>
    </div>
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

  if (editing) {
    return (
      <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
        <TaskDraftEditor
          task={task}
          categories={categories}
          onCancel={() => setEditing(false)}
          onSave={(t) => {
            onEdit(item.id, t);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  const details = [
    task.dueDate && `${formatDueDate(task.dueDate, today)}${task.dueTime ? ` ${formatTime(task.dueTime)}` : ''}`,
    task.priority !== 'medium' && `${task.priority} priority`,
    task.category,
    task.recurrence !== 'none' && `repeats ${task.recurrence}`,
    task.estimatedMinutes && `~${task.estimatedMinutes} min`,
    task.subtasks.length > 0 && `${task.subtasks.length} subtasks`,
  ].filter(Boolean);

  return (
    <article className={rowClass(low)} aria-label={`New task: ${task.title}`} title={task.sourceSnippet ? `“${task.sourceSnippet}”` : undefined}>
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
        aria-label={`Include "${task.title}" in Accept`}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-indigo-600"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-1.5 break-words">
          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="New task" />
          {/* The title is the edit control: one less icon per row. */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit "${task.title}" before accepting`}
            title="Click to edit"
            className="text-left decoration-slate-300 underline-offset-2 hover:underline dark:decoration-slate-600"
          >
            {task.title}
          </button>
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 pl-5 text-xs text-slate-500">
          <LowConfidence value={task.confidence} />
          {details.join(' · ')}
        </p>
      </div>
      <RowButtons id={item.id} onAccept={onAccept} onReject={onReject} />
    </article>
  );
}

const ACTION_ICON = { complete: CircleCheck, update: PenLine, delete: Trash2, query: CircleCheck } as const;

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
  const isDelete = action.type === 'delete';
  const Icon = ACTION_ICON[action.type];

  return (
    <article className={rowClass(isDelete || action.confidence < LOW_CONFIDENCE)} aria-label={action.description}>
      <input
        type="checkbox"
        checked={item.checked}
        disabled={isDelete}
        onChange={() => onToggle(item.id)}
        aria-label={isDelete ? 'Deletes are never included in Accept' : `Include "${action.description}" in Accept`}
        title={isDelete ? 'Deletes must be confirmed one at a time' : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-1.5 break-words">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isDelete ? 'text-red-500' : 'text-sky-500'}`} aria-hidden />
          <span>{action.description}</span>
        </p>
        {action.confidence < LOW_CONFIDENCE && (
          <p className="mt-0.5 pl-5 text-xs">
            <LowConfidence value={action.confidence} />
          </p>
        )}
      </div>
      <RowButtons id={item.id} onAccept={onAccept} onReject={onReject} danger={isDelete} />
    </article>
  );
}

const field = 'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950';

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
      <input value={draft.title} onChange={(e) => set('title', e.target.value)} aria-label="Title" autoFocus className={`${field} text-sm`} />
      <div className="flex flex-wrap gap-1.5">
        <input type="date" value={draft.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} aria-label="Due date" className={field} />
        <input type="time" value={draft.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} aria-label="Due time" className={field} />
        <select value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)} aria-label="Priority" className={field}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0]!.toUpperCase() + p.slice(1)} priority
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
        <button type="button" onClick={onCancel} className="pill">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
          Save
        </button>
      </div>
    </form>
  );
}
