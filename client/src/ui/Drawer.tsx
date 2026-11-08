import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../lib/cx';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, e.g. "Menu". */
  label: string;
  children: ReactNode;
  className?: string;
}

/** The phone sidebar: slides in from the left, built on <dialog> like Dialog (focus trapped, Escape and a tap outside close it). */
export function Drawer({ open, onClose, label, children, className }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none animate-drawer border-r border-rule bg-surface p-0 text-ink backdrop:bg-(--backdrop)',
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}
