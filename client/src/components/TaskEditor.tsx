import { useState, type FormEvent } from 'react';
import {
  PRIORITIES,
  RECURRENCES,
  type Category,
  type Priority,
  type Recurrence,
  type Task,
  type UpdateTaskInput,
} from '@todo/shared';

interface Props {
  task: Task;
  categories: Category[];
  onSave: (changes: UpdateTaskInput) => void;
  onCancel: () => void;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};

const field =
  'rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

export function TaskEditor({ task, categories, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [categoryId, setCategoryId] = useState(task.categoryId ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [estimate, setEstimate] = useState(task.estimatedMinutes?.toString() ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const minutes = Number.parseInt(estimate, 10);
    onSave({
      title: title.trim(),
      notes: notes.trim() || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      priority,
      categoryId: categoryId || null,
      recurrence,
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      aria-label={`Edit "${task.title}"`}
      className="flex flex-col gap-2"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" maxLength={200} autoFocus className={field} />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Notes"
        placeholder="Notes"
        rows={2}
        maxLength={5000}
        className={`${field} resize-y`}
      />
      <div className="flex flex-wrap gap-2">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" className={field} />
        <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} aria-label="Due time" className={field} />
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority" className={field}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0]!.toUpperCase() + p.slice(1)} priority
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="List" className={field}>
          <option value="">No list</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} aria-label="Repeat" className={field}>
          {RECURRENCES.map((r) => (
            <option key={r} value={r}>
              {RECURRENCE_LABELS[r]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-500">
          <input
            type="number"
            min={1}
            max={1440}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            aria-label="Estimated minutes"
            placeholder="—"
            className={`${field} w-20`}
          />
          min
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Cancel
        </button>
        <button type="submit" disabled={!title.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  );
}
