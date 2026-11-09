import { useEffect, useSyncExternalStore } from 'react';

// True full screen for the whole app (the Fullscreen API on the page's root), so navigation keeps working inside it.

const KEY = 'planner.fullscreen';
const subscribe = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify);
  return () => document.removeEventListener('fullscreenchange', notify);
};
const save = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? '1' : '');
  } catch {
    // Private mode: nothing to remember with.
  }
};

/** Whether the app was in full screen when it was last closed (browsers need a click to go back in). */
export function wasFullscreen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1' && !document.fullscreenElement;
  } catch {
    return false;
  }
}

export const forgetFullscreen = () => save(false);

const toggle = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => {});
};

/** Full screen on or off, and a toggle. Esc leaves full screen too (the browser does that). */
export function useFullscreen() {
  const on = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null, () => false);
  return { on, toggle, supported: typeof document !== 'undefined' && document.fullscreenEnabled };
}

/** Once per screen (the app shell or the display view): Shift+F toggles full screen, and the choice is remembered for next time. */
export function useFullscreenShortcut() {
  useEffect(() => {
    // Closing the window can also end full screen; that exit must not erase the choice.
    let closing = false;
    const onClose = () => (closing = true);
    const onChange = () => !closing && save(document.fullscreenElement !== null);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (e.key === 'F' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('pagehide', onClose);
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pagehide', onClose);
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
