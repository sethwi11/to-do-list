import { cx } from '../lib/cx';

interface TabsProps<T extends string> {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** What the tabs switch between, for screen readers, e.g. "Task lists". */
  label: string;
  className?: string;
}

/** A row of text tabs; the current one is underlined in ink. Used to switch lists on a page. */
export function Tabs<T extends string>({ tabs, value, onChange, label, className }: TabsProps<T>) {
  return (
    <nav aria-label={label} className={cx('flex gap-6 border-b border-hairline', className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px h-9 border-b-2 text-body transition-colors duration-150 ease-out',
              on ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
