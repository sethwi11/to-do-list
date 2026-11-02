import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Category,
  CreateCategoryInput,
  CreateTaskInput,
  Task,
  UpdateCategoryInput,
  UpdateTaskInput,
} from '@todo/shared';
import { ApiError } from '../api/client';
import { categoriesApi, tasksApi } from '../api/tasks';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');

/**
 * Owns all task and list state and every mutation of it.
 *
 * Updates and deletes are *optimistic*: the UI changes immediately, then the
 * request runs in the background. If the request fails, we roll back to the
 * previous value and show an error. Checking a box should feel instant, and
 * the server almost always says yes.
 *
 * Creates are NOT optimistic, because the server assigns the id.
 */
export function useTodoData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Always point at the latest state, so the callbacks below can read current
  // values (for rollback) without being re-created on every render.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const fail = useCallback((err: unknown) => setError(messageOf(err)), []);
  const replaceTask = (task: Task) => setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([tasksApi.list(), categoriesApi.list()]);
      setTasks(t);
      setCategories(c);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- tasks -------------------------------------------------------------

  /** Returns the created task, or null on failure (the error banner shows why). */
  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      try {
        const task = await tasksApi.create(input);
        setTasks((prev) => [...prev, task]);
        return task;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );

  /** Returns the saved task, or null if the update failed (and was rolled back). */
  const updateTask = useCallback(
    async (id: string, changes: UpdateTaskInput): Promise<Task | null> => {
      const previous = tasksRef.current.find((t) => t.id === id);
      if (!previous) return null;
      replaceTask({ ...previous, ...changes } as Task);

      try {
        const saved = await tasksApi.update(id, changes);
        replaceTask(saved);

        // Completing a recurring task makes the server create the next occurrence...
        if (saved.nextOccurrenceId && saved.nextOccurrenceId !== previous.nextOccurrenceId) {
          const next = await tasksApi.get(saved.nextOccurrenceId);
          setTasks((prev) => [...prev, next]);
        }
        // ...and reopening it makes the server remove that occurrence (if still open).
        if (previous.nextOccurrenceId && !saved.nextOccurrenceId) {
          const spawnedId = previous.nextOccurrenceId;
          setTasks((prev) => prev.filter((t) => !(t.id === spawnedId && t.status === 'todo')));
        }
        return saved;
      } catch (err) {
        replaceTask(previous);
        fail(err);
        return null;
      }
    },
    [fail],
  );

  const deleteTask = useCallback(
    async (id: string): Promise<boolean> => {
      const index = tasksRef.current.findIndex((t) => t.id === id);
      const removed = tasksRef.current[index];
      if (!removed) return false;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await tasksApi.remove(id);
        return true;
      } catch (err) {
        setTasks((prev) => [...prev.slice(0, index), removed, ...prev.slice(index)]);
        fail(err);
        return false;
      }
    },
    [fail],
  );

  const restoreTask = useCallback(
    async (id: string) => {
      try {
        const task = await tasksApi.restore(id);
        setTasks((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, task]));
      } catch (err) {
        fail(err);
      }
    },
    [fail],
  );

  /** Rewrites every task's sortOrder to match `orderedIds` (used when gaps run out). */
  const reorderAll = useCallback(
    async (orderedIds: string[]) => {
      const previous = tasksRef.current;
      const rank = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1024]));
      setTasks((prev) => prev.map((t) => ({ ...t, sortOrder: rank.get(t.id) ?? t.sortOrder })));
      try {
        await tasksApi.reorder(orderedIds);
      } catch (err) {
        setTasks(previous);
        fail(err);
      }
    },
    [fail],
  );

  // ---- categories --------------------------------------------------------

  const createCategory = useCallback(
    async (input: CreateCategoryInput): Promise<Category | null> => {
      try {
        const category = await categoriesApi.create(input);
        setCategories((prev) => [...prev, category]);
        return category;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );

  const updateCategory = useCallback(
    async (id: string, changes: UpdateCategoryInput): Promise<boolean> => {
      const previous = categoriesRef.current.find((c) => c.id === id);
      if (!previous) return false;
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } as Category : c)));
      try {
        const saved = await categoriesApi.update(id, changes);
        setCategories((prev) => prev.map((c) => (c.id === id ? saved : c)));
        return true;
      } catch (err) {
        setCategories((prev) => prev.map((c) => (c.id === id ? previous : c)));
        fail(err);
        return false;
      }
    },
    [fail],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await categoriesApi.remove(id);
        setCategories((prev) => prev.filter((c) => c.id !== id));
        // Mirror the database's ON DELETE SET NULL locally.
        setTasks((prev) => prev.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)));
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [fail],
  );

  return {
    tasks,
    categories,
    loading,
    error,
    dismissError: () => setError(null),
    reload: load,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    reorderAll,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
