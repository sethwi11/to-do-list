import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';

export interface ToastMessage {
  id: number;
  message: string;
  onUndo?: () => void;
}

/**
 * One toast at a time: a new one replaces the last (and the last one's chance to Undo).
 *
 * `onCommit` is for things that can't be taken back once done, like deleting a file: it runs when the
 * undo window closes WITHOUT Undo being used (the toast times out, is dismissed, or is replaced by a newer one).
 */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const pendingCommit = useRef<(() => void) | null>(null);

  const settle = useCallback(() => {
    const commit = pendingCommit.current;
    pendingCommit.current = null;
    commit?.();
  }, []);

  const show = useCallback(
    (message: string, onUndo?: () => void, onCommit?: () => void) => {
      settle(); // the previous toast can no longer be undone
      pendingCommit.current = onCommit ?? null;
      const undo = onUndo && (() => {
        pendingCommit.current = null; // undone: the permanent part must not happen
        onUndo();
      });
      setToast({ id: Date.now(), message, onUndo: undo });
    },
    [settle],
  );
  const dismiss = useCallback(() => {
    settle();
    setToast(null);
  }, [settle]);
  return { toast, show, dismiss };
}

interface ToastViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  message: string;
  onUndo?: () => void;
  onDismiss?: () => void;
}

/** The toast itself: inverted colors (ink background, paper text), 4px corners, an Undo link in tomato. */
export function ToastView({ message, onUndo, onDismiss, className, ...rest }: ToastViewProps) {
  return (
    <div role="status" className={cx('flex max-w-md items-center gap-4 rounded-control bg-toast-bg py-2 pr-1.5 pl-4 text-body text-toast-text', className)} {...rest}>
      <span className="min-w-0 flex-1">{message}</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className="shrink-0 rounded-control px-1 font-medium text-toast-link underline-offset-2 hover:underline">
          Undo
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-control opacity-70 hover:opacity-100">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

const DURATION_MS = 5000;

/**
 * Shows the current toast bottom-center (above the + button on a phone, so it never covers it, and clear of the sidebar's Settings link on a desktop) and dismisses it after 5 seconds. The timer
 * pauses while the pointer or keyboard focus is on the toast, so nobody is racing a clock
 * to hit Undo.
 */
export function ToastHost({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!toast || paused) return;
    timer.current = window.setTimeout(onDismiss, DURATION_MS);
    return () => window.clearTimeout(timer.current);
  }, [toast, paused, onDismiss]);

  return (
    // The region stays in the page so screen readers announce each new message.
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 left-4 z-50 sm:right-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2">
      {toast && (
        <ToastView
          key={toast.id}
          message={toast.message}
          className="pointer-events-auto animate-pop"
          onUndo={
            toast.onUndo &&
            (() => {
              toast.onUndo?.();
              onDismiss();
            })
          }
          onDismiss={onDismiss}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        />
      )}
    </div>
  );
}
