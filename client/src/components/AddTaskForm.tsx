import { useState, type FormEvent } from 'react';
import { CornerDownLeft, Flag, Plus } from 'lucide-react';
import { PRIORITIES, type Calendar, type CreateTaskInput, type Priority } from '@todo/shared';
import { calendarDotClass } from '../lib/calendarColors';
import { DueDatePicker } from './DueDatePicker';

interface Props {
  calendars: Calendar[];
  today: string;
  /** Pre-filled due date (today when you're in the Today view). */
  defaultDueDate: string | null;
  /** Pre-selected list (the current list when you're in a list view). */
  defaultCalendarId: string | null;
  onCreate: (input: CreateTaskInput) => Promise<boolean>;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  high: 'text-red-500',
  medium: 'text-slate-400',
  low: 'text-slate-300 dark:text-slate-600',
};

/**
 * One-line quick add. The options row (date, priority, list) only appears
 * while you're using the form, so the resting state is a single calm input.
 */
export function AddTaskForm({ calendars, today, defaultDueDate, defaultCalendarId, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '');
  const [priority, setPriority] = useState<Priority>('medium');
  const [calendarId, setCalendarId] = useState(defaultCalendarId ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Follow the view's defaults when the view changes (e.g. Today -> a list),
  // using React's "adjust state during render" pattern instead of an effect.
  const defaultsKey = `${defaultDueDate}|${defaultCalendarId}`;
  const [prevDefaults, setPrevDefaults] = useState(defaultsKey);
  if (prevDefaults !== defaultsKey) {
    setPrevDefaults(defaultsKey);
    setDueDate(defaultDueDate ?? '');
    setCalendarId(defaultCalendarId ?? '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreate({
      title: title.trim(),
      dueDate: dueDate || null,
      priority,
      calendarId: calendarId || null,
    });
    setSubmitting(false);
    // Keep date/priority/list so adding several similar tasks in a row is quick.
    if (ok) setTitle('');
  }

  const calendar = calendars.find((c) => c.id === calendarId);

  return (
    <form onSubmit={handleSubmit} aria-label="Add a task" className="group card px-3 py-2 focus-within:border-indigo-300 dark:focus-within:border-indigo-800">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
        <label className="sr-only" htmlFor="new-task-title">
          Task title
        </label>
        <input
          id="new-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task"
          maxLength={200}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none focus-visible:outline-none"
        />
        {title.trim() && (
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add <CornerDownLeft className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>

      {/* Options: visible while the form has focus or text in it. */}
      <div className={`flex-wrap items-center gap-1 pt-1 pl-6 group-focus-within:flex ${title ? 'flex' : 'hidden'}`}>
        <DueDatePicker value={dueDate} onChange={setDueDate} today={today} />

        <span className="inline-flex items-center">
          <Flag className={`h-3.5 w-3.5 ${PRIORITY_COLOR[priority]}`} aria-hidden />
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority" className="select-quiet">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0]!.toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </span>

        <span className="inline-flex items-center">
          <span className={`h-2 w-2 rounded-full ${calendar ? calendarDotClass[calendar.color] : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden />
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} aria-label="Calendar" className="select-quiet">
            <option value="">No calendar</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </span>
      </div>
    </form>
  );
}
