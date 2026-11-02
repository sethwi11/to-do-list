import type { PlanResult, Task } from '@todo/shared';
import { formatTime } from '../lib/dates';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  plan: PlanResult | null;
  tasksById: Map<string, Task>;
  onAccept: () => void;
}

export function PlanDialog({ open, onClose, loading, error, plan, tasksById, onAccept }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Plan my day">
      {loading && (
        <p className="py-6 text-center text-sm text-slate-500" aria-live="polite">
          Building your schedule…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      {plan && !loading && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{plan.summary}</p>
          <ol className="flex flex-col gap-2" aria-label="Suggested schedule">
            {plan.blocks.map((b) => (
              <li key={b.taskId + b.start} className="flex gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <span className="w-32 shrink-0 tabular-nums text-slate-500">
                  {formatTime(b.start)} – {formatTime(b.end)}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{tasksById.get(b.taskId)?.title ?? 'Task'}</span>
                  {b.note && <span className="block text-xs text-slate-500">{b.note}</span>}
                </span>
              </li>
            ))}
          </ol>
          {plan.unscheduledTaskIds.length > 0 && (
            <p className="text-xs text-slate-500">
              Didn't fit today: {plan.unscheduledTaskIds.map((id) => tasksById.get(id)?.title ?? 'task').join(', ')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Not now
            </button>
            <button type="button" onClick={onAccept} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              Use this schedule
            </button>
          </div>
          <p className="text-xs text-slate-500">Accepting sets each task's time to its start time and orders them in your list.</p>
        </div>
      )}
    </Modal>
  );
}
