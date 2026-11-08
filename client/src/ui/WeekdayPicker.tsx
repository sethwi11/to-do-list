import { WEEKDAY_NAME } from '../lib/dates';
import { cx } from '../lib/cx';

const INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** Monday first, the way a week is planned (Sunday = 0 is last). */
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Seven toggle buttons, one per weekday. */
export function WeekdayPicker({ value, onChange, mondayFirst = false, disabled = [] }: { value: readonly number[]; onChange: (days: number[]) => void; mondayFirst?: boolean; disabled?: readonly number[] }) {
  return (
    <div className="flex gap-1">
      {(mondayFirst ? MONDAY_FIRST : [0, 1, 2, 3, 4, 5, 6]).map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_NAME[day]}
            disabled={disabled.includes(day)}
            onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day])}
            className={cx('grid size-9 place-items-center rounded-control border text-body transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:text-ink-faint', on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:border-ink-muted')}
          >
            {INITIAL[day]}
          </button>
        );
      })}
    </div>
  );
}
