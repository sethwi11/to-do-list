import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';

export interface ToastMessage {
  id: number;
  message: string;
  onUndo?: () => void;
}

/** One toast at a time: a new one replaces the last (and the last one's chance to Undo). */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const show = useCallback((message: string, onUndo?: () => void) => setToast({ id: Date.now(), message, onUndo }), []);
  const dismiss = useCallback(() => setToast(null), []);
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
 * Shows the current toast bottom-left and dismisses it after 5 seconds. The timer
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
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-50 max-sm:right-4 sm:bottom-6 sm:left-6">
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
