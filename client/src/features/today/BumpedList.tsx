import { useState } from 'react';
import { addMinutes, datePart, formatMinutes, LocalDateTimeSchema, openSlots, timePart, type Bump, type PlanSources } from '@todo/shared';
import { useRoutine } from '../../actions/useRoutineActions';
import { formatDueDate, formatTime, plainDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Input, SectionLabel } from '../../ui/fields';

/** Routine time that events, skips and replacements took, with Make it up (the 3 nearest Open slots of the same length) and Let it go. */
export function BumpedList({ bumps, src, now, today }: { bumps: readonly Bump[]; src: PlanSources; now: string; today: string }) {
  const routine = useRoutine();
  const [choosing, setChoosing] = useState<string | null>(null);
  if (bumps.length === 0) return null;
  const keyOf = (b: Bump) => `${b.blockId}@${b.date}`;

  return (
    <section aria-label="Bumped">
      <SectionLabel count={bumps.length} className="mb-2">
        Bumped
      </SectionLabel>
      <ul className="divide-y divide-hairline border-b border-hairline">
        {bumps.map((b) => {
          const slots = choosing === keyOf(b) ? openSlots(src, b.minutes, now) : [];
          return (
            <li key={keyOf(b)} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-body">
                  {b.title} <span className="text-meta text-ink-muted">· {formatDueDate(b.date, today)} · <span className="font-mono">{formatMinutes(b.minutes)}</span> · {b.by === 'Skipped' ? 'skipped' : `for ${b.by}`}</span>
                </p>
                <span className="flex gap-1">
                  <Button variant="ghost" onClick={() => setChoosing(choosing === keyOf(b) ? null : keyOf(b))}>
                    Make it up
                  </Button>
                  <Button variant="ghost" onClick={() => void routine.letGo(b)}>
                    Let it go
                  </Button>
                </span>
              </div>
              {choosing === keyOf(b) && (
                <div className="mt-2 flex flex-wrap gap-2" aria-label={`Times to make up ${b.title}`}>
                  {slots.length === 0 && <p className="text-meta text-ink-muted">No open time that long in the next 7 days.</p>}
                  {slots.map((s) => (
                    <Button key={s.start} variant="secondary" onClick={() => void routine.makeUp(b, s).then(() => setChoosing(null))}>
                      {plainDate(datePart(s.start))}, {formatTime(timePart(s.start))}
                    </Button>
                  ))}
                  {/* Any time you choose, free time included (suggestions never use it on their own). */}
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const start = new FormData(e.currentTarget).get('start')?.toString() ?? '';
                      if (LocalDateTimeSchema.safeParse(start).success) void routine.makeUp(b, { start, end: addMinutes(start, b.minutes) }).then(() => setChoosing(null));
                    }}
                  >
                    <Input name="start" type="datetime-local" aria-label={`Pick a time to make up ${b.title}`} className="w-auto" required />
                    <Button variant="ghost" type="submit">
                      Use this time
                    </Button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
