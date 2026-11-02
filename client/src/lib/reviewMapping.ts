import type { Category, CreateTaskInput, ExtractedAction, ExtractedTask, TaskSource, UpdateTaskInput } from '@todo/shared';

/** Case-insensitive list-name lookup (the model returns names; tasks store ids). */
export function categoryIdByName(categories: Category[], name: string | null): string | null {
  if (!name) return null;
  return categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}

/** Converts an extracted (and possibly user-edited) task into a create request. */
export function toCreateInput(task: ExtractedTask, categories: Category[], source: TaskSource): CreateTaskInput {
  const minutes = task.estimatedMinutes;
  return {
    title: task.title.trim(),
    notes: task.notes?.trim() || null,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    categoryId: categoryIdByName(categories, task.category),
    subtasks: task.subtasks.map((title) => ({ id: crypto.randomUUID(), title, done: false })),
    recurrence: task.recurrence,
    estimatedMinutes: minutes && minutes > 0 && minutes <= 1440 ? minutes : null,
    source,
    sourceSnippet: task.sourceSnippet.slice(0, 2000) || null,
  };
}

/** For an `update` action: only the fields the model said to change (null = leave alone). */
export function toUpdateInput(action: ExtractedAction, categories: Category[]): UpdateTaskInput | null {
  const c = action.changes;
  if (!c) return null;
  const changes: UpdateTaskInput = {};
  if (c.title) changes.title = c.title;
  if (c.notes) changes.notes = c.notes;
  if (c.dueDate) changes.dueDate = c.dueDate;
  if (c.dueTime) changes.dueTime = c.dueTime;
  if (c.priority) changes.priority = c.priority;
  if (c.category) {
    const id = categoryIdByName(categories, c.category);
    if (id) changes.categoryId = id;
  }
  return Object.keys(changes).length ? changes : null;
}
