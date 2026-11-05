import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyPlan, type BatchPlan, type Event } from '@todo/shared';
import { eventsApi, eventTypesApi } from '../api/entities';
import { keys } from './queryClient';

export const useEventsQuery = () => useQuery({ queryKey: keys.events, queryFn: eventsApi.list });
export const useEventTypesQuery = () => useQuery({ queryKey: keys.eventTypes, queryFn: eventTypesApi.list });

/**
 * Every change to events (create, edit, move, delete, and undo of each) is one batch.
 * Optimistic like the other mutations: the calendar updates at once, using the very same
 * applyPlan the tests use, and rolls back if the server refuses any part of it.
 */
export function useApplyEventBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: BatchPlan) => eventsApi.batch(plan),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: keys.events }); // an in-flight refetch must not overwrite our optimistic value
      const previous = qc.getQueryData<Event[]>(keys.events);
      qc.setQueryData<Event[]>(keys.events, (prev = []) => applyPlan(prev, plan));
      return { previous };
    },
    onError: (_err, _plan, ctx) => ctx && qc.setQueryData(keys.events, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}
