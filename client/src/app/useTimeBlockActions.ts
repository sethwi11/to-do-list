import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { blockSpan, findClashes, formatMinutes, blockMinutes, type Event, type Task, type TimeBlock } from '@todo/shared';
import { ApiError } from '../api/client';
import { timeBlocksApi } from '../api/entities';
import { keys } from '../data/queryClient';
import { timeBlockHooks } from '../data/useTimeBlocks';
import { describeConflicts, formatWhen } from '../features/calendar/format';

export interface TimeBlockActions {
  /** Set time aside to work on a to-do: `minutes` from `start` (an hour if not given; the caller usually passes the to-do's estimate). */
  scheduleTask: (task: Task, start: string, minutes: number) => Promise<TimeBlock | null>;
  /** Move or resize a block. Warns (never blocks) if the new time overlaps something. */
  moveTimeBlock: (block: TimeBlock, span: { start: string; end: string }, options?: { message?: string }) => Promise<boolean>;
  /** Take a block off the calendar. The to-do it was for is untouched. */
  removeTimeBlock: (block: TimeBlock) => Promise<boolean>;
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const withNote = (message: string, note: string) => (note ? `${message}. ${note}` : message);

interface Deps {
  showToast: (message: string, onUndo?: () => void, onCommit?: () => void) => void;
}

/**
 * Everything that changes time blocks. Like the event actions: each one saves, then offers Undo in a toast.
 * Deleting a block is a soft delete (the server keeps the row), so Undo is a restore.
 */
export function useTimeBlockActions({ showToast }: Deps): TimeBlockActions {
  const qc = useQueryClient();
  const create = timeBlockHooks.useCreate();
  const update = timeBlockHooks.useUpdate();
  const remove = timeBlockHooks.useDelete();

  /** The overlap warning for a span, looked up from what's in the cache right now. */
  const clashNote = useCallback(
    (span: { start: string; end: string }, ignoreBlockId?: string) => {
      const events = qc.getQueryData<Event[]>(keys.events) ?? [];
      const blocks = qc.getQueryData<TimeBlock[]>(timeBlockHooks.key) ?? [];
      const tasks = qc.getQueryData<Task[]>(keys.tasks) ?? [];
      const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title;
      return describeConflicts(findClashes({ events, blocks, titleOf }, { ...span, allDay: false }, { blocks: ignoreBlockId ? new Set([ignoreBlockId]) : undefined }));
    },
    [qc],
  );

  const scheduleTask = useCallback<TimeBlockActions['scheduleTask']>(
    async (task, start, minutes) => {
      const span = blockSpan(start, minutes);
      let block: TimeBlock;
      try {
        block = await create.mutateAsync({ taskId: task.id, ...span });
      } catch (err) {
        showToast(`Couldn’t schedule that: ${messageOf(err)}`);
        return null;
      }
      showToast(withNote(`Scheduled “${task.title}”, ${formatWhen(span.start, span.end, false)}`, clashNote(span, block.id)), () => {
        void remove.mutateAsync(block.id).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
      });
      return block;
    },
    [create, remove, clashNote, showToast],
  );

  const moveTimeBlock = useCallback<TimeBlockActions['moveTimeBlock']>(
    async (block, span, options = {}) => {
      if (span.start === block.start && span.end === block.end) return true;
      const previous = { start: block.start, end: block.end };
      try {
        await update.mutateAsync({ id: block.id, changes: span });
      } catch (err) {
        showToast(`Couldn’t move that: ${messageOf(err)}`);
        return false;
      }
      const resized = blockMinutes(span) !== blockMinutes(previous);
      const message = options.message ?? (resized ? `Time block is now ${formatMinutes(blockMinutes(span))}` : 'Moved the time block');
      showToast(withNote(message, clashNote(span, block.id)), () => {
        void update.mutateAsync({ id: block.id, changes: previous }).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
      });
      return true;
    },
    [update, clashNote, showToast],
  );

  const removeTimeBlock = useCallback<TimeBlockActions['removeTimeBlock']>(
    async (block) => {
      try {
        await remove.mutateAsync(block.id);
      } catch (err) {
        showToast(`Couldn’t remove that: ${messageOf(err)}`);
        return false;
      }
      showToast('Removed the time block. The to-do is still there', () => {
        void timeBlocksApi
          .restore(block.id)
          .then(() => qc.invalidateQueries({ queryKey: timeBlockHooks.key }))
          .catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
      });
      return true;
    },
    [remove, qc, showToast],
  );

  return { scheduleTask, moveTimeBlock, removeTimeBlock };
}
