import { useState } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight } from 'lucide-react';
import { formatMinutes, isOverdue, isRolling, rollDeadline, type Task } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { formatDueDate, formatTime } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { TaskRow, type TaskRowProps } from '../../ui/TaskRow';
import { useNow } from '../../hooks/useNow';
import { localDateTime } from '../calendar/calendarModel';
import { useCurrentBlock } from '../today/useCurrentBlock';

/** Turns a task into the props the task row displays, wired to the app's actions. */
function useRowProps() {
  const { calendarsById, today, toggleTask, openDialog, scheduledMinutesByTask } = useApp();
  const block = useCurrentBlock(localDateTime(useNow()));
  return (task: Task): Omit<TaskRowProps, 'leaveOnComplete'> => {
    const done = task.status === 'done';
    const calendar = task.calendarId ? calendarsById.get(task.calendarId) : undefined;
    const edit = () => openDialog({ kind: 'task', mode: 'edit', id: task.id });
    const planned = scheduledMinutesByTask.get(task.id);
    return {
      title: task.title,
      done,
      priority: task.priority,
      // A rolling task past its day is still current until its next one: say until when, never "overdue".
      dueLabel: !done && isRolling(task) && task.dueDate && task.dueDate < today ? `Until ${formatDueDate(rollDeadline(task)!, today)}` : task.dueDate ? `${formatDueDate(task.dueDate, today)}${task.dueTime ? ` ${formatTime(task.dueTime)}` : ''}` : null,
      dueTone: isOverdue(task, today) ? 'overdue' : task.dueDate === today ? 'today' : 'normal',
      calendar: calendar ? { name: calendar.name, color: calendar.color } : null,
      subtasks: task.subtasks.length ? { done: task.subtasks.filter((s) => s.done).length, total: task.subtasks.length } : null,
      scheduledLabel: planned ? formatMinutes(planned) : null,
      now: !done && block !== undefined && task.calendarId !== null && (task.calendarId === block.calendarId || task.calendarId === block.altCalendarId),
      onToggle: () => void toggleTask(task),
      onOpen: edit,
      onEdit: edit,
      // Finished to-dos don't need time set aside for them.
      onSchedule: done ? undefined : () => openDialog({ kind: 'schedule', taskId: task.id }),
    };
  };
}

interface TaskListProps {
  tasks: Task[];
  /** Accessible name for the list, e.g. "Overdue tasks". */
  label: string;
  /** Manual ordering by drag and drop (keyboard too: focus the grip, Space to lift, arrows to move, Space to drop). */
  draggable?: boolean;
  /** Play the full completion animation, for lists where a finished task leaves the list. */
  leaveOnComplete?: boolean;
}

export function TaskList({ tasks, label, draggable = false, leaveOnComplete = false }: TaskListProps) {
  const { moveTask } = useApp();
  const rowProps = useRowProps();

  // Pointer drags need 5px of movement first, so a plain click isn't treated as a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = tasks.findIndex((t) => t.id === active.id);
    const to = tasks.findIndex((t) => t.id === over.id);
    const moved = arrayMove(tasks, from, to);
    moveTask(String(active.id), moved[to - 1], moved[to + 1]);
  }

  // Screen-reader announcements use task titles instead of internal ids.
  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? 'task';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${titleOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${titleOf(active.id)} at ${titleOf(over.id)}.` : 'Dropped.'),
    onDragCancel: ({ active }) => `Cancelled moving ${titleOf(active.id)}.`,
  };

  if (draggable) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label={label} className="border-t border-hairline">
            {tasks.map((task) => (
              <SortableRow key={task.id} {...rowProps(task)} id={task.id} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <ul aria-label={label} className="border-t border-hairline">
      {tasks.map((task) => (
        <TaskRow key={task.id} {...rowProps(task)} leaveOnComplete={leaveOnComplete && task.status === 'todo'} />
      ))}
    </ul>
  );
}

function SortableRow({ id, ...props }: Omit<TaskRowProps, 'leaveOnComplete'> & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <TaskRow
      {...props}
      liRef={setNodeRef}
      liStyle={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      dragHandle={{ ...attributes, ...listeners }}
    />
  );
}

/** Finished tasks, tucked away under a toggle so they don't crowd the list. */
export function CompletedSection({ tasks, className }: { tasks: Task[]; className?: string }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <section className={cx('mt-8', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-control text-label text-ink-muted uppercase hover:text-ink"
      >
        <ChevronRight className={cx('size-4 transition-transform duration-150 ease-out', open && 'rotate-90')} aria-hidden />
        Completed <span className="ml-1 font-mono font-normal">{tasks.length}</span>
      </button>
      {open && (
        <div className="mt-2">
          <TaskList tasks={tasks} label="Completed tasks" />
        </div>
      )}
    </section>
  );
}
