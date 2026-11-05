import type { CalendarColor } from '@todo/shared';

/**
 * Sets two CSS variables on an element: --c (the calendar's solid color) and --c-soft (its
 * soft tint). Blocks then style themselves with border-l-(color:--c) and bg-(color:--c-soft),
 * so one component handles every calendar color with no per-color class names, and no hex
 * values ever appear in a component. The variables themselves (--cal-*) live in tokens.css.
 */
export function calendarVars(color: CalendarColor): React.CSSProperties {
  return { '--c': `var(--cal-${color})`, '--c-soft': `var(--cal-${color}-soft)` } as React.CSSProperties;
}
