import { z } from 'zod';

/*
 * Calendar colors are stored as palette *names*, never hex codes. The client
 * maps each name to CSS variables, so one name can render correctly in both
 * light and dark mode (a fixed hex can't), and a future re-tint changes one
 * stylesheet instead of the database.
 */
export const CALENDAR_COLORS = [
  'dusty-blue',
  'slate',
  'tomato',
  'sage',
  'crimson',
  'plum',
  'ochre',
  'teal',
  'terracotta',
] as const;
export const CalendarColorSchema = z.enum(CALENDAR_COLORS);
export type CalendarColor = z.infer<typeof CalendarColorSchema>;

/** The calendars a fresh install starts with (name, color), in sidebar order. */
export const DEFAULT_CALENDARS: readonly { name: string; color: CalendarColor }[] = [
  { name: 'School', color: 'dusty-blue' },
  { name: 'Work', color: 'slate' },
  { name: 'Applications', color: 'tomato' },
  { name: 'ACM', color: 'sage' },
  { name: 'Kappa Alpha Psi', color: 'crimson' },
  { name: 'Personal', color: 'plum' },
];

/** The first version of the app used Tailwind color names; this maps them onto the palette. */
const LEGACY_COLORS: Record<string, CalendarColor> = {
  slate: 'slate',
  red: 'tomato',
  orange: 'terracotta',
  amber: 'ochre',
  green: 'sage',
  teal: 'teal',
  blue: 'dusty-blue',
  indigo: 'dusty-blue',
  purple: 'plum',
  pink: 'crimson',
};

/** Any stored color string -> a valid palette name (old names are translated, unknown ones become slate). */
export function toPaletteColor(color: string): CalendarColor {
  if ((CALENDAR_COLORS as readonly string[]).includes(color)) return color as CalendarColor;
  return LEGACY_COLORS[color] ?? 'slate';
}
