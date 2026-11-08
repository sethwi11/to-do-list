import type { CSSProperties } from 'react';
import type { CalendarColor, PlanKind, RoutinePriority } from '@todo/shared';

/** The share of the category color in a solid fill: reads as solid, still light enough for ink text (checked in tokens.test.ts). */
export const STRONG_MIX = 45;

/** Sets the calendar's color variables on an element: --c (solid), --c-soft (tint) and --c-strong (the solid fill behind text). */
export function calendarVars(color: CalendarColor): CSSProperties {
  return { '--c': `var(--cal-${color})`, '--c-soft': `var(--cal-${color}-soft)`, '--c-strong': `color-mix(in srgb, var(--cal-${color}) ${STRONG_MIX}%, var(--paper))` } as CSSProperties;
}

export type Shade = 'solid' | 'soft' | 'free';

/** Classes, events and commitments are solid; other routine blocks the soft tint; free and open time a neutral hatch, so color is never the only cue. */
export function shadeFor(item: { kind: PlanKind; priority: RoutinePriority | null }): Shade {
  if (item.kind === 'open' || item.priority === 'free') return 'free';
  return item.kind === 'routine' && item.priority !== 'commitment' ? 'soft' : 'solid';
}

/** Style and classes that shade a block for its whole length. */
export function shadeProps(color: CalendarColor | null, shade: Shade): { style: CSSProperties; className: string } {
  if (shade === 'free' || !color) return { style: { '--c': 'var(--rule)' } as CSSProperties, className: 'hatch' };
  return { style: calendarVars(color), className: shade === 'solid' ? 'border-l-4 border-l-(color:--c) bg-(color:--c-strong)' : 'border-l-[3px] border-l-(color:--c) bg-(color:--c-soft)' };
}
