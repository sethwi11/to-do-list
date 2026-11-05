import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, CircleAlert, ListChecks, Pencil, Timer } from 'lucide-react';
import type { CalendarColor, Priority } from '@todo/shared';
import { calendarVars } from '../lib/calendarColors';
import { cx } from '../lib/cx';
import { Checkbox } from './Checkbox';
import { IconButton } from './Button';
import { useReducedMotion } from './useReducedMotion';

export interface TaskRowProps {
  title: string;
  /** Whether the task is complete (the saved state). */
  done: boolean;
  priority: Priority;
  /** Already formatted: "Today", "Tomorrow", "Mon, Nov 10". */
  dueLabel?: string | null;
  dueTone?: 'normal' | 'today' | 'overdue';
  calendar?: { name: string; color: CalendarColor } | null;
  subtasks?: { done: number; total: number } | null;
  /** Total focus time logged, in minutes. */
  focusMinutes?: number | null;
  /** Called when the checkbox is toggled, after any animation has played. */
  onToggle: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  onSchedule?: () => void;
  onTimer?: () => void;
  /**
   * Play the full completion sequence (strike through, fade, collapse) and *then* call
   * onToggle. Use where a completed task disappears from the list; leave off where
   * completed tasks stay visible.
   */
  leaveOnComplete?: boolean;
}

// The sequence, from the click: the line draws for 250ms; at 400ms the row starts to fade and
// collapse (250ms); when that finishes, the change is committed and the list drops the row.
const COLLAPSE_AFTER_MS = 400;
const COLLAPSE_MS = 250;

const PRIORITY_BAR: Record<Priority, string | null> = {
  // High is the full height of the row and medium is half of it, so the two differ by shape,
  // not only by color (the bars are tomato and ochre).
  high: 'inset-y-0 bg-accent',
  medium: 'inset-y-[25%] bg-warning',
  low: null,
};
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

export function TaskRow({
  title,
  done,
  priority,
  dueLabel,
  dueTone = 'normal',
  calendar,
  subtasks,
  focusMinutes,
  onToggle,
  onOpen,
  onEdit,
  onSchedule,
  onTimer,
  leaveOnComplete = false,
}: TaskRowProps) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState<'idle' | 'striking' | 'collapsing'>('idle');
  const timers = useRef<number[]>([]);
  const commit = useRef(onToggle);
  commit.current = onToggle;
  const phase = useRef(leaving);
  phase.current = leaving;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // If the row is removed mid-animation, still save the change the person asked for.
  useEffect(
    () => () => {
      clearTimers();
      if (phase.current !== 'idle') commit.current();
    },
    [],
  );
  // A task that becomes un-done again (e.g. via Undo) starts fresh.
  useEffect(() => {
    if (!done) setLeaving('idle');
  }, [done]);

  function handleToggle() {
    if (!leaveOnComplete || done || reduced) {
      onToggle();
      return;
    }
    if (leaving === 'striking') {
      // Changed their mind before the row started to leave: cancel.
      clearTimers();
      setLeaving('idle');
      return;
    }
    if (leaving !== 'idle') return;
    setLeaving('striking');
    timers.current = [
      window.setTimeout(() => setLeaving('collapsing'), COLLAPSE_AFTER_MS),
      window.setTimeout(() => {
        phase.current = 'idle'; // committed: the unmount cleanup must not commit again
        commit.current();
      }, COLLAPSE_AFTER_MS + COLLAPSE_MS),
    ];
  }

  const checked = done || leaving !== 'idle';
  const bar = PRIORITY_BAR[priority];
  const showMeta = dueLabel || calendar || subtasks || focusMinutes;

  return (
    // Collapse: animating a grid row from 1fr to 0fr smoothly shrinks the row to nothing (height itself can't animate from "auto").
    <li
      data-collapsing={leaving === 'collapsing'}
      className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-250 ease-out data-[collapsing=true]:grid-rows-[0fr] data-[collapsing=true]:opacity-0"
    >
      <div className="min-h-0 overflow-hidden">
        <div className="group relative flex min-h-11 items-center gap-1 border-b border-hairline pr-1 pl-2 transition-colors duration-150 ease-out hover:bg-surface focus-within:bg-surface">
          {bar && <span aria-hidden className={cx('absolute left-0 w-[3px]', bar)} />}
          <span className="sr-only">{PRIORITY_LABEL[priority]}.</span>

          <Checkbox checked={checked} onChange={handleToggle} label={`Mark "${title}" as ${checked ? 'not done' : 'done'}`} />

          <div className="min-w-0 flex-1 py-2.5 pl-1">
            {onOpen ? (
              <button type="button" onClick={onOpen} className="block max-w-full text-left text-body text-ink">
                <span data-done={checked} className="strike break-words">
                  {title}
                </span>
              </button>
            ) : (
              <span data-done={checked} className="strike text-body break-words">
                {title}
              </span>
            )}
          </div>

          {/* Metadata sits on the same line, right-aligned. On a phone only the due date and calendar stay. */}
          {showMeta && (
            <div className="flex shrink-0 items-center gap-3 pl-2 text-meta text-ink-muted">
              {subtasks && (
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <ListChecks className="size-4" aria-hidden />
                  <span className="sr-only">Subtasks done:</span>
                  <span className="font-mono tabular-nums">
                    {subtasks.done}/{subtasks.total}
                  </span>
                </span>
              )}
              {focusMinutes ? (
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <Timer className="size-4" aria-hidden />
                  <span className="sr-only">Focus time:</span>
                  <span className="font-mono tabular-nums">{focusMinutes}m</span>
                </span>
              ) : null}
              {dueLabel && (
                <span
                  className={cx(
                    'inline-flex items-center gap-1',
                    dueTone === 'overdue' && !checked && 'text-danger',
                    dueTone === 'today' && !checked && 'text-accent-ink',
                  )}
                >
                  {/* A shape as well as a color, so "overdue" isn't carried by red alone. */}
                  {dueTone === 'overdue' && !checked && <CircleAlert className="size-4" aria-hidden />}
                  {dueTone === 'overdue' && !checked && <span className="sr-only">Overdue:</span>}
                  {dueLabel}
                </span>
              )}
              {calendar && (
                <span title={calendar.name} style={calendarVars(calendar.color)} className="inline-flex items-center">
                  <span aria-hidden className="size-2 bg-(color:--c)" />
                  <span className="sr-only">Calendar: {calendar.name}</span>
                </span>
              )}
            </div>
          )}

          {/* Hover or keyboard focus reveals the actions. */}
          {(onEdit || onSchedule || onTimer) && (
            <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-150 ease-out group-focus-within:opacity-100 group-hover:opacity-100 max-sm:hidden">
              {onEdit && <IconButton icon={Pencil} label={`Edit "${title}"`} onClick={onEdit} />}
              {onSchedule && <IconButton icon={CalendarPlus} label={`Schedule "${title}"`} onClick={onSchedule} />}
              {onTimer && <IconButton icon={Timer} label={`Start a focus timer for "${title}"`} onClick={onTimer} />}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
