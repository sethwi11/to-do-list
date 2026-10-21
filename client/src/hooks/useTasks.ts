import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';
import { ApiError } from '../api/client';
import { categoriesApi, tasksApi } from '../api/tasks';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');

/**
 * Owns the task list state and every mutation of it.
 *
 * Updates and deletes are *optimistic*: the UI changes immediately, then the
 * request runs in the background. If the request fails, we roll back to the
 * previous value and show an error. Checking a box should feel instant, and
 * the server almost always says yes.
 *
 * Creating a task is NOT optimistic, because the server assigns the id. We
 * could generate ids on the client to change that, but adding is rarely
 * where lag is noticeable.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Always points at the latest list, so the mutation callbacks below can read
  // the current state (for rollback) without being re-created on every render.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([tasksApi.list(), categoriesApi.list()]);
      setTasks(t);
      setCategories(c);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    try {
      const task = await tasksApi.create(input);
      setTasks((prev) => [...prev, task]);
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    }
  }, []);

  const updateTask = useCallback(async (id: string, changes: UpdateTaskInput) => {
    const previous = tasksRef.current.find((t) => t.id === id);
    if (!previous) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...changes } as Task) : t)));
    try {
      const saved = await tasksApi.update(id, changes);
      // Replace with the server's version (it sets updatedAt / completedAt).
      setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      setError(messageOf(err));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const index = tasksRef.current.findIndex((t) => t.id === id);
    const removed = tasksRef.current[index];
    if (!removed) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await tasksApi.remove(id);
    } catch (err) {
      // Put it back where it was.
      setTasks((prev) => [...prev.slice(0, index), removed, ...prev.slice(index)]);
      setError(messageOf(err));
    }
  }, []);

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
  };
}
