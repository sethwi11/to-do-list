import type { CalendarColor } from '@todo/shared';

/*
 * Maps palette names to *complete* Tailwind class strings. Tailwind finds
 * classes by scanning source text, so dynamically built names like
 * `bg-${color}` would never make it into the CSS. Each class has to appear
 * literally in the source.
 *
 * The colors themselves are CSS variables (--cal-*, defined in index.css),
 * never hex values in components, so one stylesheet change retints the app
 * and dark mode can adjust a color without touching any component.
 */
export const calendarDotClass: Record<CalendarColor, string> = {
  'dusty-blue': 'bg-[var(--cal-dusty-blue)]',
  slate: 'bg-[var(--cal-slate)]',
  tomato: 'bg-[var(--cal-tomato)]',
  sage: 'bg-[var(--cal-sage)]',
  crimson: 'bg-[var(--cal-crimson)]',
  plum: 'bg-[var(--cal-plum)]',
  ochre: 'bg-[var(--cal-ochre)]',
  teal: 'bg-[var(--cal-teal)]',
  terracotta: 'bg-[var(--cal-terracotta)]',
};

/**
 * Sets two CSS variables on an element: --c (the calendar's solid color) and --c-soft (its
 * soft tint). Blocks then style themselves with border-l-(--c) and bg-(--c-soft), so one
 * component handles every calendar color with no per-color class names.
 */
export function calendarVars(color: CalendarColor): React.CSSProperties {
  return { '--c': `var(--cal-${color})`, '--c-soft': `var(--cal-${color}-soft)` } as React.CSSProperties;
}
