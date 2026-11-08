import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface EntityApi<T, C, U> {
  list(): Promise<T[]>;
  create(input: C): Promise<T>;
  update(id: string, changes: U): Promise<T>;
  remove(id: string): Promise<void>;
}

/** Hooks for any kind of data that follows the standard list/create/update/delete shape. */
export function createEntityHooks<T extends { id: string }, C extends { id?: string | undefined }, U extends object>(
  name: string,
  api: EntityApi<T, C, U>,
) {
  const key = [name] as const;

  function useList() {
    return useQuery({ queryKey: key, queryFn: api.list });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: C) => api.create({ ...input, id: input.id ?? crypto.randomUUID() }),
      onSuccess: (row) => qc.setQueryData<T[]>(key, (prev = []) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row])),
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: U }) => api.update(id, changes),
      onMutate: async ({ id, changes }) => {
        await qc.cancelQueries({ queryKey: key }); // an in-flight refetch must not overwrite our optimistic value
        const previous = qc.getQueryData<T[]>(key);
        qc.setQueryData<T[]>(key, (prev = []) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
        return { previous };
      },
      onError: (_err, _vars, ctx) => ctx && qc.setQueryData(key, ctx.previous),
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => api.remove(id),
      onMutate: async (id) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<T[]>(key);
        qc.setQueryData<T[]>(key, (prev = []) => prev.filter((r) => r.id !== id));
        return { previous };
      },
      onError: (_err, _id, ctx) => ctx && qc.setQueryData(key, ctx.previous),
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    });
  }

  return { key, useList, useCreate, useUpdate, useDelete };
}
