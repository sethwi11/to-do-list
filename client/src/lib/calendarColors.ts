import type { CalendarColor } from '@todo/shared';

/** Sets two CSS variables on an element: --c (the calendar's solid color) and --c-soft (its soft tint). */
export function calendarVars(color: CalendarColor): React.CSSProperties {
  return { '--c': `var(--cal-${color})`, '--c-soft': `var(--cal-${color}-soft)` } as React.CSSProperties;
}
