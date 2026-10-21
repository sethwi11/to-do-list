import type { Category, Task, UpdateTaskInput } from '@todo/shared';
import { TaskItem } from './TaskItem';

interface Props {
  tasks: Task[];
  categoriesById: Map<string, Category>;
  today: string;
  onUpdate: (id: string, changes: UpdateTaskInput) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, categoriesById, today, onUpdate, onDelete }: Props) {
  return (
    <ul aria-label="Tasks" className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          category={task.categoryId ? categoriesById.get(task.categoryId) : undefined}
          today={today}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
