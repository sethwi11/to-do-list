import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTheme } from './useTheme';

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

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * One copy of the settings for the whole app. (A hook with its own state would give
 * every component that used it a separate copy, and a theme toggle in the header and one in
 * the settings dialog would disagree.) The provider also applies the theme to the page.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  useTheme(settings.theme);

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

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
