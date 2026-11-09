import { useCallback, useEffect, useState } from 'react';
import type { PlanItem } from '@todo/shared';
import { useAppSettings } from '../../data/useApplications';
import { focusSessionHooks } from '../../data/useCheckIns';

// Pomodoro on a focus block: focus and break intervals until the block ends, each finished focus interval saved as a session.

export interface FocusState {
  /** The planned item it runs for. */
  key: string;
  title: string;
  /** When the block ends (ms): the timer stops there. */
  blockEnd: number;
  phase: 'focus' | 'break';
  phaseStart: number;
  phaseEnd: number;
  /** Focus intervals finished so far. */
  done: number;
}

const KEY = 'planner.focus';
const read = (): FocusState | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as FocusState | null;
  } catch {
    return null;
  }
};
const write = (s: FocusState | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the timer still runs, it just won't survive a reload.
  }
};

/** A short two-note chime, made in the browser (no files, no network). */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    // No audio available: the change still shows on screen.
  }
}

/** The local datetime "YYYY-MM-DDTHH:mm" as a timestamp. */
const ms = (dt: string) => new Date(`${dt}:00`).getTime();

export function useFocusTimer() {
  const { settings } = useAppSettings();
  const f = settings.focus;
  const save = focusSessionHooks.useCreate();
  const [state, setState] = useState<FocusState | null>(read);
  const [now, setNow] = useState(() => Date.now());

  const set = useCallback((s: FocusState | null) => {
    write(s);
    setState(s);
  }, []);
  const record = useCallback(
    (from: number, to: number) => {
      // Under a minute isn't worth a session.
      if (to - from >= 60_000) save.mutate({ taskId: null, startedAt: new Date(from).toISOString(), durationSeconds: Math.round((to - from) / 1000) });
    },
    [save],
  );

  // Ticks once a second while running; moves between focus and break, and stops when the block ends.
  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < state.phaseEnd) return;
      if (state.phase === 'focus') record(state.phaseStart, state.phaseEnd);
      if (state.phaseEnd >= state.blockEnd) return set(null);
      if (f.sound) chime();
      const done = state.done + (state.phase === 'focus' ? 1 : 0);
      const minutes = state.phase === 'focus' ? (done % f.longBreakEvery === 0 ? f.longBreakMinutes : f.breakMinutes) : f.focusMinutes;
      set({ ...state, done, phase: state.phase === 'focus' ? 'break' : 'focus', phaseStart: t, phaseEnd: Math.min(t + minutes * 60_000, state.blockEnd) });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, f, record, set]);

  const start = useCallback(
    (item: PlanItem) => {
      const t = Date.now();
      const blockEnd = ms(item.end);
      if (blockEnd <= t) return;
      set({ key: item.key, title: item.title, blockEnd, phase: 'focus', phaseStart: t, phaseEnd: Math.min(t + f.focusMinutes * 60_000, blockEnd), done: 0 });
      setNow(t);
    },
    [f.focusMinutes, set],
  );

  const stop = useCallback(() => {
    if (state?.phase === 'focus') record(state.phaseStart, Date.now());
    set(null);
  }, [state, record, set]);

  return { state, now, start, stop, settings: f };
}
