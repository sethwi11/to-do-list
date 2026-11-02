import { useCallback, useEffect, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  onUndo?: () => void;
}

/** One toast at a time: a new action replaces the previous toast (and its undo chance). */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, onUndo?: () => void) => {
    setToast({ id: Date.now(), message, onUndo });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

const DURATION_MS = 5000;

/**
 * Bottom-of-screen toast with an Undo button. It auto-dismisses after 5s,
 * but the timer pauses while the pointer or keyboard focus is on it, so
 * slower readers and keyboard users aren't racing a clock (WCAG 2.2.1).
 */
export function UndoToast({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!toast || paused) return;
    timer.current = window.setTimeout(onDismiss, DURATION_MS);
    return () => window.clearTimeout(timer.current);
  }, [toast, paused, onDismiss]);

  return (
    // The live region is always in the DOM, so screen readers announce new messages.
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          role="status"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex max-w-md items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          <span className="min-w-0 truncate">{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              onClick={() => {
                toast.onUndo?.();
                onDismiss();
              }}
              className="shrink-0 font-semibold text-indigo-300 hover:text-indigo-200 dark:text-indigo-700 dark:hover:text-indigo-800"
            >
              Undo
            </button>
          )}
          <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
