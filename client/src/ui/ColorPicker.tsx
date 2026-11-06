import { CALENDAR_COLORS, type CalendarColor } from '@todo/shared';
import { calendarVars } from '../lib/calendarColors';

const colorLabel = (c: CalendarColor) => c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ');

interface ColorPickerProps {
  value: CalendarColor;
  onChange: (color: CalendarColor) => void;
  /** Radio groups need a name; it just has to differ between pickers on one page. */
  name: string;
}

/** The nine planner colors as squares. A radio group, so arrow keys move between them and screen readers hear each color's name. */
export function ColorPicker({ value, onChange, name }: ColorPickerProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-label text-ink-muted uppercase">Color</legend>
      <div className="flex flex-wrap gap-2">
        {CALENDAR_COLORS.map((c) => (
          <label key={c} title={colorLabel(c)} className="cursor-pointer" style={calendarVars(c)}>
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} className="peer sr-only" />
            <span className="sr-only">{colorLabel(c)}</span>
            <span aria-hidden className="block size-7 bg-(color:--c) outline-offset-2 peer-checked:outline-2 peer-checked:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
