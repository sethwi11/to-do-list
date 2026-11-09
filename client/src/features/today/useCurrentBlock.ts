import { useMemo } from 'react';
import { planningDate, routineOn, type PlanItem, type RoutineBlock, type WeekTemplate } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { routineBlockHooks, weekTemplateHooks } from '../../data/useRoutine';
import { currentItem } from './todayModel';

const NO_TEMPLATES: WeekTemplate[] = [];
const NO_BLOCKS: RoutineBlock[] = [];

/** The routine block happening at `now` (read-only; the Week page changes the routine). */
export function useCurrentBlock(now: string): PlanItem | undefined {
  const { semesters, calendars } = useApp();
  const templates = weekTemplateHooks.useList().data ?? NO_TEMPLATES;
  const blocks = routineBlockHooks.useList().data ?? NO_BLOCKS;
  return useMemo(() => {
    const live = blocks.filter((b) => templates.some((t) => t.id === b.templateId));
    return currentItem(routineOn({ templates, blocks: live, semesters, calendars }, planningDate(templates, now)), now);
  }, [templates, blocks, semesters, calendars, now]);
}
