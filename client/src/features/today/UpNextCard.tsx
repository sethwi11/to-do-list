import { datePart, minutesBetween, timePart } from '@todo/shared';
import { ExternalLink, MapPin } from 'lucide-react';
import { calendarVars } from '../../lib/calendarColors';
import { formatCountdown, formatDueDate, formatTime } from '../../lib/dates';
import { formatTimeRange } from '../calendar/format';
import { localDateTime, type CalendarItem } from '../calendar/calendarModel';

interface UpNextCardProps {
  item: Extract<CalendarItem, { kind: 'event' }>;
  now: Date;
  today: string;
  onOpen: (anchor: HTMLElement) => void;
}

/** The next thing on the schedule: its title, a countdown, and where / how to get there. */
export function UpNextCard({ item, now, today, onOpen }: UpNextCardProps) {
  const { occurrence } = item;
  const event = occurrence.event;
  const startDate = datePart(occurrence.start);
  const countdown = formatCountdown(minutesBetween(localDateTime(now), occurrence.start) * 60_000);
  const when =
    startDate === today
      ? formatTimeRange(timePart(occurrence.start), timePart(occurrence.end))
      : `${formatDueDate(startDate, today)}, ${formatTime(timePart(occurrence.start))}`;

  return (
    <section aria-label="Up next" style={calendarVars(item.color)} className="mb-8 border border-rule border-l-[3px] border-l-(color:--c) bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6">
        <h2 className="text-label text-ink-muted uppercase">Up next</h2>
        {/* Not a live region: announcing every minute would be noise. */}
        <p className="font-mono text-title text-ink tabular-nums">
          <span className="sr-only">Starts </span>in {countdown}
        </p>
      </div>
      <button type="button" onClick={(e) => onOpen(e.currentTarget)} className="mt-1 block max-w-full text-left font-display text-section break-words text-ink hover:underline hover:underline-offset-4">
        {event.title}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-body text-ink-muted">
        <span className="font-mono text-meta">{when}</span>
        {event.location && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="break-words">{event.location}</span>
          </span>
        )}
        {event.link && (
          // noopener: the page we open must not get a handle back to this one.
          <a href={event.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink underline underline-offset-2">
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            Join: {new URL(event.link).host}
          </a>
        )}
      </div>
    </section>
  );
}
