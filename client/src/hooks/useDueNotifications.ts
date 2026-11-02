import { useEffect, useRef } from 'react';
import type { Task } from '@todo/shared';
import { todayLocalISO } from '../lib/dates';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/**
 * Shows a browser notification when a task's due time arrives.
 *
 * Limitation, by design: this uses timers in the open page, so it only works
 * while the app is open in a tab (it can be in the background). Notifying
 * with the app closed would need a service worker plus a push server, which
 * is a lot of machinery for a local app.
 */
export function useDueNotifications(tasks: Task[], enabled: boolean) {
  const notified = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return;

    const today = todayLocalISO();
    const now = Date.now();
    const timers: number[] = [];

    for (const t of tasks) {
      if (t.status !== 'todo' || t.dueDate !== today || !t.dueTime) continue;
      const key = `${t.id}@${t.dueDate}T${t.dueTime}`;
      if (notified.current.has(key)) continue;

      const [h, m] = t.dueTime.split(':').map(Number);
      const due = new Date();
      due.setHours(h!, m!, 0, 0);
      const delay = due.getTime() - now;
      if (delay < 0 || delay > 24 * 60 * 60 * 1000) continue;

      timers.push(
        window.setTimeout(() => {
          notified.current.add(key);
          new Notification('Task due now', { body: t.title, tag: key });
        }, delay),
      );
    }
    // Re-run on every task change; old timers are cleared, so edits reschedule correctly.
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [tasks, enabled]);
}
