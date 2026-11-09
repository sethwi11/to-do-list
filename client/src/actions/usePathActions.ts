import { useQueryClient } from '@tanstack/react-query';
import type { Milestone } from '@todo/shared';
import { ApiError } from '../api/client';
import { milestonesApi } from '../api/entities';
import { useApp } from '../app/AppContext';
import { milestoneHooks } from '../data/usePath';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const NONE: never[] = [];

export type MilestoneFields = Pick<Milestone, 'title' | 'targetDate' | 'calendarIds' | 'savingsGoalId' | 'trackOffers'>;

/** The milestones and every change to them, each with Undo. */
export function useMilestones() {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const list = milestoneHooks.useList();
  const create = milestoneHooks.useCreate();
  const update = milestoneHooks.useUpdate();
  const remove = milestoneHooks.useDelete();

  async function attempt<T>(what: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (err) {
      showToast(`Couldn’t ${what}: ${messageOf(err)}`);
      return null;
    }
  }
  const undo = (run: () => Promise<unknown>) => () => void run().then(() => qc.invalidateQueries({ queryKey: milestoneHooks.key })).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));

  async function save(fields: MilestoneFields, existing?: Milestone) {
    if (!existing) {
      const m = await attempt('add the milestone', () => create.mutateAsync(fields));
      if (m) showToast(`Added “${m.title}”`, undo(() => milestonesApi.remove(m.id)));
      return m;
    }
    const previous: MilestoneFields = { title: existing.title, targetDate: existing.targetDate, calendarIds: existing.calendarIds, savingsGoalId: existing.savingsGoalId, trackOffers: existing.trackOffers };
    const m = await attempt('save the milestone', () => update.mutateAsync({ id: existing.id, changes: fields }));
    if (m) showToast(`Saved “${m.title}”`, undo(() => milestonesApi.update(existing.id, previous)));
    return m;
  }

  /** Mark it reached today (or reopen it with null). A badge already earned stays earned. */
  async function setReached(m: Milestone, reachedOn: string | null) {
    const done = await attempt('save that', () => update.mutateAsync({ id: m.id, changes: { reachedOn } }));
    if (done) showToast(reachedOn ? `Reached: “${m.title}”` : `Reopened “${m.title}”`, undo(() => milestonesApi.update(m.id, { reachedOn: m.reachedOn })));
  }

  async function deleteMilestone(m: Milestone) {
    const done = await attempt('delete the milestone', () => remove.mutateAsync(m.id));
    if (done !== null) showToast(`Deleted “${m.title}”`, undo(() => milestonesApi.restore(m.id)));
  }

  return { milestones: list.data ?? NONE, loading: list.isPending, save, setReached, deleteMilestone };
}
