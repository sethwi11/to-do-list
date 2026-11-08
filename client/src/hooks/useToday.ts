import { useEffect, useState } from 'react';
import { todayLocalISO } from '../lib/dates';

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Today's local date, updated when midnight passes, so an app left open overnight rolls over to the new day by itself (Today, Overdue, and every "due today" check follow). */
export function useToday(): string {
  const [today, setToday] = useState(() => todayLocalISO());
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      // A second past midnight, to be safely on the new date.
      timer = window.setTimeout(() => {
        setToday(todayLocalISO());
        schedule();
      }, msUntilNextMidnight(new Date()) + 1000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return today;
}
