import type { CSSProperties } from 'react';
import { CircleAlert } from 'lucide-react';
import { timeOfMinutes, timePart, type CalendarColor, type DayPlan, type PlanItem } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars, shadeFor, shadeProps } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatTime } from '../../lib/dates';
import { formatTimeRange } from '../calendar/format';
import { BlockText, blockPadding } from '../../ui/blocks';
import { agendaRange, layoutLanes, minutesInto } from './todayModel';

const PX_PER_MINUTE = 1;
const GUTTER = '4.5rem';

/** The category name shown on an item. */
export function categoryOf(item: PlanItem, names: ReadonlyMap<string, { name: string }>): string {
  if (item.kind === 'open') return 'Open time';
  if (item.priority === 'free') return 'Free';
  return (item.calendarId && names.get(item.calendarId)?.name) || (item.kind === 'class' ? 'Class' : 'No category');
}

/** The day as a time-scaled column: every item shaded for its full length, overlaps side by side, a line at now. */
export function Agenda({ plan, now, onOpen }: { plan: DayPlan; now: string; onOpen: (item: PlanItem, el: HTMLElement) => void }) {
  const { calendarsById } = useApp();
  const { from, to } = agendaRange(plan);
  const lanes = layoutLanes(plan.items);
  const y = (minutes: number) => (minutes - from) * PX_PER_MINUTE;
  const at = (dt: string) => Math.min(to, Math.max(from, minutesInto(plan.date, dt)));
  const nowAt = minutesInto(plan.date, now);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);

  return (
    <div className="relative" style={{ height: y(to) }}>
      {hours.map((m) => (
        <div key={m} className="absolute inset-x-0 border-t border-hairline" style={{ top: y(m) }}>
          <span className="absolute -top-2 left-0 bg-paper pr-2 font-mono text-time text-ink-muted">{formatTime(timeOfMinutes(m % 1440))}</span>
        </div>
      ))}
      {plan.items.map((item) => {
        const top = y(at(item.start));
        const minutes = at(item.end) - at(item.start);
        // Exactly its length; the 2px gap to the next block comes out of this one.
        const height = minutes * PX_PER_MINUTE - 2;
        const { lane, lanes: n } = lanes.get(item.key) ?? { lane: 0, lanes: 1 };
        const look = shadeProps(item.color, shadeFor(item));
        const past = item.end <= now;
        const current = item.start <= now && now < item.end && item.kind !== 'open';
        const style = { ...look.style, top, height, left: `calc(${GUTTER} + (100% - ${GUTTER}) * ${lane / n})`, width: `calc((100% - ${GUTTER}) / ${n} - 3px)` } as CSSProperties;
        const category = item.makeup ? 'Make-up' : categoryOf(item, calendarsById);
        const time = formatTimeRange(timePart(item.start), timePart(item.end));
        const notes = [...(item.replaces.length ? [`replaces ${item.replaces.join(', ')}`] : []), ...(item.hidden.length ? [`+${item.hidden.length} hidden: ${item.hidden.join(', ')}`] : [])];
        const clash = item.clashes.length > 0 ? `Clashes with ${item.clashes.join(', ')}` : '';
        const body = (
          <BlockText
            title={item.title}
            detail={category}
            time={time}
            minutes={minutes}
            alert={clash && <CircleAlert className="size-3.5 shrink-0" aria-label={clash} />}
            notes={(notes.length > 0 || clash) && minutes >= 60 && <p className="truncate text-time italic">{[clash, ...notes].filter(Boolean).join(' · ')}</p>}
          />
        );
        const className = cx('absolute overflow-hidden rounded-control text-left text-ink', blockPadding(minutes), look.className, past && 'opacity-60', current && 'outline-2 outline-offset-1 outline-accent');
        const tooltip = [item.title, category, time, clash, ...notes].filter(Boolean).join(' · ');
        return item.kind === 'open' ? (
          <div key={item.key} style={style} title={tooltip} className={cx(className, 'text-ink-muted')}>
            {body}
          </div>
        ) : (
          <button key={item.key} type="button" style={style} title={tooltip} className={cx(className, 'transition-[filter] hover:brightness-95')} onClick={(e) => onOpen(item, e.currentTarget)} aria-current={current ? 'time' : undefined}>
            {body}
          </button>
        );
      })}
      {nowAt >= from && nowAt <= to && (
        <div aria-hidden className="pointer-events-none absolute right-0 h-0.5 bg-accent" style={{ top: y(nowAt), left: `calc(${GUTTER} - 0.5rem)` }}>
          <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-accent" />
        </div>
      )}
    </div>
  );
}

/** Each category on the day once, with its color, plus the hatch for free and open time. */
export function Legend({ items }: { items: readonly PlanItem[] }) {
  const { calendarsById } = useApp();
  const seen = new Map<string, CalendarColor | null>();
  for (const i of items) {
    const free = i.kind === 'open' || i.priority === 'free';
    const name = free ? 'Free and open' : categoryOf(i, calendarsById);
    if (!seen.has(name)) seen.set(name, free ? null : i.color);
  }
  return (
    <ul aria-label="Categories today" className="flex flex-wrap gap-x-4 gap-y-1.5 text-meta text-ink-muted">
      {[...seen].map(([name, color]) => (
        <li key={name} className="inline-flex items-center gap-1.5">
          <span style={color ? calendarVars(color) : ({ '--c': 'var(--rule)' } as CSSProperties)} className={cx('size-3 rounded-[2px]', color ? 'bg-(color:--c)' : 'hatch')} />
          {name}
        </li>
      ))}
    </ul>
  );
}
