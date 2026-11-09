import { useState } from 'react';
import { Search } from 'lucide-react';
import { addMinutes, datePart, openSlots, timePart } from '@todo/shared';
import { formatTime, plainDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { usePlanSources, useNowText } from '../today/useTodayPlan';

/** "Find a time": Open slots of this length in the next 7 days, the template's meeting windows first. */
export function FindTime({ minutes, onPick }: { minutes: number; onPick: (start: string, end: string) => void }) {
  const [open, setOpen] = useState(false);
  const { src } = usePlanSources();
  const now = useNowText();
  const slots = open ? openSlots(src, minutes, addMinutes(now, 15), { windowsFirst: true, count: 6 }) : [];
  return (
    <div>
      <Button variant="ghost" icon={Search} onClick={() => setOpen(!open)} aria-expanded={open}>
        Find a time
      </Button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Open times">
          {slots.length === 0 && <p className="text-meta text-ink-muted">No open time that long in the next 7 days.</p>}
          {slots.map((s) => (
            <Button key={s.start} variant="secondary" onClick={() => { onPick(s.start, s.end); setOpen(false); }} title={s.inWindow ? 'Inside a meeting window' : undefined}>
              {plainDate(datePart(s.start))}, {formatTime(timePart(s.start))}
              {s.inWindow && <span className="text-meta text-accent-ink"> · meeting time</span>}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
