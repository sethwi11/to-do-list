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
const withNote = (message: string, note?: string) => (note ? `${message}. ${note}` : message);

/** A change that was saved and can be taken back. */
export interface Applied {
  undo: () => Promise<void>;
}

/** Asked before an event is deleted: any files only it uses can be deleted too. See useFileDeletionPrompt. */
export type ConfirmFiles = (owners: { ownerType: 'event'; ownerId: string }[], title: string) => Promise<{ proceed: boolean; commit?: () => void }>;

export interface EventActions {
  /** Apply a ready-made plan with no toast of its own. Resolves to a way to undo it, or null (after saying why) if refused. */
  applyEventPlan: (plan: BatchPlan) => Promise<Applied | null>;
  /** Add several events in one go, with no toast of its own (the caller reports). Resolves to their ids and a way to undo, or null if refused. */
  createEvents: (inputs: CreateEventInput[]) => Promise<(Applied & { ids: string[] }) | null>;
  /** `options.note` is added to the toast (e.g. "Overlaps with ..."). */
  createEvent: (input: CreateEventInput, options?: { note?: string }) => Promise<boolean>;
  /**
   * Change one occurrence. If it belongs to a repeating event, asks which events the change
   * applies to first. Resolves to false if that was cancelled or the server refused (so a
   * drag can snap back).
   */
  editEvent: (occurrence: EventOccurrence, changes: EventChanges, options?: { verb?: Exclude<ScopeVerb, 'Delete'>; message?: string; note?: string; scope?: EditScope }) => Promise<boolean>;
  /** `scope` skips the "which events?" question when the caller already knows (cancelling one class meeting). */
  deleteEvent: (occurrence: EventOccurrence, options?: { scope?: EditScope; message?: string }) => Promise<boolean>;
}

/**
 * Everything that changes events. Each action builds a plan (a few rows to write and delete,
 * from the shared tested code), sends it as one batch, and shows a toast whose Undo sends
 * the inverse batch.
 */
export function useEventActions(showToast: (message: string, onUndo?: () => void, onCommit?: () => void) => void, confirmFiles: ConfirmFiles) {
  const qc = useQueryClient();
  const eventsQuery = useEventsQuery();
  const typesQuery = useEventTypesQuery();
  const { mutateAsync: applyBatch } = useApplyEventBatch();
  const { ask, dialog: scopeDialog } = useScopePrompt();

  const currentEvents = useCallback(() => qc.getQueryData<Event[]>(keys.events) ?? [], [qc]);

  /** Apply a plan. Resolves to a way to undo it, or null (after saying why) if the server refused. */
  const apply = useCallback(
    async (plan: BatchPlan): Promise<Applied | null> => {
      const before = currentEvents();
      try {
        await applyBatch(plan);
      } catch (err) {
        showToast(`Couldn't save that: ${messageOf(err)}`);
        return null;
      }
      const inverse = invertPlan(plan, before);
      return { undo: () => applyBatch(inverse).then(() => undefined) };
    },
    [applyBatch, currentEvents, showToast],
  );

  /** Apply a plan and offer Undo in a toast. Resolves to whether it was saved. `onCommit` runs when the undo window closes unused. */
  const run = useCallback(
    async (plan: BatchPlan, message: string, onCommit?: () => void): Promise<boolean> => {
      const applied = await apply(plan);
      if (!applied) return false;
      showToast(message, () => {
        applied.undo().catch((err: unknown) => showToast(`Couldn't undo that: ${messageOf(err)}`));
      }, onCommit);
      return true;
    },
    [apply, showToast],
  );

  const scopeFor = useCallback(
    async (occurrence: EventOccurrence, verb: ScopeVerb): Promise<EditScope | null> =>
      occurrence.isRecurring ? ask({ verb, title: occurrence.event.title }) : 'this',
    [ask],
  );

  const actions: EventActions = {
    applyEventPlan: apply,
    createEvents: useCallback(
      async (inputs) => {
        const now = new Date().toISOString();
        const rows = inputs.map((input) => buildEvent(input, input.id ?? crypto.randomUUID(), now));
        const applied = await apply({ put: rows, remove: [] });
        return applied && { ...applied, ids: rows.map((r) => r.id) };
      },
      [apply],
    ),
    createEvent: useCallback(
      (input, options) => run({ put: [buildEvent(input, input.id ?? crypto.randomUUID(), new Date().toISOString())], remove: [] }, withNote(`Added “${input.title}”`, options?.note)),
      [run],
    ),
    editEvent: useCallback(
      async (occurrence, changes, options = {}) => {
        const scope = options.scope ?? (await scopeFor(occurrence, options.verb ?? 'Edit'));
        if (!scope) return false;
        const plan = planEventEdit({ events: currentEvents(), occurrence, changes, scope, now: new Date().toISOString(), newId: () => crypto.randomUUID() });
        const title = changes.title ?? occurrence.event.title;
        return run(plan, withNote(options.message ?? `Saved “${title}”`, options.note));
      },
      [scopeFor, currentEvents, run],
    ),
    deleteEvent: useCallback(
      async (occurrence, options = {}) => {
        const scope = options.scope ?? (await scopeFor(occurrence, 'Delete'));
        if (!scope) return false;
        const plan = planEventDelete({ events: currentEvents(), occurrence, scope, now: new Date().toISOString(), newId: () => crypto.randomUUID() });
        // Files only a deleted event used can go with it (if the person says so, once Undo is no longer possible).
        const files = await confirmFiles(plan.remove.map((id) => ({ ownerType: 'event' as const, ownerId: id })), occurrence.event.title);
        if (!files.proceed) return false;
        return run(plan, options.message ?? `Deleted “${occurrence.event.title}”`, files.commit);
      },
      [scopeFor, currentEvents, run, confirmFiles],
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
