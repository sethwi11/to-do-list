import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';
import { tasksApi } from '../api/tasks';
import { keys } from './queryClient';

export const useTasksQuery = () => useQuery({ queryKey: keys.tasks, queryFn: tasksApi.list });

/**
 * Task mutations. They follow the same optimistic pattern as createEntityHooks
 * (see there for the why), plus two task-specific things:
 *   - completing or reopening a *recurring* task makes the server create or remove
 *     a different row (the next occurrence), which the optimistic update can't
 *     predict. The refetch after every mutation picks that up.
 *   - delete/restore are soft on the server, so Undo is just "restore".
 */
export function useTaskMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.tasks });
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: keys.tasks }); // an in-flight refetch must not overwrite our optimistic value
    return { previous: qc.getQueryData<Task[]>(keys.tasks) };
  };
  const rollback = (_err: unknown, _vars: unknown, ctx?: { previous: Task[] | undefined }) => {
    if (ctx) qc.setQueryData(keys.tasks, ctx.previous);
  };
  const edit = (fn: (tasks: Task[]) => Task[]) => qc.setQueryData<Task[]>(keys.tasks, (prev = []) => fn(prev));

  const create = useMutation({
    // The id is made here, so a create that is retried later can't produce a duplicate.
    mutationFn: (input: CreateTaskInput) => tasksApi.create({ ...input, id: input.id ?? crypto.randomUUID() }),
    onSuccess: (task) => edit((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task])),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateTaskInput }) => tasksApi.update(id, changes),
    onMutate: async ({ id, changes }) => {
      const ctx = await snapshot();
      edit((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...changes } as Task) : t)));
      return ctx;
    },
    onError: rollback,
    onSuccess: (saved) => edit((prev) => prev.map((t) => (t.id === saved.id ? saved : t))),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      const ctx = await snapshot();
      edit((prev) => prev.filter((t) => t.id !== id));
      return ctx;
    },
    onError: rollback,
    onSettled: refresh,
  });

  const restore = useMutation({ mutationFn: (id: string) => tasksApi.restore(id), onSettled: refresh });

  /** Rewrites every task's sortOrder to match `orderedIds` (used when the gaps between sort values run out). */
  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => tasksApi.reorder(orderedIds),
    onMutate: async (orderedIds) => {
      const ctx = await snapshot();
      const rank = new Map(orderedIds.map((id, i) => [id, (i + 1) * 1024]));
      edit((prev) => prev.map((t) => ({ ...t, sortOrder: rank.get(t.id) ?? t.sortOrder })));
      return ctx;
    },
    onError: rollback,
    onSettled: refresh,
  });

  return { create, update, remove, restore, reorder };
}
