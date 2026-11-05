import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  // Solid tomato. The fill is --accent-ink, the text-safe tomato, so the label passes 4.5:1.
  primary: 'bg-accent-ink text-on-accent hover:bg-accent-ink/90 disabled:bg-hairline disabled:text-ink-faint',
  // A 1px ink outline, no fill.
  secondary: 'border border-ink text-ink hover:bg-accent-soft disabled:border-rule disabled:text-ink-faint disabled:hover:bg-transparent',
  // Text only; a soft tomato wash on hover.
  ghost: 'text-ink hover:bg-accent-soft disabled:text-ink-faint disabled:hover:bg-transparent',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  children: ReactNode;
}

export function Button({ variant = 'secondary', icon: Icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx(base, variants[variant], className)} {...rest}>
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: LucideIcon;
  /** Icon-only buttons have no visible text, so the label is required (and doubles as the tooltip). */
  label: string;
}

/** A 32px square ghost button holding one icon. */
export function IconButton({ icon: Icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-out hover:bg-accent-soft hover:text-ink disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent',
        className,
      )}
      {...rest}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
