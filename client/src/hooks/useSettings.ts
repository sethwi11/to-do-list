import { useCallback, useState } from 'react';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  /** Browser notifications when a task's due time arrives. */
  notifications: boolean;
}

const DEFAULTS: Settings = { theme: 'system', notifications: false };
const KEY = 'voice-todo.settings';

// Settings are per-device preferences, so localStorage (not the server) is the
// right home. Every access is wrapped: storage can throw in private windows.
function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    // Keep only the settings that still exist (older versions saved more, e.g. voice options).
    const saved = JSON.parse(raw) as Partial<Settings>;
    return { theme: saved.theme ?? DEFAULTS.theme, notifications: saved.notifications ?? DEFAULTS.notifications };
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
