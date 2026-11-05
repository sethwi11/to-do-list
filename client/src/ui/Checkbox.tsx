import type { ChangeEventHandler } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../lib/cx';

interface CheckboxProps {
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  /** What the checkbox does, for screen readers, e.g. 'Mark "Email Valencia" as done'. */
  label: string;
  /** md = 16px (task rows); sm = 12px (inside calendar blocks). */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * A square checkbox: 16px, 1.5px ink border, 3px corners; fills with ink and shows a check
 * when on. It is a real <input type="checkbox"> (invisible, stretched over a roomier hit
 * area), so keyboard, screen readers, and form behavior all come for free; the visible
 * square is drawn beside it and reacts through `peer`.
 */
export function Checkbox({ checked, onChange, label, size = 'md', className }: CheckboxProps) {
  const md = size === 'md';
  return (
    <span className={cx('relative inline-grid shrink-0 place-items-center', md ? 'size-8' : 'size-5', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={cx(
          // pointer-events-none: the check icon (opacity 0 makes it a stacking context) would otherwise paint over the input and swallow clicks.
          'pointer-events-none grid place-items-center border-[1.5px] border-ink transition-colors duration-150 ease-out peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:[&_svg]:opacity-100',
          md ? 'size-4 rounded-[3px]' : 'size-3 rounded-[2px]',
        )}
      >
        <Check className={cx('text-paper opacity-0 transition-opacity duration-150', md ? 'size-3' : 'size-2.5')} strokeWidth={2.5} />
      </span>
    </span>
  );
}
