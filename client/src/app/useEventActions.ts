import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  buildEvent,
  invertPlan,
  planEventDelete,
  planEventEdit,
  type BatchPlan,
  type CreateEventInput,
  type EditScope,
  type Event,
  type EventChanges,
  type EventOccurrence,
} from '@todo/shared';
import { ApiError } from '../api/client';
import { keys } from '../data/queryClient';
import { useApplyEventBatch, useEventsQuery, useEventTypesQuery } from '../data/useEvents';
import { useScopePrompt, type ScopeVerb } from '../features/calendar/ScopeDialog';

const NONE: never[] = [];
const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');

export interface EventActions {
  createEvent: (input: CreateEventInput) => Promise<boolean>;
  /**
   * Change one occurrence. If it belongs to a repeating event, asks which events the change
   * applies to first. Resolves to false if that was cancelled or the server refused (so a
   * drag can snap back).
   */
  editEvent: (occurrence: EventOccurrence, changes: EventChanges, options?: { verb?: Exclude<ScopeVerb, 'Delete'>; message?: string }) => Promise<boolean>;
  deleteEvent: (occurrence: EventOccurrence) => Promise<boolean>;
}

/**
 * Everything that changes events. Each action builds a plan (a few rows to write and delete,
 * from the shared tested code), sends it as one batch, and shows a toast whose Undo sends
 * the inverse batch.
 */
export function useEventActions(showToast: (message: string, onUndo?: () => void) => void) {
  const qc = useQueryClient();
  const eventsQuery = useEventsQuery();
  const typesQuery = useEventTypesQuery();
  const { mutateAsync: applyBatch } = useApplyEventBatch();
  const { ask, dialog: scopeDialog } = useScopePrompt();

  const currentEvents = useCallback(() => qc.getQueryData<Event[]>(keys.events) ?? [], [qc]);

  /** Apply a plan and offer Undo. Resolves to whether it was saved. */
  const run = useCallback(
    async (plan: BatchPlan, message: string): Promise<boolean> => {
      const before = currentEvents();
      try {
        await applyBatch(plan);
      } catch (err) {
        showToast(`Couldn't save that: ${messageOf(err)}`);
        return false;
      }
      const undo = invertPlan(plan, before);
      showToast(message, () => {
        applyBatch(undo).catch((err: unknown) => showToast(`Couldn't undo that: ${messageOf(err)}`));
      });
      return true;
    },
    [applyBatch, currentEvents, showToast],
  );

  const scopeFor = useCallback(
    async (occurrence: EventOccurrence, verb: ScopeVerb): Promise<EditScope | null> =>
      occurrence.isRecurring ? ask({ verb, title: occurrence.event.title }) : 'this',
    [ask],
  );

  const actions: EventActions = {
    createEvent: useCallback(
      (input) => run({ put: [buildEvent(input, crypto.randomUUID(), new Date().toISOString())], remove: [] }, `Added “${input.title}”`),
      [run],
    ),
    editEvent: useCallback(
      async (occurrence, changes, options = {}) => {
        const scope = await scopeFor(occurrence, options.verb ?? 'Edit');
        if (!scope) return false;
        const plan = planEventEdit({ events: currentEvents(), occurrence, changes, scope, now: new Date().toISOString(), newId: () => crypto.randomUUID() });
        const title = changes.title ?? occurrence.event.title;
        return run(plan, options.message ?? `Saved “${title}”`);
      },
      [scopeFor, currentEvents, run],
    ),
    deleteEvent: useCallback(
      async (occurrence) => {
        const scope = await scopeFor(occurrence, 'Delete');
        if (!scope) return false;
        const plan = planEventDelete({ events: currentEvents(), occurrence, scope, now: new Date().toISOString(), newId: () => crypto.randomUUID() });
        return run(plan, `Deleted “${occurrence.event.title}”`);
      },
      [scopeFor, currentEvents, run],
    ),
  };

  return {
    events: eventsQuery.data ?? NONE,
    eventTypes: typesQuery.data ?? NONE,
    eventsLoading: eventsQuery.isPending || typesQuery.isPending,
    eventsError: eventsQuery.error ?? typesQuery.error,
    scopeDialog,
    actions,
  };
}
