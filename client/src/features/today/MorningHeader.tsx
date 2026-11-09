import type { CSSProperties } from 'react';
import { timePart, type DayPlan, type Quote, type Streak } from '@todo/shared';
import { StreakChips } from './Streaks';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatTime } from '../../lib/dates';
import { agendaRange, minutesInto } from './todayModel';

/** The shape of the day as one thin bar, with a mark at now. */
export function DayBar({ plan, now, className }: { plan: DayPlan; now: string; className?: string }) {
  const { from, to } = agendaRange(plan);
  const pos = (dt: string) => `${((Math.min(to, Math.max(from, minutesInto(plan.date, dt))) - from) / (to - from)) * 100}%`;
  const nowAt = minutesInto(plan.date, now);
  return (
    <div role="img" aria-label={`The shape of the day: ${plan.items.filter((i) => i.kind !== 'open').length} things planned`} className={cx('relative h-2 w-full overflow-hidden rounded-full bg-hairline', className)}>
      {plan.items.map((i) => (
        <span
          key={i.key}
          style={{ ...(i.color && i.priority !== 'free' ? calendarVars(i.color) : { '--c': 'var(--rule)' }), left: pos(i.start), width: `calc(${pos(i.end)} - ${pos(i.start)})` } as CSSProperties}
          className={cx('absolute inset-y-0', i.color && i.priority !== 'free' ? 'bg-(color:--c)' : 'hatch')}
        />
      ))}
      {nowAt >= from && nowAt <= to && <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pos(now) }} />}
    </div>
  );
}

/** The morning view: today's quote, the shape of the day and the first three things in it. */
export function MorningHeader({ plan, now, quote, streaks = [] }: { plan: DayPlan; now: string; quote: Quote | undefined; streaks?: readonly Streak[] }) {
  const first = plan.items.filter((i) => i.kind !== 'open').slice(0, 3);
  return (
    <div className="mt-5 space-y-5">
      {quote && (
        <blockquote className="max-w-[52ch] font-display text-title text-ink-muted italic">
          “{quote.text}” <cite className="text-meta not-italic">· {quote.by}</cite>
        </blockquote>
      )}
      <StreakChips streaks={streaks} />
      <DayBar plan={plan} now={now} />
      {first.length > 0 && (
        <ol aria-label="First up" className="flex flex-wrap gap-x-6 gap-y-1 text-meta">
          {first.map((i) => (
            <li key={i.key} className="flex items-center gap-2">
              <span style={i.color && i.priority !== 'free' ? calendarVars(i.color) : ({ '--c': 'var(--rule)' } as CSSProperties)} className={cx('size-2.5 rounded-[2px]', i.color && i.priority !== 'free' ? 'bg-(color:--c)' : 'hatch')} />
              <span className="font-mono text-time text-ink-muted">{formatTime(timePart(i.start))}</span>
              {i.title}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
