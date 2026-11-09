import { useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Maximize, Minimize } from 'lucide-react';
import { datePart, minutesBetween, timePart } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { Agenda, categoryOf, Legend } from '../features/today/Agenda';
import { TaskLines } from '../features/today/NowCard';
import { FocusPanel } from '../features/focus/FocusPanel';
import { agendaRange, minutesInto } from '../features/today/todayModel';
import { useNowText, useTodayPlan } from '../features/today/useTodayPlan';
import { useFullscreen, useFullscreenShortcut } from '../hooks/useFullscreen';
import { calendarVars } from '../lib/calendarColors';
import { formatCountdown, formatDueDate, formatTime, fullDate } from '../lib/dates';
import { tasksUrl } from '../lib/taskParams';
import { Button } from '../ui/Button';

/** The display view, made for a full screen across the room: the clock, a big Now card with its countdown, the block's to-dos and today's agenda. */
export default function DisplayPage() {
  const { calendarsById, today } = useApp();
  const navigate = useNavigate();
  const now = useNowText();
  const { routine, date, plan, current, next, during, supposed } = useTodayPlan(now);
  const fullscreen = useFullscreen();
  useFullscreenShortcut();
  const agenda = useRef<HTMLDivElement>(null);

  // Start the agenda a little before now; only when the day changes, so it never fights your scrolling.
  const nowAt = minutesInto(plan.date, now) - agendaRange(plan).from;
  const startAt = useRef(nowAt);
  startAt.current = nowAt;
  useEffect(() => {
    if (agenda.current) agenda.current.scrollTop = Math.max(0, startAt.current - 90);
  }, [plan.date]);

  const free = !current || current.kind === 'open' || current.priority === 'free';
  const vars = (current && !free && current.color ? calendarVars(current.color) : { '--c': 'var(--rule)' }) as CSSProperties;
  const left = current ? minutesBetween(now, current.end) : 0;
  const done = current ? 1 - left / Math.max(1, minutesBetween(current.start, current.end)) : 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper px-6 py-6 text-ink md:px-10 md:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[clamp(3rem,7vw,6.5rem)] leading-none tabular-nums">{formatTime(timePart(now))}</p>
          <p className="mt-2 font-display text-section text-ink-muted">{fullDate(date)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/')}>
            Back to the app
          </Button>
          {fullscreen.supported && (
            <Button variant="secondary" icon={fullscreen.on ? Minimize : Maximize} onClick={fullscreen.toggle}>
              {fullscreen.on ? 'Exit full screen' : 'Full screen'}
            </Button>
          )}
        </div>
      </header>

      <div className="mt-8 grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-8 overflow-y-auto">
          <section aria-label="Now" style={vars} className="rounded-panel border border-rule border-l-8 border-l-(color:--c) bg-surface px-8 py-7">
            {routine.loading ? (
              <p className="font-display text-[clamp(2rem,4vw,3.5rem)] text-ink-muted italic">Loading…</p>
            ) : current ? (
              <>
                <h2 className="text-label text-ink-muted uppercase">{current.kind === 'open' ? 'Now' : `Now · ${categoryOf(current, calendarsById)}`}</h2>
                <p className="mt-2 font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-tight break-words">{current.kind === 'open' ? 'Open time' : current.title}</p>
                <p className="mt-3 font-mono text-[clamp(1.5rem,3vw,2.5rem)] tabular-nums">
                  {formatCountdown(left * 60_000)} left <span className="text-ink-muted">· until {formatTime(timePart(current.end))}</span>
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-label="How much of it has passed" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-(color:--c)" style={{ width: `${done * 100}%` }} />
                </div>
              </>
            ) : (
              <p className="font-display text-[clamp(2rem,4vw,3.5rem)] text-ink-muted">Nothing on right now</p>
            )}
            {next && (
              <p className="mt-5 text-title text-ink-muted">
                Next · <span className="text-ink">{next.title}</span> {datePart(next.start) === datePart(now) ? `at ${formatTime(timePart(next.start))}` : `${formatDueDate(datePart(next.start), today)}, ${formatTime(timePart(next.start))}`}
              </p>
            )}
          </section>

          {current?.kind === 'routine' && <FocusPanel item={current} big />}

          <div className="grid gap-8 md:grid-cols-2">
            {current?.kind === 'routine' && <TaskLines big title="During this block" tasks={during} moreHref={current.calendarId ? tasksUrl({ calendarId: current.calendarId }) : undefined} />}
            {supposed.length > 0 && <TaskLines big title="Supposed to be doing now" tasks={supposed} />}
          </div>
        </div>

        <section aria-label="Agenda" className="flex min-h-0 flex-col">
          <Legend items={plan.items} />
          <div ref={agenda} className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
            <Agenda plan={plan} now={now} onOpen={(item) => navigate(item.kind === 'routine' ? `/week?block=${item.sourceId}` : '/')} />
          </div>
        </section>
      </div>
    </div>
  );
}
