import { useMemo } from 'react';
import { planDay, planningDate, type PlanItem } from '@todo/shared';
import { currentItem } from './todayModel';
import { usePlanSources } from './useTodayPlan';

/** The routine block happening at `now`, after the day's events and changes have taken their share. */
export function useCurrentBlock(now: string): PlanItem | undefined {
  const { src } = usePlanSources();
  return useMemo(() => currentItem(planDay(src, planningDate(src.templates, now)).items.filter((i) => i.kind === 'routine'), now), [src, now]);
}
