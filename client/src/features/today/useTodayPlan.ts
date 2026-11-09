import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { addDays, combine, expandOccurrences, LocalDateTimeSchema, planDay, planningDate, type PlanSources } from '@todo/shared';
import { useRoutine } from '../../actions/useRoutineActions';
import { useApp } from '../../app/AppContext';
import { useNow } from '../../hooks/useNow';
import { localDateTime, toEventItem } from '../calendar/calendarModel';
import type { UpNext } from './NowCard';
import { currentItem, duringBlock, nextItem, nextUpcoming, supposedToBeDoing } from './todayModel';

/** The current minute as "YYYY-MM-DDTHH:mm", or the `?now=` in the address, to see a page as of another moment. */
export function useNowText(): string {
  const clock = useNow();
  const fake = useSearchParams()[0].get('now');
  return fake && LocalDateTimeSchema.safeParse(fake).success ? fake : localDateTime(clock);
}

/** Everything `planDay` reads, in one memo: the routine and its one-day changes plus the app's data. */
export function usePlanSources(): { src: PlanSources; routine: ReturnType<typeof useRoutine> } {
  const { tasks, events, timeBlocks, calendars, semesters } = useApp();
  const routine = useRoutine();
  const { templates, blocks, overrides } = routine;
  const src = useMemo(() => ({ templates, blocks, overrides, semesters, events, timeBlocks, tasks, calendars }), [templates, blocks, overrides, semesters, events, timeBlocks, tasks, calendars]);
  return { src, routine };
}

/** The day still going at `now`, planned: shared by Today and the display view so they always agree. */
export function useTodayPlan(now: string) {
  const { tasks, events, timeBlocks, calendarsById } = useApp();
  const { src, routine } = usePlanSources();
  const date = planningDate(routine.templates, now);
  const plan = useMemo(() => planDay(src, date), [src, date]);
  const dayEnd = plan.bed > combine(addDays(date, 1)) ? plan.bed : combine(addDays(date, 1));
  const occurrences = useMemo(() => expandOccurrences(events, combine(date), dayEnd), [events, date, dayEnd]);

  const current = currentItem(plan.items, now);
  // After the day's last item: tomorrow's first, then the next event in the coming two weeks.
  const next = useMemo((): UpNext | undefined => {
    const soon = nextItem(plan.items, now) ?? nextItem(planDay(src, addDays(date, 1)).items, now);
    if (soon) return soon;
    const upcoming = nextUpcoming(events, now);
    return upcoming && { title: upcoming.event.title, start: upcoming.start, color: toEventItem(upcoming, calendarsById).color };
  }, [plan.items, now, src, date, events, calendarsById]);
  const during = useMemo(() => duringBlock(tasks, current), [tasks, current]);
  const supposed = useMemo(() => supposedToBeDoing(tasks, timeBlocks, now, current && current.kind !== 'open' ? current : undefined), [tasks, timeBlocks, now, current]);

  return { routine, src, date, plan, occurrences, current, next, during, supposed };
}
