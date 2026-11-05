import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, CONTRAST_PAIRS, KNOWN_EXCEPTIONS } from './contrast';

// Read the real stylesheet, so these tests check the colors the app actually ships.
const css = fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Tokens = Record<string, string>;

/** Collects --name: value declarations per mode, following the same cascade the browser applies. */
function parseModes(source: string): { light: Tokens; dark: Tokens } {
  const lightOnly: Tokens = {};
  const darkOnly: Tokens = {};
  const shared: Tokens = {};
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const isLight = /:root|\.light/.test(selectors!);
    const isDark = /\.dark/.test(selectors!);
    const target = isLight && isDark ? shared : isDark ? darkOnly : lightOnly;
    for (const [, name, value] of body!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) target[name!] = value!.trim();
  }
  const resolve = (tokens: Tokens): Tokens => {
    const out: Tokens = {};
    const get = (name: string, depth = 0): string => {
      const v = tokens[name];
      const alias = v?.match(/^var\(--([\w-]+)\)$/);
      return alias && depth < 5 ? get(alias[1]!, depth + 1) : (v ?? '');
    };
    for (const name of Object.keys(tokens)) out[name] = get(name);
    return out;
  };
  return {
    light: resolve({ ...lightOnly, ...shared }),
    dark: resolve({ ...lightOnly, ...darkOnly, ...shared }),
  };
}

const modes = parseModes(css);
const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

describe('design tokens', () => {
  it('defines every color token the Tailwind theme refers to', () => {
    const theme = fs.readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
    const used = [...theme.matchAll(/--(?:color|shadow)-[\w-]+:\s*var\(--([\w-]+)\)/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(20); // the pattern really found the mappings
    for (const mode of ['light', 'dark'] as const) {
      for (const name of used) expect(modes[mode][name], `${mode}: --${name}`).toBeTruthy();
    }
  });

  it('every palette color has a soft tint, in both modes', () => {
    for (const name of ['dusty-blue', 'slate', 'tomato', 'sage', 'crimson', 'plum', 'ochre', 'teal', 'terracotta']) {
      expect(modes.light[`cal-${name}`]).toMatch(/^#/);
      expect(modes.light[`cal-${name}-soft`]).toContain('color-mix');
      expect(modes.dark[`cal-${name}-soft`]).toContain('color-mix');
    }
  });

  it('uses the specified palette exactly', () => {
    expect(modes.light).toMatchObject({
      paper: '#f5f1ea', surface: '#fbf8f3', hairline: '#e3dccf', rule: '#cfc6b6',
      ink: '#1c1b19', 'ink-muted': '#6e6658', 'ink-faint': '#a39b8c',
      accent: '#e04a2f', 'accent-soft': '#f7ded6', success: '#4f7a4a', warning: '#c28a1e', danger: '#b23a28',
    });
    expect(modes.dark).toMatchObject({
      paper: '#141311', surface: '#1c1b18', hairline: '#2d2b27', rule: '#3a3732',
      ink: '#ede8df', 'ink-muted': '#a39c90', 'ink-faint': '#6e685e', accent: '#ff6b4e', 'accent-soft': '#3a221c',
    });
  });
});

describe('contrast (WCAG)', () => {
  const rows = (['light', 'dark'] as const).flatMap((mode) =>
    CONTRAST_PAIRS.flatMap((pair) => {
      const fg = modes[mode][pair.fg];
      const bg = modes[mode][pair.bg];
      if (!isHex(fg) || !isHex(bg)) return [];
      return [{ key: `${mode} ${pair.fg} / ${pair.bg}`, ratio: contrastRatio(fg, bg), min: pair.min }];
    }),
  );

  it('checks every pair in both modes (none silently skipped)', () => {
    expect(rows).toHaveLength(CONTRAST_PAIRS.length * 2);
  });

  it('every text pair has at least 4.5:1 and every meaningful mark at least 3:1, apart from the documented exceptions', () => {
    const failing = rows.filter((r) => r.ratio < r.min).map((r) => r.key).sort();
    expect(failing).toEqual(Object.keys(KNOWN_EXCEPTIONS).sort());
  });

  it('the muted text colors that were specially checked really do pass', () => {
    const ratio = (mode: 'light' | 'dark', fg: string, bg: string) => contrastRatio(modes[mode][fg]!, modes[mode][bg]!);
    expect(ratio('light', 'ink-muted', 'paper')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('dark', 'ink-muted', 'paper')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('light', 'accent-ink', 'paper')).toBeGreaterThanOrEqual(4.5);
  });

  it('knows the specified accent is too faint for text (why accent-ink exists)', () => {
    expect(contrastRatio(modes.light.accent!, modes.light.paper!)).toBeLessThan(4.5);
    expect(contrastRatio(modes.light['ink-faint']!, modes.light.paper!)).toBeLessThan(3);
  });
});
