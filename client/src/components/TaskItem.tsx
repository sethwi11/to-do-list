import { useState, type HTMLAttributes } from 'react';
import { ChevronRight, Clock, GripVertical, ListChecks, Pencil, Repeat, StickyNote, Trash2 } from 'lucide-react';
import type { Calendar, Task, UpdateTaskInput } from '@todo/shared';
import { calendarDotClass } from '../lib/calendarColors';
import { formatDueDate, formatTime } from '../lib/dates';
import { SubtaskList } from './SubtaskList';
import { TaskEditor } from './TaskEditor';

export interface TaskItemProps {
  task: Task;
  calendar: Calendar | undefined;
  calendars: Calendar[];
  today: string;
  onToggle: (task: Task) => void;
  onUpdate: (id: string, changes: UpdateTaskInput) => void;
  onDelete: (task: Task) => void;
  /** Props for the drag handle, present only when manual reordering is active. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const formatMinutes = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);

/**
 * One row in the task list. Design choices for a calm list:
 * - Priority is shown by the checkbox ring (red = high), not a badge on
 *   every row; "medium" is the default and shows nothing.
 * - Details sit on one quiet line and only appear when there's something to say.
 * - Edit/delete icons appear on hover (desktop) or inside the expanded row (touch).
 */
export function TaskItem({ task, calendar, calendars, today, onToggle, onUpdate, onDelete, dragHandleProps }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const done = task.status === 'done';
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const dueToday = task.dueDate === today;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const detailsId = `task-details-${task.id}`;

  if (editing) {
    return (
      <div className="px-4 py-3">
        <TaskEditor
          task={task}
          calendars={calendars}
          onCancel={() => setEditing(false)}
          onSave={(changes) => {
            onUpdate(task.id, changes);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  const meta: React.ReactNode[] = [];
  if (task.dueDate) {
    meta.push(
      <span
        key="due"
        className={
          overdue ? 'font-medium text-red-600 dark:text-red-400' : dueToday && !done ? 'text-indigo-600 dark:text-indigo-400' : ''
        }
      >
        {overdue && 'Overdue · '}
        {formatDueDate(task.dueDate, today)}
        {task.dueTime && ` ${formatTime(task.dueTime)}`}
      </span>,
    );
  }
  if (calendar) {
    meta.push(
      <span key="list" className="inline-flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${calendarDotClass[calendar.color]}`} aria-hidden />
        {calendar.name}
      </span>,
    );
  }
  if (task.recurrence !== 'none') {
    meta.push(
      <span key="rec" className="inline-flex items-center gap-0.5" title={`Repeats ${task.recurrence}`}>
        <Repeat className="h-3 w-3" aria-hidden />
        <span className="sr-only">Repeats</span> {task.recurrence}
      </span>,
    );
  }
  if (task.subtasks.length > 0) {
    meta.push(
      <span key="sub" className="inline-flex items-center gap-0.5">
        <ListChecks className="h-3 w-3" aria-hidden />
        <span className="sr-only">Subtasks</span> {subDone}/{task.subtasks.length}
      </span>,
    );
  }
  if (task.estimatedMinutes !== null) {
    meta.push(
      <span key="est" className="inline-flex items-center gap-0.5">
        <Clock className="h-3 w-3" aria-hidden />
        <span className="sr-only">Estimated</span> {formatMinutes(task.estimatedMinutes)}
      </span>,
    );
  }
  if (task.notes) meta.push(<StickyNote key="notes" className="h-3 w-3" aria-label="Has notes" />);

  return (
    <div className="group relative">
      <div className="flex items-start gap-3 px-4 py-2.5">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            aria-label={`Reorder "${task.title}"`}
            className="absolute top-3 left-0.5 cursor-grab touch-none rounded text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing dark:text-slate-600"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        )}

        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(task)}
          aria-label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}${task.priority === 'high' ? ' (high priority)' : ''}`}
          className={`check mt-0.5 ${task.priority === 'high' && !done ? 'border-red-400 dark:border-red-500' : ''}`}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            onDoubleClick={() => setEditing(true)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className={`block w-full text-left text-sm break-words ${done ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
          >
            {task.title}
            {task.priority === 'low' && <span className="sr-only"> (low priority)</span>}
          </button>
          {meta.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">{meta}</div>
          )}
        </div>

        {/* Desktop: icons on hover/focus. Touch: these live in the expanded row instead. */}
        <div className="-my-1 hidden shrink-0 items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 sm:flex">
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit "${task.title}"`} className="icon-btn">
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => onDelete(task)} aria-label={`Delete "${task.title}"`} className="icon-btn hover:text-red-600 dark:hover:text-red-400">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ChevronRight
          aria-hidden
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-transform sm:hidden dark:text-slate-600 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {expanded && (
        <div id={detailsId} className="flex flex-col gap-2 pr-4 pb-3 pl-12">
          {task.notes && <p className="text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">{task.notes}</p>}
          <SubtaskList parentTitle={task.title} subtasks={task.subtasks} onChange={(subtasks) => onUpdate(task.id, { subtasks })} />
          <div className="flex gap-1 sm:hidden">
            <button type="button" onClick={() => setEditing(true)} className="pill">
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </button>
            <button type="button" onClick={() => onDelete(task)} className="pill text-red-600 dark:text-red-400">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
