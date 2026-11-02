import { useState, type HTMLAttributes } from 'react';
import type { Category, Priority, Task, UpdateTaskInput } from '@todo/shared';
import { categoryChipClass } from '../lib/categoryColors';
import { formatDueDate, formatTime } from '../lib/dates';
import { SubtaskList } from './SubtaskList';
import { TaskEditor } from './TaskEditor';

export interface TaskItemProps {
  task: Task;
  category: Category | undefined;
  categories: Category[];
  today: string;
  onToggle: (task: Task) => void;
  onUpdate: (id: string, changes: UpdateTaskInput) => void;
  onDelete: (task: Task) => void;
  /** Props for the drag handle, present only when manual reordering is active. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const priorityBadge: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const formatMinutes = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);

export function TaskItem({ task, category, categories, today, onToggle, onUpdate, onDelete, dragHandleProps }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const done = task.status === 'done';
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const hasDetails = task.notes !== null || task.subtasks.length > 0;
  const detailsId = `task-details-${task.id}`;

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-300 bg-white p-3 dark:border-indigo-800 dark:bg-slate-900">
        <TaskEditor
          task={task}
          categories={categories}
          onCancel={() => setEditing(false)}
          onSave={(changes) => {
            onUpdate(task.id, changes);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            aria-label={`Reorder "${task.title}"`}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded px-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600"
          >
            ⠿
          </button>
        )}

        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(task)}
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {task.dueDate && (
              <span className={overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                {overdue && 'Overdue · '}
                {formatDueDate(task.dueDate, today)}
                {task.dueTime && ` · ${formatTime(task.dueTime)}`}
              </span>
            )}
            <span className={`rounded px-1.5 py-0.5 font-medium ${priorityBadge[task.priority]}`}>{task.priority}</span>
            {category && (
              <span className={`rounded px-1.5 py-0.5 font-medium ${categoryChipClass[category.color]}`}>{category.name}</span>
            )}
            {task.recurrence !== 'none' && <span title={`Repeats ${task.recurrence}`}>↻ {task.recurrence}</span>}
            {task.estimatedMinutes !== null && <span>~{formatMinutes(task.estimatedMinutes)}</span>}
            {task.subtasks.length > 0 && (
              <span aria-label={`${subDone} of ${task.subtasks.length} subtasks done`}>
                ☑ {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.notes && <span aria-label="Has notes">✎ notes</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for "${task.title}"`}
            className={`rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
              hasDetails ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'
            }`}
          >
            {expanded ? '▾' : '▸'}
          </button>
          {/* Always visible on touch screens; on desktop they appear on hover or keyboard focus. */}
          <div className="flex gap-1 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
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
              onClick={() => onDelete(task)}
              aria-label={`Delete "${task.title}"`}
              className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div id={detailsId} className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 pl-8 dark:border-slate-800">
          {task.notes && <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{task.notes}</p>}
          <SubtaskList
            parentTitle={task.title}
            subtasks={task.subtasks}
            onChange={(subtasks) => onUpdate(task.id, { subtasks })}
          />
        </div>
      )}
    </div>
  );
}
