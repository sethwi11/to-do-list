import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode; /** Name for screen readers and the tooltip, needed when the label is a letter or an icon. */ title?: string }[];
  /** What the control chooses, e.g. "Calendar view". */
  label: string;
  className?: string;
}

/** A small row of mutually exclusive choices (view switcher, theme). A real radio group underneath. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex h-8 overflow-hidden rounded-control border border-rule', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.title}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'min-w-8 border-l border-rule px-2.5 text-body font-medium transition-colors duration-150 ease-out first:border-l-0',
              on ? 'bg-ink text-paper' : 'text-ink hover:bg-accent-soft',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
