import { describeLoad, LOAD_LEVEL_NAMES, type DayLoad } from '@todo/shared';
import { parseLocalISODate } from '../../lib/dates';
import { HeatLegend } from '../calendar/HeatLegend';

/** The coming week as the workload heatmap: one shaded cell a day, with what makes it heavy. */
export function NextWeek({ days }: { days: readonly DayLoad[] }) {
  return (
    <div>
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const date = parseLocalISODate(d.date);
          return (
            <li key={d.date} className="min-h-24 border border-hairline p-1.5 text-meta" style={d.level > 0 ? { backgroundColor: `var(--heat-${d.level})` } : undefined}>
              <p className="font-mono text-time uppercase">
                {date.toLocaleDateString(undefined, { weekday: 'short' })} <span className="text-ink-muted">{date.getDate()}</span>
              </p>
              <p className="mt-1 font-medium">{LOAD_LEVEL_NAMES[d.level]}</p>
              <p className="max-sm:sr-only text-ink-muted">{describeLoad(d)}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        <HeatLegend />
      </div>
    </div>
  );
}
