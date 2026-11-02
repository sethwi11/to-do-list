import { useCallback, useState } from 'react';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** Read replies aloud. */
  tts: boolean;
  /** Add high-confidence new tasks without review (actions still need review). */
  autoAccept: boolean;
  voiceMode: 'push-to-talk' | 'conversation';
  notifications: boolean;
}

const DEFAULTS: Settings = { theme: 'system', tts: true, autoAccept: false, voiceMode: 'push-to-talk', notifications: false };
const KEY = 'voice-todo.settings';

/** Confidence at or above which auto-accept adds a task without review. */
export const AUTO_ACCEPT_THRESHOLD = 0.85;

// Settings are per-device preferences, so localStorage (not the server) is the
// right home. Every access is wrapped: storage can throw in private windows.
function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, update };
}
