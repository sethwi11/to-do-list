import { useRef } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { formatDueDate } from '../lib/dates';

interface Props {
  value: string; // "" = no date
  onChange: (value: string) => void;
  today: string;
}

/**
 * A compact "📅 Tomorrow" button that opens the browser's own date picker.
 * The native <input type="date"> sits invisibly underneath, so we get the
 * platform's accessible picker without its cluttered "mm/dd/yyyy" field.
 */
export function DueDatePicker({ value, onChange, today }: Props) {
  const input = useRef<HTMLInputElement>(null);

  function open() {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker(); // Chrome 99+, Safari 16+, Firefox 101+
    } catch {
      el.focus();
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={open}
        aria-label={value ? `Due date: ${formatDueDate(value, today)}. Change` : 'Set a due date'}
        className={`pill ${value ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        {value ? formatDueDate(value, today) : 'Date'}
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear due date" className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
      <input
        ref={input}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  );
}
