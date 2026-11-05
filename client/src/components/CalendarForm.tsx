import { useState, type FormEvent } from 'react';
import { CALENDAR_COLORS, type CalendarColor } from '@todo/shared';
import { calendarDotClass } from '../lib/calendarColors';

interface Props {
  initialName?: string;
  initialColor?: CalendarColor;
  submitLabel: string;
  onSubmit: (name: string, color: CalendarColor) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
}

/** Name + color picker, used both to create a list and to edit one. */
export function CalendarForm({ initialName = '', initialColor = 'dusty-blue', submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<CalendarColor>(initialColor);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = await onSubmit(name.trim(), color);
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Calendar name"
        placeholder="Calendar name"
        maxLength={50}
        autoFocus
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
      />

      {/* A radio group: arrow keys move between colors, and screen readers announce "blue, 7 of 10". */}
      <fieldset>
        <legend className="sr-only">Color</legend>
        <div className="flex flex-wrap gap-1.5">
          {CALENDAR_COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="list-color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="peer sr-only"
              />
              <span className="sr-only">{c}</span>
              <span
                aria-hidden
                className={`block h-5 w-5 rounded-full ${calendarDotClass[c]} ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-500 dark:ring-offset-slate-900 dark:peer-checked:ring-white`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-1">
        {onDelete && (
          <button type="button" onClick={onDelete} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
            Delete calendar
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
