import { useState, type FormEvent } from 'react';
import { PRIORITIES, type Category, type Priority, type Task, type UpdateTaskInput } from '@todo/shared';
import { categoryChipClass } from '../lib/categoryColors';
import { daysBetween, formatDueDate, formatTime } from '../lib/dates';

interface Props {
  task: Task;
  category: Category | undefined;
  today: string;
  onUpdate: (id: string, changes: UpdateTaskInput) => void;
  onDelete: (id: string) => void;
}

const priorityBadge: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function TaskItem({ task, category, today, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const done = task.status === 'done';
  const overdue = !done && task.dueDate !== null && daysBetween(today, task.dueDate) < 0;

  if (editing) {
    return (
      <TaskEditor
        task={task}
        onCancel={() => setEditing(false)}
        onSave={(changes) => {
          onUpdate(task.id, changes);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <input
        type="checkbox"
        checked={done}
        onChange={() => onUpdate(task.id, { status: done ? 'todo' : 'done' })}
        aria-label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600"
      />

      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-sm font-medium ${done ? 'text-slate-400 line-through' : ''}`}
          onDoubleClick={() => setEditing(true)}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {task.dueDate && (
            <span className={overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500'}>
              {overdue && 'Overdue · '}
              {formatDueDate(task.dueDate, today)}
              {task.dueTime && ` · ${formatTime(task.dueTime)}`}
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 font-medium ${priorityBadge[task.priority]}`}>
            {task.priority}
          </span>
          {category && (
            <span className={`rounded px-1.5 py-0.5 font-medium ${categoryChipClass[category.color]}`}>
              {category.name}
            </span>
          )}
        </div>
      </div>

      {/* Always visible on touch screens; on desktop they appear on hover or keyboard focus. */}
      <div className="flex shrink-0 gap-1 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit "${task.title}"`}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          aria-label={`Delete "${task.title}"`}
          className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function TaskEditor({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (changes: UpdateTaskInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), dueDate: dueDate || null, dueTime: dueTime || null, priority });
  }

  const field = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

  return (
    <li className="rounded-xl border border-indigo-300 bg-white p-3 dark:border-indigo-800 dark:bg-slate-900">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        aria-label={`Edit "${task.title}"`}
        className="flex flex-col gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
          maxLength={200}
          autoFocus
          className={field}
        />
        <div className="flex flex-wrap gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" className={field} />
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} aria-label="Due time" className={field} />
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority" className={field}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </form>
    </li>
  );
}
