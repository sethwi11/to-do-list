import { useState } from 'react';
import type { PlanResult, Task, UpdateTaskInput } from '@todo/shared';
import { ApiError } from '../api/client';
import { aiApi } from '../api/ai';
import { clientNow } from '../lib/clientNow';

interface Deps {
  tasks: Task[];
  today: string;
  updateTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
  speak: ((text: string) => Promise<void>) | null;
  showToast: (message: string) => void;
}

/** "Plan my day": send today's open tasks to Claude, show a time-blocked schedule, apply it on accept. */
export function usePlanMyDay({ tasks, today, updateTask, speak, showToast }: Deps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);

  // Today's work = open tasks due today or already overdue.
  const candidates = tasks.filter((t) => t.status === 'todo' && t.dueDate !== null && t.dueDate <= today);

  async function start() {
    if (candidates.length === 0) {
      showToast('Nothing due today to plan. Nice!');
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const result = await aiApi.plan({
        clientNow: clientNow(),
        tasks: candidates.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          dueTime: t.dueTime,
          overdue: t.dueDate! < today,
        })),
      });
      setPlan(result);
      if (speak) void speak(result.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not build a plan.');
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!plan) return;
    // Give the planned tasks today's date, their start time, and the plan's order
    // (positioned before everything else in manual sort).
    const minSort = Math.min(0, ...tasks.map((t) => t.sortOrder));
    await Promise.all(
      plan.blocks.map((b, i) =>
        updateTask(b.taskId, { dueDate: today, dueTime: b.start, sortOrder: minSort - (plan.blocks.length - i) * 1024 }),
      ),
    );
    setOpen(false);
    showToast(`Scheduled ${plan.blocks.length} task${plan.blocks.length === 1 ? '' : 's'}`);
  }

  return { open, close: () => setOpen(false), loading, error, plan, start, accept };
}
