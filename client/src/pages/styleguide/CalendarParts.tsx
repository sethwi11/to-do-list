import { useState } from 'react';
import { cx } from '../../lib/cx';
import { Checkbox } from '../../ui/Checkbox';
import { EventBlock, TimeBlockBlock, TodoBlock } from '../../ui/blocks';
import { Caption, Section, Stage } from './shared';

/** The three calendar objects side by side, then a week sample, a month sample with heat, and the agenda. */
function BlockTrio() {
  const [todo, setTodo] = useState(false);
  const [tb, setTb] = useState(false);
  return (
    <div>
      <Caption>Event, to-do, time block</Caption>
      <Stage className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-meta text-ink-muted">Event: a highlighter stripe</p>
          <EventBlock title="Interview with Acme" time="2:00–3:00 PM" color="tomato" calendarName="Applications" />
          <EventBlock title="COMP 365" time="10:00–11:15 AM" color="dusty-blue" calendarName="School" className="mt-2" />
        </div>
        <div>
          <p className="mb-2 text-meta text-ink-muted">To-do: dashed, no fill, checkable</p>
          <TodoBlock title="Submit scholarship form" color="plum" calendarName="Personal" done={todo} onToggle={() => setTodo((x) => !x)} />
          <TodoBlock title="Read chapter 4" color="dusty-blue" calendarName="School" done onToggle={() => {}} className="mt-2" />
        </div>
        <div>
          <p className="mb-2 text-meta text-ink-muted">Time block: hatched, tied to a task</p>
          <TimeBlockBlock title="Lab write-up" time="9:00–10:30 AM" color="dusty-blue" calendarName="School" done={tb} onToggle={() => setTb((x) => !x)} className="min-h-14" />
        </div>
      </Stage>
    </div>
  );
}

const HOUR = 56; // px per hour in the sample
const FIRST_HOUR = 8;
const hours = [8, 9, 10, 11, 12, 13];
const label = (h: number) => `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
const y = (h: number, m = 0) => (h - FIRST_HOUR + m / 60) * HOUR;

function DayColumn({ today, date, weekday, children }: { today?: boolean; date: number; weekday: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l border-hairline">
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="text-label text-ink-muted uppercase">{weekday}</span>
        {today ? (
          <span className="grid size-8 place-items-center rounded-full bg-accent-fill font-display text-section text-on-accent-fill">{date}</span>
        ) : (
          <span className="grid size-8 place-items-center font-display text-section">{date}</span>
        )}
      </div>
      <div className="relative" style={{ height: hours.length * HOUR }}>
        {hours.flatMap((h) => [
          <div key={h} aria-hidden className="absolute inset-x-0 border-t border-hairline" style={{ top: y(h) }} />,
          <div key={`${h}.5`} aria-hidden className="absolute inset-x-0 border-t border-dotted border-hairline" style={{ top: y(h, 30) }} />,
        ])}
        {children}
      </div>
    </div>
  );
}

function WeekSample() {
  const [tb, setTb] = useState(false);
  return (
    <div>
      <Caption>Day and week view</Caption>
      <Stage className="relative overflow-x-auto p-0 sm:p-0">
        <div className="grid min-w-[480px] grid-cols-[52px_1fr_1fr]">
          <div>
            <div className="h-[52px]" />
            <div className="relative" style={{ height: hours.length * HOUR }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-time text-ink-muted" style={{ top: y(h) + (h === FIRST_HOUR ? 8 : 0) }}>
                  {label(h)}
                </span>
              ))}
            </div>
          </div>
          <DayColumn today date={4} weekday="Wed">
            <div className="absolute inset-x-1" style={{ top: y(9, 0), height: y(10, 15) - y(9, 0) }}>
              <EventBlock title="COMP 365" time="9:00–10:15 AM" color="dusty-blue" calendarName="School" className="h-full" />
            </div>
            <div className="absolute inset-x-1" style={{ top: y(10, 30), height: y(12, 0) - y(10, 30) }}>
              <TimeBlockBlock title="Lab write-up" time="10:30 AM–12:00 PM" color="dusty-blue" calendarName="School" done={tb} onToggle={() => setTb((x) => !x)} className="h-full" />
            </div>
            <div className="absolute inset-x-1" style={{ top: y(12, 30), height: 28 }}>
              <TodoBlock title="Email the recruiter" color="tomato" calendarName="Applications" done={false} onToggle={() => {}} className="h-full" />
            </div>
            {/* The current-time line: 1.5px honey, with a dot on the left edge. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-[1.5px] bg-accent" style={{ top: y(12, 15) }}>
              <span className="absolute -top-[3.5px] -left-1 size-2 rounded-full bg-accent" />
            </div>
          </DayColumn>
          <DayColumn date={5} weekday="Thu">
            <div className="absolute inset-x-1" style={{ top: y(11, 0), height: y(12, 0) - y(11, 0) }}>
              <EventBlock title="ACM meeting" time="11:00 AM–12:00 PM" color="sage" calendarName="ACM" className="h-full" />
            </div>
            <div className="absolute inset-x-1" style={{ top: y(13, 0) - 6, height: 30 }}>
              <EventBlock title="Office hours" color="crimson" calendarName="Kappa Alpha Psi" className="h-full" />
            </div>
          </DayColumn>
        </div>
      </Stage>
    </div>
  );
}

const HEAT_LEVELS: Record<number, string> = { 0: '', 1: 'bg-heat-1', 2: 'bg-heat-2', 3: 'bg-heat-3', 4: 'bg-heat-4' };
// 28 days, Sun Oct 25 to Sat Nov 21 (the page's sample month).
const MONTH = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(2026, 9, 25 + i);
  return { day: d.getDate(), other: d.getMonth() !== 10, weekend: d.getDay() === 0 || d.getDay() === 6, today: d.getMonth() === 10 && d.getDate() === 4 };
});
const LOAD = [0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 3, 1, 2, 0, 0, 2, 3, 4, 2, 1, 0, 0, 1, 0, 0, 0, 0, 0];

function MonthSample() {
  const [heat, setHeat] = useState(true);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Caption>Month view and workload heat</Caption>
        <label className="-mt-3 flex items-center gap-1 text-body">
          <Checkbox checked={heat} onChange={(e) => setHeat(e.target.checked)} label="Show workload heat" /> Workload heat
        </label>
      </div>
      <Stage className="p-0 sm:p-0">
        <div className="grid grid-cols-7 border-b border-hairline text-label text-ink-muted uppercase">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <span key={d} className="px-2 py-2">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {MONTH.map((c, i) => {
            const load = LOAD[i] ?? 0;
            return (
              <div
                key={i}
                title={heat && load ? `${load} events, ${load * 1.5}h scheduled, ${load} tasks due` : undefined}
                className={cx('min-h-16 border-r border-b border-hairline p-1.5 [&:nth-child(7n)]:border-r-0 sm:min-h-20', c.weekend && !heat && 'bg-weekend', heat && HEAT_LEVELS[load], heat && c.weekend && !load && 'bg-weekend')}
              >
                {c.today ? (
                  <span className="grid size-6 place-items-center rounded-full bg-accent-fill font-mono text-meta text-on-accent-fill">{c.day}</span>
                ) : (
                  <span className={cx('grid size-6 place-items-center font-mono text-meta', c.other ? 'text-ink-muted' : 'text-ink')}>{c.day}</span>
                )}
                {i === 10 && <EventBlock title="Interview" color="tomato" calendarName="Applications" className="mt-1 hidden py-0 sm:block" />}
                {i === 17 && <EventBlock title="Midterm" color="dusty-blue" calendarName="School" className="mt-1 hidden py-0 sm:block" />}
              </div>
            );
          })}
        </div>
      </Stage>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-muted" aria-label="Heat legend">
        <span>Workload:</span>
        {[
          ['bg-paper', 'Light'],
          ['bg-heat-2', 'Moderate'],
          ['bg-heat-3', 'Busy'],
          ['bg-heat-4', 'Heavy'],
        ].map(([cls, name]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cx('size-4 border border-rule', cls)} /> {name}
          </span>
        ))}
        <span>Weekends have a faint tint; days from other months use muted ink.</span>
      </div>
    </div>
  );
}

function AgendaSample() {
  const day = (weekday: string, date: number, today: boolean, items: { time: string; title: string; kind: 'event' | 'todo'; color: string; cal: string }[]) => (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-rule py-4 sm:grid-cols-[96px_minmax(0,1fr)]">
      <div>
        <p className="text-label text-ink-muted uppercase">{weekday}</p>
        <p className={cx('font-display text-page leading-none', today && 'text-accent-ink')}>{date}</p>
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.title} className="flex min-h-11 items-center gap-3 border-b border-hairline last:border-b-0">
            <span className="w-16 shrink-0 font-mono text-meta tabular-nums text-ink-muted">{it.time}</span>
            <span aria-hidden className={cx('size-2 shrink-0', it.kind === 'todo' && 'border border-dashed bg-transparent')} style={it.kind === 'todo' ? { borderColor: it.color } : { background: it.color }} />
            <span className="min-w-0 truncate text-body">{it.title}</span>
            <span className="sr-only">{it.kind === 'todo' ? 'To-do' : 'Event'}, calendar {it.cal}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div>
      <Caption>Agenda: a printed planner page</Caption>
      <Stage className="py-0 sm:py-0">
        {day('Wed', 4, true, [
          { time: '9:00 AM', title: 'COMP 365', kind: 'event', color: 'var(--cal-dusty-blue)', cal: 'School' },
          { time: '12:30 PM', title: 'Email the recruiter', kind: 'todo', color: 'var(--cal-tomato)', cal: 'Applications' },
          { time: '6:00 PM', title: 'ACM meeting', kind: 'event', color: 'var(--cal-sage)', cal: 'ACM' },
        ])}
        {day('Thu', 5, false, [{ time: 'All day', title: 'Scholarship application due', kind: 'todo', color: 'var(--cal-plum)', cal: 'Personal' }])}
      </Stage>
    </div>
  );
}

export function CalendarParts() {
  return (
    <Section id="calendar" title="Calendar" intro="The three kinds of thing you see on a calendar are recognizable at a glance without reading: a filled stripe, a dashed outline, a hatched fill. Calendar identity is color plus an accessible name.">
      <BlockTrio />
      <WeekSample />
      <MonthSample />
      <AgendaSample />
    </Section>
  );
}
