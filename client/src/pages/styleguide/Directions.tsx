import type { CSSProperties } from 'react';
import { CALENDAR_COLORS, type CalendarColor } from '@todo/shared';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatTime } from '../../lib/dates';
import { Caption, Section } from './shared';

// Static mockups for Phase 10 (a made-up day, never real data). The chosen direction becomes the real Today page.

type Kind = 'solid' | 'soft' | 'free';
interface Item { start: string; end: string; title: string; cat: string; color?: CalendarColor; kind: Kind; focus?: boolean }

const DAY: Item[] = [
  { start: '06:30', end: '07:30', title: 'Morning run', cat: 'Health', color: 'ochre', kind: 'soft' },
  { start: '07:30', end: '08:30', title: 'Breakfast, get ready', cat: 'Personal', color: 'slate', kind: 'soft' },
  { start: '08:30', end: '09:45', title: 'Deep work: side project', cat: 'Skills', color: 'indigo', kind: 'soft', focus: true },
  { start: '10:00', end: '11:15', title: 'Statistics lecture', cat: 'School', color: 'dusty-blue', kind: 'solid' },
  { start: '11:15', end: '12:00', title: 'Open', cat: 'Open time', kind: 'free' },
  { start: '12:00', end: '13:00', title: 'Lunch', cat: 'Personal', color: 'slate', kind: 'soft' },
  { start: '13:00', end: '15:00', title: 'Office hours', cat: 'Work', color: 'teal', kind: 'solid' },
  { start: '15:00', end: '16:00', title: 'Reading', cat: 'Reading', color: 'rose', kind: 'soft' },
  { start: '16:00', end: '17:30', title: 'Free', cat: 'Free', kind: 'free' },
  { start: '17:30', end: '18:30', title: 'Club meeting', cat: 'Club', color: 'sage', kind: 'solid' },
  { start: '19:00', end: '21:00', title: 'Homework', cat: 'School', color: 'dusty-blue', kind: 'soft', focus: true },
];
const NOW = '10:40';
const QUOTE = { text: 'Simplicity is prerequisite for reliability.', by: 'Edsger W. Dijkstra' };
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const range = (i: Item) => `${formatTime(i.start)} – ${formatTime(i.end)}`;
const now = DAY.find((i) => mins(i.start) <= mins(NOW) && mins(NOW) < mins(i.end))!;
const next = DAY[DAY.indexOf(now) + 1]!;
const left = mins(now.end) - mins(NOW);

/** How an item is shaded: classes/commitments solid, routine soft, free time a neutral hatch (color is never the only cue). */
function look(i: Item): { style: CSSProperties; className: string } {
  if (i.kind === 'free') return { style: { '--c': 'var(--rule)' } as CSSProperties, className: 'hatch text-ink' };
  const vars = calendarVars(i.color!);
  return i.kind === 'solid' ? { style: vars, className: 'bg-(color:--c) text-on-accent' } : { style: vars, className: 'border-l-[3px] border-l-(color:--c) bg-(color:--c-soft) text-ink' };
}

/** The shape of the day as one thin bar, 6 AM to 10 PM, with a mark at "now". */
function DayBar({ className }: { className?: string }) {
  const span = 16 * 60;
  const pos = (t: string) => `${((mins(t) - 360) / span) * 100}%`;
  return (
    <div role="img" aria-label="The shape of the day" className={cx('relative h-2 w-full overflow-hidden rounded-full bg-hairline', className)}>
      {DAY.map((i) => (
        <span
          key={i.start}
          style={{ ...(i.color ? calendarVars(i.color) : { '--c': 'var(--rule)' }), left: pos(i.start), width: `calc(${pos(i.end)} - ${pos(i.start)})` } as CSSProperties}
          className={cx('absolute inset-y-0', i.kind === 'free' ? 'hatch border-0' : 'bg-(color:--c)')}
        />
      ))}
      <span className="absolute inset-y-[-2px] w-0.5 bg-ink" style={{ left: pos(NOW) }} />
    </div>
  );
}

/** A time-scaled agenda: every block is shaded for its full length. */
function Agenda({ from = '06:00', to = '22:00', hour = 40, compact = false }: { from?: string; to?: string; hour?: number; compact?: boolean }) {
  const top = (t: string) => ((mins(t) - mins(from)) / 60) * hour;
  const hours = Array.from({ length: (mins(to) - mins(from)) / 60 + 1 }, (_, k) => mins(from) / 60 + k);
  return (
    <div className="relative" style={{ height: top(to) }}>
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0 flex items-start gap-2 border-t border-hairline" style={{ top: top(`${String(h).padStart(2, '0')}:00`) }}>
          <span className="-mt-2 w-[4.25rem] pr-1 text-right font-mono text-time whitespace-nowrap text-ink-muted">{formatTime(`${String(h % 24).padStart(2, '0')}:00`)}</span>
        </div>
      ))}
      {DAY.filter((i) => mins(i.start) >= mins(from) && mins(i.end) <= mins(to)).map((i) => (
        <div key={i.start} {...look(i)} className={cx('absolute right-0 left-[4.75rem] overflow-hidden rounded-control px-2 py-1', look(i).className)} style={{ ...look(i).style, top: top(i.start) + 1, height: top(i.end) - top(i.start) - 2 }}>
          <p className="truncate text-meta leading-tight font-semibold">{i.title}</p>
          {!compact && (
            <p className="truncate text-time opacity-80">
              {i.cat} · <span className="font-mono">{range(i)}</span>
            </p>
          )}
        </div>
      ))}
      <div className="absolute right-0 left-[4.5rem] h-px bg-accent" style={{ top: top(NOW) }}>
        <span className="absolute -top-[3px] -left-1 size-[7px] rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** A small square in the item's color (or the hatch for free time), for lists. */
const Swatch = ({ i, className }: { i: Item; className: string }) => (
  <span style={i.color ? calendarVars(i.color) : ({ '--c': 'var(--rule)' } as CSSProperties)} className={cx('shrink-0 rounded-[2px]', i.color ? 'bg-(color:--c)' : 'hatch', className)} />
);

function Greeting({ big = false }: { big?: boolean }) {
  return (
    <div>
      <p className="text-label text-ink-muted uppercase">Tuesday, November 10</p>
      <h3 className={cx('font-display', big ? 'text-page' : 'text-section')}>Good morning</h3>
      <blockquote className="mt-2 max-w-[48ch] font-display text-title text-ink-muted italic">
        “{QUOTE.text}” <cite className="text-meta not-italic">· {QUOTE.by}</cite>
      </blockquote>
    </div>
  );
}

function FirstThree() {
  return (
    <ol className="space-y-1 text-meta">
      {DAY.slice(0, 3).map((i) => (
        <li key={i.start} className="flex items-center gap-2">
          <Swatch i={i} className="size-2.5" />
          <span className="w-16 font-mono text-time text-ink-muted">{formatTime(i.start)}</span>
          {i.title}
        </li>
      ))}
    </ol>
  );
}

/** A: the printed planner page. Serif greeting, the day as a bar, a bordered Now card, a full-day agenda. */
function DirectionA() {
  return (
    <div className="rounded-panel border border-hairline bg-paper p-6">
      <Greeting big />
      <DayBar className="mt-5" />
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <Agenda hour={34} />
        <div className="space-y-5">
          <div className="border border-rule p-4">
            <p className="text-label text-ink-muted uppercase">Now</p>
            <p className="font-display text-section">{now.title}</p>
            <p className="font-mono text-meta">{left} min left · until {formatTime(now.end)}</p>
            <div className="mt-2 h-1 bg-hairline">
              <div className="h-full bg-accent" style={{ width: `${(1 - left / (mins(now.end) - mins(now.start))) * 100}%` }} />
            </div>
            <p className="mt-3 text-meta text-ink-muted">Next · {next.title} at {formatTime(next.start)}</p>
          </div>
          <div>
            <p className="mb-1 text-label text-ink-muted uppercase">To-dos for School</p>
            <p className="text-meta">Problem set 4 · <span className="text-ink-muted">due Fri</span></p>
            <p className="text-meta">Read chapter 6 · <span className="text-ink-muted">due Mon</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** B: focus first. A large Now hero with a mono countdown in the block's color; the day as a ribbon; a compact list. */
function DirectionB() {
  const pct = (1 - left / (mins(now.end) - mins(now.start))) * 100;
  return (
    <div className="rounded-panel border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Greeting />
        <FirstThree />
      </div>
      <div style={calendarVars(now.color!)} className="mt-6 rounded-panel border-l-[6px] border-l-(color:--c) bg-(color:--c-soft) p-6">
        <p className="text-label uppercase">Now · {now.cat}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="font-display text-page">{now.title}</p>
          <p className="font-mono text-page tabular-nums">0:{String(left).padStart(2, '0')}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
          <div className="h-full bg-(color:--c)" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-meta">Next · {next.title} at {formatTime(next.start)} · then {DAY[DAY.indexOf(now) + 2]!.title}</p>
      </div>
      <DayBar className="mt-6 h-3" />
      <ul className="mt-4 divide-y divide-hairline">
        {DAY.slice(DAY.indexOf(now)).map((i) => (
          <li key={i.start} className="flex items-center gap-3 py-2 text-body">
            <span className="w-32 font-mono text-time text-ink-muted">{range(i)}</span>
            <Swatch i={i} className="size-3" />
            <span className="font-medium">{i.title}</span>
            <span className="text-meta text-ink-muted">{i.cat}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** C: a phone-style day column beside a stack of cards (morning, now and next, to-dos). */
function DirectionC() {
  return (
    <div className="grid gap-6 rounded-panel border border-hairline bg-paper p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="max-h-[520px] overflow-y-auto pr-2">
        <Agenda from="06:00" to="18:00" hour={44} />
      </div>
      <div className="space-y-4">
        <div className="rounded-panel bg-surface p-4">
          <Greeting />
          <div className="mt-3">
            <FirstThree />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div {...look(now)} className={cx('rounded-panel p-4', look(now).className)}>
            <p className="text-label uppercase opacity-80">Now</p>
            <p className="font-display text-title">{now.title}</p>
            <p className="font-mono text-meta">{left} min left</p>
          </div>
          <div className="rounded-panel border border-hairline p-4">
            <p className="text-label text-ink-muted uppercase">Next</p>
            <p className="font-display text-title">{next.title}</p>
            <p className="font-mono text-meta text-ink-muted">{formatTime(next.start)}</p>
          </div>
        </div>
        <DayBar />
      </div>
    </div>
  );
}

/** The category palette: every color solid and as a soft tint, plus the neutral hatch for free time. */
function Palette() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CALENDAR_COLORS.map((c) => (
        <li key={c} style={calendarVars(c)} className="flex items-center gap-2 text-meta">
          <span className="size-6 rounded-control bg-(color:--c)" />
          <span className="size-6 rounded-control border-l-[3px] border-l-(color:--c) bg-(color:--c-soft)" />
          {c}
        </li>
      ))}
      <li className="flex items-center gap-2 text-meta">
        <span className="hatch size-6 rounded-control" style={{ '--c': 'var(--rule)' } as CSSProperties} />
        free (no color)
      </li>
    </ul>
  );
}

export function Directions() {
  return (
    <Section id="directions" title="Today: three directions" intro="Phase 10 mockups with a made-up Tuesday at 10:40 AM. Switch Light / Dark at the top to compare.">
      <div className="space-y-12">
        <div>
          <h3 className="mb-2 text-label text-ink-muted uppercase">Category palette</h3>
          <Palette />
          <Caption>Solid for classes, events and commitments; the soft tint for routine blocks; a neutral hatch for free time.</Caption>
        </div>
        <div>
          <h3 className="mb-2 text-label text-ink-muted uppercase">A · Planner page</h3>
          <DirectionA />
        </div>
        <div>
          <h3 className="mb-2 text-label text-ink-muted uppercase">B · Focus first</h3>
          <DirectionB />
        </div>
        <div>
          <h3 className="mb-2 text-label text-ink-muted uppercase">C · Day column and cards</h3>
          <DirectionC />
        </div>
      </div>
    </Section>
  );
}
