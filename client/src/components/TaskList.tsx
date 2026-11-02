import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight } from 'lucide-react';
import type { Category, Task, UpdateTaskInput } from '@todo/shared';
import { TaskItem, type TaskItemProps } from './TaskItem';

interface Props {
  openTasks: Task[];
  doneTasks: Task[];
  /** Show done tasks in a collapsible "Completed" section (vs. as the main list). */
  doneAsSection: boolean;
  draggable: boolean;
  categoriesById: Map<string, Category>;
  categories: Category[];
  today: string;
  onToggle: (task: Task) => void;
  onUpdate: (id: string, changes: UpdateTaskInput) => void;
  onDelete: (task: Task) => void;
  /** Called after a drop with the moved task's new neighbors. */
  onMove: (movedId: string, before: Task | undefined, after: Task | undefined) => void;
}

type ItemCallbacks = Pick<Props, 'categories' | 'today' | 'onToggle' | 'onUpdate' | 'onDelete'> & {
  categoriesById: Map<string, Category>;
};

export function TaskList({ openTasks, doneTasks, doneAsSection, draggable, onMove, ...item }: Props) {
  const [showDone, setShowDone] = useState(false);

  // Pointer drags need 5px of movement first, so a plain click on the handle
  // isn't treated as a drag. The keyboard sensor makes reordering fully
  // accessible: focus the handle, Space to pick up, arrows to move, Space to drop.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = openTasks.findIndex((t) => t.id === active.id);
    const to = openTasks.findIndex((t) => t.id === over.id);
    const moved = arrayMove(openTasks, from, to);
    onMove(String(active.id), moved[to - 1], moved[to + 1]);
  }

  // Screen-reader announcements use task titles instead of internal ids.
  const titleOf = (id: string | number) => openTasks.find((t) => t.id === id)?.title ?? 'task';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${titleOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${titleOf(active.id)} at ${titleOf(over.id)}.` : 'Dropped.'),
    onDragCancel: ({ active }) => `Cancelled moving ${titleOf(active.id)}.`,
  };

  const mainTasks = doneAsSection ? openTasks : [...openTasks, ...doneTasks];

  return (
    <div className="flex flex-col gap-3">
      {mainTasks.length > 0 &&
        (draggable ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
            <SortableContext items={openTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul aria-label="Tasks" className={LIST_CLASS}>
                {openTasks.map((task) => (
                  <SortableTaskItem key={task.id} task={task} {...item} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul aria-label="Tasks" className={LIST_CLASS}>
            {mainTasks.map((task) => (
              <li key={task.id}>
                <Item task={task} {...item} />
              </li>
            ))}
          </ul>
        ))}

      {doneAsSection && doneTasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone((x) => !x)}
            aria-expanded={showDone}
            className="flex items-center gap-1 self-start rounded-md px-1 py-0.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showDone ? 'rotate-90' : ''}`} aria-hidden />
            Completed · {doneTasks.length}
          </button>
          {showDone && (
            <ul aria-label="Completed tasks" className={LIST_CLASS}>
              {doneTasks.map((task) => (
                <li key={task.id}>
                  <Item task={task} {...item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// One panel with hairline dividers between rows reads far calmer than a stack of separate cards.
const LIST_CLASS = 'card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800/70';

function Item({
  task,
  categoriesById,
  ...rest
}: ItemCallbacks & { task: Task; dragHandleProps?: TaskItemProps['dragHandleProps'] }) {
  return <TaskItem task={task} category={task.categoryId ? categoriesById.get(task.categoryId) : undefined} {...rest} />;
}

function SortableTaskItem({ task, ...rest }: ItemCallbacks & { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 bg-white shadow-lg dark:bg-slate-900' : undefined}
    >
      <Item task={task} {...rest} dragHandleProps={{ ...attributes, ...listeners }} />
    </li>
  );
}
