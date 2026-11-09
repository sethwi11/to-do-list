import { Square, Timer } from 'lucide-react';
import type { PlanItem } from '@todo/shared';
import { formatCountdown } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Soundtrack } from './Soundtrack';
import { useFocusTimer } from './useFocusTimer';

/** On the Now card: Start focus on a focus block (Pomodoro until the block ends), and its soundtrack. */
export function FocusPanel({ item, big = false }: { item: PlanItem; big?: boolean }) {
  const { state, now, start, stop, settings } = useFocusTimer();
  const running = state?.key === item.key ? state : null;
  if (!item.focus && !item.soundtrack) return null;
  const left = running ? running.phaseEnd - now : 0;
  const share = running ? 1 - left / Math.max(1, running.phaseEnd - running.phaseStart) : 0;
  const mmss = `${Math.floor(Math.max(0, left) / 60_000)}:${String(Math.floor((Math.max(0, left) % 60_000) / 1000)).padStart(2, '0')}`;

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {running ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-label text-ink-muted uppercase">{running.phase === 'focus' ? `Focus ${running.done + 1}` : running.done % settings.longBreakEvery === 0 ? 'Long break' : 'Break'}</p>
            {/* Not a live region: a second-by-second announcement would be noise. */}
            <p className={big ? 'font-mono text-[clamp(1.75rem,3.5vw,3rem)] tabular-nums' : 'font-mono text-section tabular-nums'}>{mmss}</p>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-label="This interval" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={Square} onClick={stop}>
              Stop
            </Button>
            <span className="text-meta text-ink-muted">{running.done} done · ends with the block in {formatCountdown(running.blockEnd - now)}</span>
          </div>
        </div>
      ) : (
        item.focus && (
          <Button variant="primary" icon={Timer} onClick={() => start(item)}>
            Start focus · {Math.max(1, Math.min(settings.focusMinutes, Math.floor((new Date(`${item.end}:00`).getTime() - Date.now()) / 60_000)))} min
          </Button>
        )
      )}
      {item.soundtrack && (
        <div className="mt-2">
          <Soundtrack name={item.soundtrack} />
        </div>
      )}
    </div>
  );
}
