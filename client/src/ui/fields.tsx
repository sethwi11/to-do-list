import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../lib/cx';

// Form controls.
const control =
  'w-full rounded-control border border-rule bg-surface px-3 text-body text-ink transition-colors duration-150 ease-out hover:border-ink-muted disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:border-rule';

/** A small uppercase label that sits above a control. */
export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx('mb-1.5 block text-label text-ink-muted uppercase', className)}>
      {children}
    </label>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Receives the id to put on the control, so label, hint, and error are wired up for screen readers. */
  children: (props: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': true | undefined }) => ReactNode;
}

/** Label + control + hint/error text, correctly associated. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-describedby': note ? noteId : undefined, 'aria-invalid': error ? true : undefined })}
      {note && (
        <p id={noteId} className={cx('mt-1.5 text-meta', error ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, 'h-9', 'aria-invalid:border-danger', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'min-h-24 py-2 aria-invalid:border-danger', className)} {...rest} />;
}

export function Select({ className, wrapperClassName, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={cx('relative', wrapperClassName)}>
      <select className={cx(control, 'h-9 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface QuickAddProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string;
  /** The key shown at the right edge. Defaults to the command-palette shortcut. */
  shortcut?: string;
}

/** The quick-add box: a single underlined line, no box. */
export function QuickAddInput({ className, placeholder = 'Add a task or event…', shortcut = isMac ? '⌘K' : 'Ctrl K', ...rest }: QuickAddProps) {
  return (
    <div
      className={cx(
        'flex items-center border-b border-rule transition-colors duration-150 ease-out focus-within:border-accent focus-within:shadow-[inset_0_-1px_0_0_var(--accent)]',
        className,
      )}
    >
      <input
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 min-w-0 flex-1 bg-transparent text-body text-ink outline-none focus-visible:outline-none"
        {...rest}
      />
      {/* Hidden on a phone, where there is no keyboard to press it on. */}
      <kbd aria-hidden className="ml-3 hidden shrink-0 font-mono text-time text-ink-muted sm:block">
        {shortcut}
      </kbd>
    </div>
  );
}

/** A small uppercase section label with a hairline running to the end of the column. */
export function SectionLabel({ children, count, as: Tag = 'h2', className }: { children: ReactNode; count?: number; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <Tag className={cx('flex items-center gap-3 text-label text-ink-muted uppercase', className)}>
      <span>
        {children}
        {count !== undefined && <span className="ml-2 font-mono font-normal">{count}</span>}
      </span>
      <span aria-hidden className="h-px flex-1 bg-hairline" />
    </Tag>
  );
}

/** A keyboard key, e.g. in shortcut lists. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-control border border-rule bg-surface px-1.5 py-0.5 font-mono text-time text-ink-muted">{children}</kbd>;
}
