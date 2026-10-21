import { useState, type FormEvent } from 'react';
import { PRIORITIES, type Category, type CreateTaskInput, type Priority } from '@todo/shared';

interface Props {
  categories: Category[];
  /** Pre-filled due date (today when you're in the Today view). */
  defaultDueDate: string | null;
  onCreate: (input: CreateTaskInput) => Promise<boolean>;
}

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

export function AddTaskForm({ categories, defaultDueDate, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '');
  const [priority, setPriority] = useState<Priority>('medium');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Follow the view's default when it changes (e.g. switching Today -> All),
  // using React's "adjust state during render" pattern instead of an effect.
  const [prevDefault, setPrevDefault] = useState(defaultDueDate);
  if (prevDefault !== defaultDueDate) {
    setPrevDefault(defaultDueDate);
    setDueDate(defaultDueDate ?? '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreate({
      title: title.trim(),
      dueDate: dueDate || null,
      priority,
      categoryId: categoryId || null,
    });
    setSubmitting(false);
    // Keep date/priority/list so adding several similar tasks in a row is quick.
    if (ok) setTitle('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add a task"
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center dark:border-slate-800 dark:bg-slate-900"
    >
      <label className="sr-only" htmlFor="new-task-title">
        Task title
      </label>
      <input
        id="new-task-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task… e.g. Finish COMP 365 lab"
        maxLength={200}
        className={`${inputClass} min-w-0 flex-1 sm:min-w-64`}
      />

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="new-task-due">
          Due date
        </label>
        <input
          id="new-task-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />

        <label className="sr-only" htmlFor="new-task-priority">
          Priority
        </label>
        <select
          id="new-task-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className={inputClass}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p[0]!.toUpperCase() + p.slice(1)} priority
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="new-task-list">
          List
        </label>
        <select
          id="new-task-list"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
          <option value="">No list</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}
