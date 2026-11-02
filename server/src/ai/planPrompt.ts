import type { ParsedPlanRequest } from '@todo/shared';

/** System prompt for "Plan my day". Kept constant so it can be cached. */
export const PLAN_SYSTEM_PROMPT = `You plan a student's remaining day as time blocks.

Rules:
- Only schedule between CURRENT TIME (rounded up to the next 15 minutes) and DAY END. Blocks must not overlap and must be in chronological order.
- Tasks with a fixed dueTime should finish by that time. Overdue and high-priority tasks go early.
- Use estimatedMinutes when given; otherwise estimate realistically (most small tasks take 15–30 minutes; assignments and labs take 60–120).
- Put 5–15 minute gaps between long blocks, and batch small tasks together.
- If not everything fits, schedule the most important tasks and list the rest in unscheduledTaskIds.
- Use the exact task ids you were given. start and end are 24h "HH:mm".
- summary: 2–3 friendly sentences that can be read aloud, naming the first thing to do.`;

export function buildPlanUserMessage(req: ParsedPlanRequest): string {
  const lines = req.tasks.map(
    (t) =>
      `- id=${t.id} | ${t.title} | priority ${t.priority}` +
      (t.estimatedMinutes ? ` | ~${t.estimatedMinutes} min` : '') +
      (t.dueTime ? ` | due by ${t.dueTime}` : '') +
      (t.overdue ? ' | OVERDUE' : ''),
  );
  return `CURRENT TIME: ${req.clientNow.date} ${req.clientNow.time} (${req.clientNow.timezone})\nDAY END: ${req.dayEnd}\n\nTASKS:\n${lines.join('\n')}`;
}
