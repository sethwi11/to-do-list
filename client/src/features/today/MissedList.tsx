import { useState } from 'react';
import { addMinutes, datePart, formatMinutes, LocalDateTimeSchema, openSlots, timePart, weekRange, type Bump, type PlanSources } from '@todo/shared';
import { useRoutine } from '../../actions/useRoutineActions';
import { parseLocalISODate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Input, SectionLabel } from '../../ui/fields';
import { formatTimeRange } from '../calendar/format';

export const weekOf = weekRange;

const weekday = (date: string) => parseLocalISODate(date).toLocaleDateString(undefined, { weekday: 'short' });

/** Planned blocks that got replaced or skipped this week (only those that can be rescheduled): find a new time, or skip them this week. */
export function MissedList({ bumps, src, now }: { bumps: readonly Bump[]; src: PlanSources; now: string }) {
  const routine = useRoutine();
  const [finding, setFinding] = useState<string | null>(null);
  if (bumps.length === 0) return null;
  const keyOf = (b: Bump) => `${b.blockId}@${b.date}`;

  return (
    <section aria-label="Missed this week">
      <SectionLabel count={bumps.length}>Missed this week</SectionLabel>
      <p className="mt-1 mb-2 text-meta text-ink-muted">Things you planned that got replaced or skipped. Find a new time, or skip them this week.</p>
      <ul className="divide-y divide-hairline border-b border-hairline">
        {bumps.map((b) => {
          const open = finding === keyOf(b);
          const slots = open ? openSlots(src, b.minutes, now) : [];
          return (
            <li key={keyOf(b)} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-body">
                  {b.title}
                  <span className="text-meta text-ink-muted">
                    {' '}· {weekday(b.date)} · <span className="font-mono">{formatMinutes(b.minutes)}</span> · {b.how === 'skipped' ? 'you skipped it' : `replaced by ${b.by}`}
                  </span>
                </p>
                <span className="flex gap-1">
                  <Button variant="ghost" aria-expanded={open} onClick={() => setFinding(open ? null : keyOf(b))}>
                    Find a new time
                  </Button>
                  <Button variant="ghost" onClick={() => void routine.letGo(b)}>
                    Skip this week
                  </Button>
                </span>
              </div>
              {open && (
                <div className="mt-2 flex flex-wrap items-center gap-2" aria-label={`New times for ${b.title}`}>
                  {slots.map((s) => (
                    <Button key={s.start} variant="secondary" onClick={() => void routine.makeUp(b, s).then(() => setFinding(null))}>
                      {weekday(datePart(s.start))} {formatTimeRange(timePart(s.start), timePart(s.end))}
                    </Button>
                  ))}
                  {slots.length === 0 && (
                    // Suggestions only use Open time; you can still choose any time, free time included.
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const start = new FormData(e.currentTarget).get('start')?.toString() ?? '';
                        if (LocalDateTimeSchema.safeParse(start).success) void routine.makeUp(b, { start, end: addMinutes(start, b.minutes) }).then(() => setFinding(null));
                      }}
                    >
                      <span className="text-meta text-ink-muted">No open {formatMinutes(b.minutes)} in the next 7 days. Pick a time:</span>
                      <Input name="start" type="datetime-local" aria-label={`Pick a new time for ${b.title}`} className="w-auto" required />
                      <Button variant="secondary" type="submit">
                        Use this time
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
