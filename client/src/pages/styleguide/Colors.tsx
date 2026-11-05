import { CALENDAR_COLORS } from '@todo/shared';
import { cx } from '../../lib/cx';
import { contrastRatio, CONTRAST_PAIRS, KNOWN_EXCEPTIONS } from '../../styles/contrast';
import { Caption, isHex, Section, useModeTokens, type Mode } from './shared';

const COLOR_TOKENS: [string, string][] = [
  ['paper', 'Page background'],
  ['surface', 'Popovers, sidebar, inputs'],
  ['hairline', 'Row and column rules'],
  ['rule', 'Strong rules, input borders'],
  ['ink', 'Primary text'],
  ['ink-muted', 'Secondary text'],
  ['ink-faint', 'Disabled controls only'],
  ['accent', 'Marks: today, time line, focus ring, priority bar'],
  ['accent-ink', 'Accent text, primary button'],
  ['accent-soft', 'Hover and selected backgrounds'],
  ['success', 'Marks only'],
  ['warning', 'Marks only'],
  ['danger', 'Overdue, errors'],
];

const ALL_TOKENS = [
  ...COLOR_TOKENS.map(([n]) => n),
  'on-accent', 'toast-bg', 'toast-text', 'toast-link',
  ...CALENDAR_COLORS.map((c) => `cal-${c}`),
];

const MODE_LABEL: Record<Mode, string> = { light: 'Light: paper', dark: 'Dark: night desk' };

/** A column showing every token for one mode. The wrapper's own class makes it render in that mode regardless of the page's theme. */
function ModeColumn({ mode }: { mode: Mode }) {
  const [ref, values] = useModeTokens(ALL_TOKENS);
  return (
    <div ref={ref} className={cx(mode, 'border border-hairline bg-paper p-4 text-ink')}>
      <p className="mb-3 text-label text-ink-muted uppercase">{MODE_LABEL[mode]}</p>
      <ul className="space-y-2">
        {COLOR_TOKENS.map(([name, role]) => (
          <li key={name} className="flex items-center gap-3">
            <span aria-hidden className="size-9 shrink-0 border border-rule" style={{ background: `var(--${name})` }} />
            <span className="min-w-0 text-meta">
              <span className="font-mono text-ink">{name}</span> <span className="font-mono text-ink-muted">{values[name]}</span>
              <span className="block truncate text-ink-muted">{role}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 mb-2 text-label text-ink-muted uppercase">Calendars: solid and soft tint</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CALENDAR_COLORS.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span aria-hidden className="size-6 shrink-0" style={{ background: `var(--cal-${c})` }} />
            <span aria-hidden className="size-6 shrink-0 border border-hairline" style={{ background: `var(--cal-${c}-soft)` }} />
            <span className="min-w-0 truncate text-meta">
              <span className="text-ink">{c}</span> <span className="font-mono text-ink-muted">{values[`cal-${c}`]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 mb-2 text-label text-ink-muted uppercase">Workload heat, light to heavy</p>
      <div className="flex">
        {['paper', 'heat-1', 'heat-2', 'heat-3', 'heat-4'].map((t) => (
          <span key={t} className="h-8 flex-1 border border-hairline" style={{ background: `var(--${t})` }} />
        ))}
      </div>
    </div>
  );
}

/** The contrast table: every pair the design depends on, in both modes, computed from the live values. */
function ContrastTable() {
  const [lightRef, light] = useModeTokens(ALL_TOKENS);
  const [darkRef, dark] = useModeTokens(ALL_TOKENS);

  const cell = (mode: Mode, fg: string, bg: string, min: number) => {
    const v = mode === 'light' ? light : dark;
    if (!isHex(v[fg]) || !isHex(v[bg])) return <td className="py-2 pr-4 font-mono text-ink-muted">…</td>;
    const ratio = contrastRatio(v[fg]!, v[bg]!);
    const known = `${mode} ${fg} / ${bg}` in KNOWN_EXCEPTIONS;
    const pass = ratio >= min;
    return (
      <td className="py-2 pr-4 font-mono tabular-nums">
        <span className={pass ? 'text-ink' : known ? 'text-ink-muted' : 'text-danger'}>{ratio.toFixed(2)}</span>
        <span className="ml-2 text-ink-muted">{pass ? 'pass' : known ? 'exception' : 'FAIL'}</span>
      </td>
    );
  };

  return (
    <div className="relative overflow-x-auto">
      <div ref={lightRef} className="light hidden" />
      <div ref={darkRef} className="dark hidden" />
      <table className="w-full min-w-[620px] text-left text-meta">
        <caption className="sr-only">Contrast ratios for each color pair, in light and dark mode</caption>
        <thead>
          <tr className="border-b border-rule text-label text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-4">Pair</th>
            <th scope="col" className="py-2 pr-4">Needs</th>
            <th scope="col" className="py-2 pr-4">Light</th>
            <th scope="col" className="py-2 pr-4">Dark</th>
            <th scope="col" className="py-2">Used for</th>
          </tr>
        </thead>
        <tbody>
          {CONTRAST_PAIRS.map((p) => (
            <tr key={`${p.fg}/${p.bg}/${p.use}`} className="border-b border-hairline">
              <td className="py-2 pr-4 font-mono text-ink">{p.fg} on {p.bg}</td>
              <td className="py-2 pr-4 font-mono text-ink-muted">{p.min}:1</td>
              {cell('light', p.fg, p.bg, p.min)}
              {cell('dark', p.fg, p.bg, p.min)}
              <td className="py-2 text-ink-muted">{p.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-4 max-w-[70ch] list-disc space-y-1.5 pl-5 text-meta text-ink-muted">
        {Object.entries(KNOWN_EXCEPTIONS).map(([k, why]) => (
          <li key={k}>
            <span className="font-mono text-ink">{k}</span>: {why}
          </li>
        ))}
        <li>
          <span className="font-mono text-ink">ink-faint</span> and the hairlines aren't tested: faint ink (2.5:1) is only for disabled controls, which WCAG exempts, and
          hairlines are decorative separators.
        </li>
      </ul>
    </div>
  );
}

export function Colors() {
  return (
    <Section
      id="color"
      title="Color"
      intro="Every color is a CSS variable, defined once in tokens.css, so a component never contains a hex code. Dark mode flips the same names to the night-desk values."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ModeColumn mode="light" />
        <ModeColumn mode="dark" />
      </div>
      <div>
        <Caption>Contrast, checked live and by the test suite</Caption>
        <ContrastTable />
      </div>
    </Section>
  );
}
