import { todayLocalISO } from './dates';

/** The user's local date, time, and timezone, sent with every AI request. */
export function clientNow(now: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: todayLocalISO(now),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  };
}
