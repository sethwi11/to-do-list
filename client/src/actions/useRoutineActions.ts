import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Bump, CreateRoutineOverrideInput, PlanItem, RoutineBlock, RoutineOverride, Task, WeekTemplate } from '@todo/shared';
import { ApiError } from '../api/client';
import { routineBlocksApi, routineOverridesApi, timeBlocksApi, weekTemplatesApi } from '../api/entities';
import { useApp } from '../app/AppContext';
import { routineBlockHooks, routineOverrideHooks, weekTemplateHooks } from '../data/useRoutine';
import { timeBlockHooks } from '../data/useTimeBlocks';

export type BlockFields = Omit<RoutineBlock, 'id' | 'createdAt' | 'updatedAt'>;
export type TemplateFields = Omit<WeekTemplate, 'id' | 'createdAt' | 'updatedAt'>;

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const EMPTY_TEMPLATES: WeekTemplate[] = [];
const EMPTY_BLOCKS: RoutineBlock[] = [];
const EMPTY_OVERRIDES: RoutineOverride[] = [];

/** The weekly routine (templates and their blocks) and everything that changes it, each change with Undo. */
export function useRoutine() {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const templatesQuery = weekTemplateHooks.useList();
  const blocksQuery = routineBlockHooks.useList();
  const overridesQuery = routineOverrideHooks.useList();
  const overrides = overridesQuery.data ?? EMPTY_OVERRIDES;
  const createOverride = routineOverrideHooks.useCreate();
  const removeOverride = routineOverrideHooks.useDelete();
  const templates = templatesQuery.data ?? EMPTY_TEMPLATES;
  const allBlocks = blocksQuery.data ?? EMPTY_BLOCKS;
  // A deleted template's blocks stay in the database (so Undo brings them back) but don't show.
  const blocks = useMemo(() => allBlocks.filter((b) => templates.some((t) => t.id === b.templateId)), [allBlocks, templates]);
  const createBlock = routineBlockHooks.useCreate();
  const updateBlock = routineBlockHooks.useUpdate();
  const removeBlock = routineBlockHooks.useDelete();
  const createTemplate = weekTemplateHooks.useCreate();
  const updateTemplate = weekTemplateHooks.useUpdate();
  const removeTemplate = weekTemplateHooks.useDelete();

  const refresh = useCallback(() => Promise.all([qc.invalidateQueries({ queryKey: routineBlockHooks.key }), qc.invalidateQueries({ queryKey: weekTemplateHooks.key })]), [qc]);
  const attempt = useCallback(
    async <T,>(what: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch (err) {
        showToast(`Couldn’t ${what}: ${messageOf(err)}`);
        return null;
      }
    },
    [showToast],
  );
  const undoWith = useCallback((run: () => Promise<unknown>) => () => void run().then(refresh).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`)), [refresh, showToast]);

  const saveBlock = useCallback(
    async (fields: BlockFields, existing?: RoutineBlock) => {
      if (!existing) {
        const block = await attempt('add the block', () => createBlock.mutateAsync(fields));
        if (block) showToast(`Added “${block.title}”`, undoWith(() => routineBlocksApi.remove(block.id)));
        return block;
      }
      const { id: _i, createdAt: _c, updatedAt: _u, ...previous } = existing;
      const block = await attempt('save the block', () => updateBlock.mutateAsync({ id: existing.id, changes: fields }));
      if (block) showToast(`Saved “${block.title}”`, undoWith(() => routineBlocksApi.update(existing.id, previous)));
      return block;
    },
    [attempt, createBlock, updateBlock, showToast, undoWith],
  );

  const moveBlock = useCallback(
    async (block: RoutineBlock, to: Pick<RoutineBlock, 'weekday' | 'start' | 'end'>) => {
      const previous = { weekday: block.weekday, start: block.start, end: block.end };
      const saved = await attempt('move the block', () => updateBlock.mutateAsync({ id: block.id, changes: to }));
      if (saved) showToast(`Moved “${block.title}”`, undoWith(() => routineBlocksApi.update(block.id, previous)));
      return saved !== null;
    },
    [attempt, updateBlock, showToast, undoWith],
  );

  const deleteBlock = useCallback(
    async (block: RoutineBlock) => {
      const ok = await attempt('delete the block', () => removeBlock.mutateAsync(block.id));
      if (ok !== null) showToast(`Deleted “${block.title}”`, undoWith(() => routineBlocksApi.restore(block.id)));
    },
    [attempt, removeBlock, showToast, undoWith],
  );

  /** Copies of these blocks on other days (or in another template), in one request; Undo removes them all. */
  const copyBlocks = useCallback(
    async (source: readonly RoutineBlock[], targets: { weekday: number; templateId?: string }[], message: string) => {
      const now = new Date().toISOString();
      const put = targets.flatMap((t) => source.map((b) => ({ ...b, ...t, templateId: t.templateId ?? b.templateId, id: crypto.randomUUID(), createdAt: now, updatedAt: now })));
      if (put.length === 0) return false;
      const done = await attempt('copy that', () => routineBlocksApi.batch({ put, remove: [] }));
      await refresh();
      if (done) showToast(message, undoWith(() => routineBlocksApi.batch({ put: [], remove: put.map((b) => b.id) })));
      return done !== null;
    },
    [attempt, refresh, showToast, undoWith],
  );

  const saveTemplate = useCallback(
    async (fields: TemplateFields, existing?: WeekTemplate) => {
      if (!existing) {
        const t = await attempt('add the template', () => createTemplate.mutateAsync(fields));
        if (t) showToast(`Added “${t.name}”`, undoWith(() => weekTemplatesApi.remove(t.id)));
        return t;
      }
      const { id: _i, createdAt: _c, updatedAt: _u, ...previous } = existing;
      const t = await attempt('save the template', () => updateTemplate.mutateAsync({ id: existing.id, changes: fields }));
      if (t) showToast(`Saved “${t.name}”`, undoWith(() => weekTemplatesApi.update(existing.id, previous)));
      return t;
    },
    [attempt, createTemplate, updateTemplate, showToast, undoWith],
  );

  /** A new template with the same days and blocks, for new dates (next semester, say). */
  const duplicateTemplate = useCallback(
    async (template: WeekTemplate, fields: Pick<WeekTemplate, 'name' | 'effectiveFrom' | 'effectiveTo'>) => {
      const copy = await attempt('duplicate the template', () => weekTemplatesApi.create({ ...fields, days: template.days, meetingWindows: template.meetingWindows }));
      if (!copy) return null;
      const now = new Date().toISOString();
      const put = blocks.filter((b) => b.templateId === template.id).map((b) => ({ ...b, id: crypto.randomUUID(), templateId: copy.id, createdAt: now, updatedAt: now }));
      if (put.length > 0) await attempt('copy its blocks', () => routineBlocksApi.batch({ put, remove: [] }));
      await refresh();
      showToast(`Made “${copy.name}” with ${put.length} blocks`, undoWith(() => weekTemplatesApi.remove(copy.id)));
      return copy;
    },
    [attempt, blocks, refresh, showToast, undoWith],
  );

  const deleteTemplate = useCallback(
    async (template: WeekTemplate) => {
      const ok = await attempt('delete the template', () => removeTemplate.mutateAsync(template.id));
      if (ok !== null) showToast(`Deleted “${template.name}”`, undoWith(() => weekTemplatesApi.restore(template.id)));
      return ok !== null;
    },
    [attempt, removeTemplate, showToast, undoWith],
  );

  /** A one-day change (skip, move, replace, make-up, let go), with Undo. */
  const changeDay = useCallback(
    async (input: CreateRoutineOverrideInput, message: string) => {
      const o = await attempt('change that', () => createOverride.mutateAsync(input));
      if (o) showToast(message, () => void removeOverride.mutateAsync(o.id).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`)));
      return o;
    },
    [attempt, createOverride, removeOverride, showToast],
  );
  const makeUp = useCallback(
    (bump: Bump, slot: { start: string; end: string }) =>
      changeDay({ date: slot.start.slice(0, 10), routineBlockId: bump.blockId, action: 'makeup', start: slot.start, end: slot.end, title: bump.title, calendarId: bump.calendarId, sourceDate: bump.date }, `Making up “${bump.title}”`),
    [changeDay],
  );
  const letGo = useCallback((bump: Bump) => changeDay({ date: bump.date, routineBlockId: bump.blockId, action: 'letgo', sourceDate: bump.date }, `Let “${bump.title}” go`), [changeDay]);

  /** A to-do takes a routine block's slot for one day: time set aside for it there, and the block goes to Bumped. One Undo reverses both. */
  const replaceWithTask = useCallback(
    async (item: PlanItem, date: string, task: Task) => {
      const done = await attempt('replace that', async () => {
        const block = await timeBlocksApi.create({ id: crypto.randomUUID(), taskId: task.id, start: item.start, end: item.end });
        const o = await routineOverridesApi.create({ date, routineBlockId: item.sourceId, action: 'replace', taskId: task.id, title: task.title });
        return { block, o };
      });
      const sync = () => Promise.all([qc.invalidateQueries({ queryKey: timeBlockHooks.key }), qc.invalidateQueries({ queryKey: routineOverrideHooks.key })]);
      await sync();
      if (done) showToast(`“${task.title}” replaces “${item.title}” today`, () => void Promise.all([timeBlocksApi.remove(done.block.id), routineOverridesApi.remove(done.o.id)]).then(sync).catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`)));
      return done !== null;
    },
    [attempt, qc, showToast],
  );

  return {
    templates,
    blocks,
    overrides,
    replaceWithTask,
    changeDay,
    makeUp,
    letGo,
    loading: templatesQuery.isPending || blocksQuery.isPending || overridesQuery.isPending,
    saveBlock,
    moveBlock,
    deleteBlock,
    copyBlocks,
    saveTemplate,
    duplicateTemplate,
    deleteTemplate,
  };
}
