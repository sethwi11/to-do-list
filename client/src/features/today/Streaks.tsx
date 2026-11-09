import { useMemo, useState } from 'react';
import { isMilestone, streaksFor, type PlanSources, type Streak } from '@todo/shared';
import { checkInHooks, focusSessionHooks } from '../../data/useCheckIns';
import { toLocalISODate } from '../../lib/dates';
import { Fireworks } from '../../ui/Fireworks';

const seenKey = (s: Streak) => `planner.celebrated.${s.id}.${s.days}`;
const seen = (s: Streak) => {
  try {
    return localStorage.getItem(seenKey(s)) === '1';
  } catch {
    return true; // can't remember it, so don't replay it on every visit
  }
};

/** Every streak as of today, from check-ins and focus sessions. */
export function useStreaks(src: PlanSources, today: string): Streak[] {
  const checkIns = checkInHooks.useList().data;
  const sessions = focusSessionHooks.useList().data;
  return useMemo(() => {
    if (!checkIns || !sessions) return [];
    const focusDates = new Set(sessions.map((s) => toLocalISODate(new Date(s.startedAt))));
    return streaksFor(src, checkIns, focusDates, today);
  }, [src, today, checkIns, sessions]);
}

/** "Gym 4 · LeetCode 2": the streaks that are going. */
export function StreakChips({ streaks }: { streaks: readonly Streak[] }) {
  const going = streaks.filter((s) => s.days > 0);
  if (going.length === 0) return null;
  return (
    <ul aria-label="Streaks" className="flex flex-wrap gap-1.5">
      {going.map((s) => (
        <li key={s.id} className="rounded-control border border-rule px-2 py-0.5 text-meta">
          {s.label} <span className="font-mono tabular-nums">{s.days}</span>
          <span className="sr-only"> days in a row</span>
        </li>
      ))}
    </ul>
  );
}

/** Fireworks once for each milestone reached (7, 14, 30, 50, 100 days, then every 100). */
export function MilestoneFireworks({ streaks }: { streaks: readonly Streak[] }) {
  const [shown, setShown] = useState<string | null>(null);
  const due = streaks.find((s) => isMilestone(s.days) && !seen(s) && seenKey(s) !== shown);
  if (!due) return null;
  return (
    <Fireworks
      label={`${due.days}-day ${due.label.toLowerCase()} streak`}
      onDone={() => {
        try {
          localStorage.setItem(seenKey(due), '1');
        } catch {
          // Private mode: it just won't be remembered.
        }
        setShown(seenKey(due));
      }}
    />
  );
}
