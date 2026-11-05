import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';

/** Where to attach: a point (where the pointer was) or the box of an element. */
export type PopoverAnchor = { x: number; y: number } | { left: number; top: number; right: number; bottom: number };

const MARGIN = 8;
const GAP = 8;

const isRect = (a: PopoverAnchor): a is Extract<PopoverAnchor, { left: number }> => 'left' in a;

/** The anchor for an element, as a plain box. */
export function anchorOf(el: Element): PopoverAnchor {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/**
 * Where the top-left corner of a `width` x `height` panel goes: beside the anchor (to its right if
 * there's room, else its left), lined up with its top, and always kept fully on screen.
 */
export function placePopover(anchor: PopoverAnchor, width: number, height: number, viewport: { width: number; height: number }) {
  const box = isRect(anchor) ? anchor : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  let left = box.right + GAP;
  if (left + width > viewport.width - MARGIN) left = box.left - GAP - width;
  let top = box.top;
  if (top + height > viewport.height - MARGIN) top = viewport.height - MARGIN - height;
  return {
    left: Math.max(MARGIN, Math.min(left, viewport.width - MARGIN - width)),
    top: Math.max(MARGIN, top),
  };
}

interface PopoverProps {
  anchor: PopoverAnchor;
  /** Describes the panel to screen readers. */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * A small floating panel attached to something on the page. On a phone it becomes a sheet at the
 * bottom of the screen instead, since there is no room beside a finger. Escape or a press outside
 * closes it, and focus goes in when it opens and back where it came from when it closes.
 */
export function Popover({ anchor, label, onClose, children, className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Measure, then place. (Before measuring, the panel is transparent, so there is no flash in the wrong spot.)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placePopover(anchor, el.offsetWidth, el.offsetHeight, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({ preventScroll: true });

    const close = () => onCloseRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onPress = (e: PointerEvent) => {
      if (!el?.contains(e.target as Node)) close();
    };
    const onScroll = (e: Event) => {
      if (!el?.contains(e.target as Node)) close(); // the thing it points at has moved
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPress, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={pos ? ({ '--pop-x': `${pos.left}px`, '--pop-y': `${pos.top}px` } as React.CSSProperties) : undefined}
      className={cx(
        'fixed z-50 rounded-panel border border-hairline bg-surface text-ink shadow-popover outline-none',
        // Phone: a sheet along the bottom. Wider: beside the anchor.
        'max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[70dvh] max-sm:overflow-y-auto',
        'sm:top-(--pop-y) sm:left-(--pop-x) sm:w-80',
        // Before it's measured it is transparent, not hidden: a hidden element can't take focus.
        pos ? 'animate-pop' : 'opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
