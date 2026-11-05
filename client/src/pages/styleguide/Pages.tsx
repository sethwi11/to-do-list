import { useEffect, useState } from 'react';
import { Briefcase, Calendar as CalendarIcon, CalendarCheck, GraduationCap, ListTodo, Mic, NotebookPen, Timer } from 'lucide-react';
import { isoWeekNumber } from '@todo/shared';
import { formatCountdown, todayLocalISO } from '../../lib/dates';
import { IconButton } from '../../ui/Button';
import { QuickAddInput } from '../../ui/fields';
import { KanbanCard, KanbanColumn, ProgressBar } from '../../ui/kanban';
import { Segmented } from '../../ui/Segmented';
import { Caption, Section, Stage } from './shared';

/** A countdown to a moment 2h 15m from when the page opened, ticking every 20 seconds. */
function useDemoCountdown() {
  const [target] = useState(() => Date.now() + (2 * 60 + 15) * 60_000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return formatCountdown(target - now);
}

function TodayHeader() {
  const today = new Date();
  const week = isoWeekNumber(todayLocalISO(today));
  const countdown = useDemoCountdown();
  const [view, setView] = useState<'M' | 'W' | 'D' | 'A'>('W');
  return (
    <div>
      <Caption>Page header and the Today page</Caption>
      <Stage className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-page">{today.toLocaleDateString(undefined, { weekday: 'long' })}</h1>
            <p className="flex items-baseline gap-3">
              <span className="font-display text-section text-ink-muted">{today.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
              <span className="font-mono text-meta text-ink-muted">WK {week}</span>
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <QuickAddInput aria-label="Quick add" className="min-w-0 flex-1 sm:w-64 sm:flex-none" />
            <IconButton icon={Mic} label="Hold to talk" />
            <Segmented
              label="Calendar view"
              value={view}
              onChange={setView}
              className="hidden sm:inline-flex"
              options={[
                { value: 'M', label: 'M', title: 'Month' },
                { value: 'W', label: 'W', title: 'Week' },
                { value: 'D', label: 'D', title: 'Day' },
                { value: 'A', label: 'A', title: 'Agenda' },
              ]}
            />
          </div>
        </div>

        <p className="text-meta text-ink-muted">
          <span className="font-mono text-ink">3</span> events · <span className="font-mono text-ink">5</span> tasks · <span className="font-mono text-danger">2</span> overdue
        </p>

        {/* The one place a bordered box is allowed. */}
        <section aria-label="Up next" className="max-w-xl border border-rule p-5">
          <p className="text-label text-ink-muted uppercase">Up next</p>
          <h2 className="mt-2 font-display text-section">Interview with Acme, final round</h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-meta text-ink-muted">
            <span>
              in <span className="font-mono text-title text-accent-ink tabular-nums">{countdown}</span>
            </span>
            <span>Room 214, Carnegie Hall</span>
          </p>
          <a href="https://zoom.us/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-meta text-accent-ink underline underline-offset-2">
            zoom.us/j/123456789
          </a>
        </section>
      </Stage>
    </div>
  );
}

function Timer96() {
  return (
    <div>
      <Caption>Focus timer</Caption>
      <Stage className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-timer tabular-nums max-sm:text-[64px]">24:12</p>
          <p className="mt-2 font-display text-section italic text-ink-muted">Finish the COMP 365 lab write-up</p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 font-mono text-meta text-paper tabular-nums">
          <Timer className="size-4" aria-hidden /> 24:12
        </p>
      </Stage>
      <p className="mt-2 text-meta text-ink-muted">The full timer page, and the small ink pill that follows you to every page.</p>
    </div>
  );
}

function Applications() {
  return (
    <div>
      <Caption>Applications board and goal</Caption>
      <Stage className="space-y-6">
        <div className="relative flex gap-0 overflow-x-auto">
          <KanbanColumn title="Wishlist" count={1}>
            <KanbanCard company="Globex" role="Data Intern" color="tomato" calendarName="Applications" />
          </KanbanColumn>
          <KanbanColumn title="Applied" count={2}>
            <KanbanCard company="Acme" role="Software Engineering Intern" dateApplied="Oct 28" color="tomato" calendarName="Applications" />
            <KanbanCard company="Initech" role="Product Intern" dateApplied="Nov 1" color="tomato" calendarName="Applications" />
          </KanbanColumn>
          <KanbanColumn title="Interviewing" count={1}>
            <KanbanCard company="Hooli" role="Backend Intern" dateApplied="Oct 14" color="tomato" calendarName="Applications" />
          </KanbanColumn>
        </div>
        <div className="max-w-md">
          <ProgressBar value={3} max={10} label="offers" />
        </div>
      </Stage>
    </div>
  );
}

function Navigation() {
  const items = [
    [CalendarCheck, 'Today'],
    [CalendarIcon, 'Calendar'],
    [ListTodo, 'Tasks'],
    [Briefcase, 'Applications'],
    [GraduationCap, 'Courses'],
    [NotebookPen, 'Weekly Review'],
    [Timer, 'Focus stats'],
  ] as const;
  return (
    <div>
      <Caption>Icons: lucide, 1.5px stroke, 16px in rows and 18px in navigation</Caption>
      <Stage>
        <ul className="flex flex-wrap gap-x-8 gap-y-4">
          {items.map(([Icon, name]) => (
            <li key={name} className="flex items-center gap-2 text-body">
              <Icon className="size-[18px]" aria-hidden /> {name}
            </li>
          ))}
        </ul>
      </Stage>
    </div>
  );
}

export function Pages() {
  return (
    <Section id="pages" title="Pages" intro="How the pieces come together on the main screens.">
      <TodayHeader />
      <Timer96 />
      <Applications />
      <Navigation />
    </Section>
  );
}
