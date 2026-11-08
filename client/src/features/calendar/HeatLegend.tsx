import { LOAD_LEVEL_NAMES, type DayLoad, describeLoad } from '@todo/shared';
import { fullDate } from '../../lib/dates';

const LEVELS = [1, 2, 3, 4] as const;

/** The four shades and what they mean, shown while the workload map is on. */
export function HeatLegend() {
  return (
    <ul aria-label="Workload shading" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-muted">
      <li className="font-mono text-time uppercase">Workload</li>
      {LEVELS.map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 border border-hairline" style={{ backgroundColor: `var(--heat-${level})` }} />
          {LOAD_LEVEL_NAMES[level]}
        </li>
      ))}
    </ul>
  );
}

/** A small card that follows the pointer over a day in the workload map: what makes that day heavy. */
export function HeatTooltip({ load, x, y }: { load: DayLoad; x: number; y: number }) {
  const day = fullDate(load.date);
  // Kept on screen: flipped to the left of the pointer near the right edge, and above it near the bottom.
  const flipX = typeof window !== 'undefined' && x > window.innerWidth - 260;
  const flipY = typeof window !== 'undefined' && y > window.innerHeight - 120;
  return (
    <div
      role="presentation"
      className="pointer-events-none fixed z-50 max-w-60 rounded-control border border-hairline bg-surface px-3 py-2 text-meta text-ink shadow-popover"
      style={{ left: flipX ? x - 12 : x + 12, top: flipY ? y - 12 : y + 12, transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})` }}
    >
      <p className="font-medium">{day}</p>
      <p className="text-ink-muted">{describeLoad(load)}</p>
      {load.level > 0 && (
        <p className="mt-0.5 font-mono text-time text-ink-muted">
          {LOAD_LEVEL_NAMES[load.level]} · load {load.score.toFixed(1)}
        </p>
      )}
    </div>
  );
}
