import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import { IconButton } from './Button';

/**
 * The look shared by popovers, menus, and modals: surface color, 8px corners, a hairline
 * border, and the app's one soft shadow. (Nothing else in the app casts a shadow.)
 */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-panel border border-hairline bg-surface text-ink shadow-popover', className)}>{children}</div>;
}

/** A panel's title: 22px Fraunces. */
export function PanelTitle({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cx('font-display text-section text-ink', className)}>
      {children}
    </h2>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons along the bottom edge. */
  footer?: ReactNode;
  /** "full" is a big, fixed-height window for things with their own scrolling parts (a file preview beside a list). */
  size?: 'md' | 'full';
}

/**
 * A modal dialog built on the browser's own <dialog> element. showModal() gives, for
 * free and correctly: focus moves into the dialog and stays trapped there, Escape closes
 * it, the page behind becomes inert, and focus returns to the opener on close. Clicking
 * the dimmed backdrop closes it too (a click there lands on the <dialog> itself).
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs while the dialog is still closed (so it does nothing), and the
      // browser then focuses the first button. A field marked data-autofocus gets focus instead.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={cx(
        'm-auto animate-pop rounded-panel border border-hairline bg-surface p-0 text-ink shadow-popover backdrop:bg-(--backdrop)',
        size === 'full' ? 'w-[min(80rem,calc(100vw-1.5rem))]' : 'w-[min(32rem,calc(100vw-2rem))]',
      )}
    >
      {open && (
        <div className={cx('flex flex-col', size === 'full' ? 'h-[min(52rem,calc(100dvh-1.5rem))]' : 'max-h-[85dvh]')}>
          <header className="flex items-start justify-between gap-4 px-6 pt-5">
            <PanelTitle id="dialog-title">{title}</PanelTitle>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mt-1 -mr-2" />
          </header>
          <div className={cx('px-6 py-4', size === 'full' ? 'min-h-0 flex-1 overflow-hidden' : 'overflow-y-auto')}>{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-hairline px-6 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
