// WCAG contrast math, and the list of color pairs the design relies on.

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/** Relative luminance, per WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastPair {
  /** Token names, without the leading dashes. */
  fg: string;
  bg: string;
  /** 4.5 for text; 3 for graphics and focus indicators that carry meaning. */
  min: 4.5 | 3;
  use: string;
}

const text = (fg: string, bg: string, use: string): ContrastPair => ({ fg, bg, min: 4.5, use });
const mark = (fg: string, bg: string, use: string): ContrastPair => ({ fg, bg, min: 3, use });

export const CONTRAST_PAIRS: ContrastPair[] = [
  text('ink', 'paper', 'Body text on the page'),
  text('ink', 'surface', 'Text in popovers and the sidebar'),
  text('ink-muted', 'paper', 'Metadata, captions, placeholders'),
  text('ink-muted', 'surface', 'Metadata in popovers and the sidebar'),
  text('accent-ink', 'paper', 'Accent text: today in lists, links'),
  text('accent-ink', 'surface', 'Accent text in popovers'),
  text('accent-ink', 'accent-soft', 'Accent text on a hovered or selected row'),
  text('ink', 'accent-soft', 'Text on a hovered or selected row'),
  text('danger', 'paper', 'Overdue dates, errors'),
  text('danger', 'surface', 'Errors in popovers'),
  text('on-accent', 'accent-ink', 'Primary button label'),
  text('toast-text', 'toast-bg', 'Toast message'),
  text('toast-link', 'toast-bg', 'Toast Undo link'),
  mark('ink', 'paper', 'Checkbox border'),
  mark('accent', 'paper', 'Focus ring, today circle, current-time line'),
  mark('accent', 'surface', 'Focus ring on a popover'),
  mark('success', 'paper', 'Success marks'),
  mark('cal-dusty-blue', 'paper', 'School calendar'),
  mark('cal-slate', 'paper', 'Work calendar'),
  mark('cal-tomato', 'paper', 'Applications calendar'),
  mark('cal-sage', 'paper', 'ACM calendar'),
  mark('cal-crimson', 'paper', 'Kappa Alpha Psi calendar'),
  mark('cal-plum', 'paper', 'Personal calendar'),
  mark('cal-ochre', 'paper', 'Ochre calendar'),
  mark('cal-teal', 'paper', 'Teal calendar'),
  mark('cal-terracotta', 'paper', 'Terracotta calendar'),
  mark('cal-indigo', 'paper', 'Indigo calendar'),
  mark('cal-rose', 'paper', 'Rose calendar'),
  mark('cal-umber', 'paper', 'Umber calendar'),
  mark('cal-olive', 'paper', 'Olive calendar'),
  mark('warning', 'paper', 'Medium-priority bar'),
];

/** Pairs that are knowingly below their minimum, with the reason. */
export const KNOWN_EXCEPTIONS: Record<string, string> = {
  'light cal-sage / paper': 'Sage is 2.8:1. A supplementary mark next to the calendar name; blocks also carry a title.',
  'light cal-ochre / paper': 'Ochre is 2.7:1. A supplementary mark next to the calendar name; blocks also carry a title.',
  'light warning / paper': 'Ochre is 2.7:1. The medium-priority bar is also half the height of the high-priority bar, so shape carries the meaning too.',
};

// Not checked on purpose: faint ink (disabled controls only, which WCAG exempts) and hairline/rule (decorative separators).
