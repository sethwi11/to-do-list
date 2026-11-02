import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

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
    // Sits above the floating mic on phones (bottom-24), at the bottom edge on desktop.
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
      {toast && (
        <div
          key={toast.id}
          role="status"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          <span className="min-w-0 truncate">{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              onClick={() => {
                toast.onUndo?.();
                onDismiss();
              }}
              className="shrink-0 rounded-full px-2 py-0.5 font-semibold text-indigo-300 hover:bg-white/10 hover:text-indigo-200 dark:text-indigo-700 dark:hover:bg-slate-900/10 dark:hover:text-indigo-800"
            >
              Undo
            </button>
          )}
          <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 rounded-full p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
