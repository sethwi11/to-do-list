import { useEffect, useState } from 'react';

/** Milliseconds from `now` until the clock next shows a new minute (0 seconds). */
export function msUntilNextMinute(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

/**
 * The current time, refreshed each time the clock turns over a minute. A countdown or "now" line
 * only needs minute accuracy, so it wakes once a minute, exactly on the minute, rather than ticking every second.
 * (If the computer sleeps, the next wake-up simply happens late and the time jumps to the right value.)
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextMinute(new Date()) + 50); // a hair after the minute, so we never land just before it
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}
