import type { ExtractionResult, ParsedExtractRequest } from '@todo/shared';

/** Lowercase, drop punctuation and filler words, so "Email Valencia." matches "email valencia". */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\b(the|a|an|my|to)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic guardrails applied after the model, because the prompt
 * *asks* for these properties but code *guarantees* them:
 * - actions must target a task id that actually exists (queries excepted),
 * - new tasks that duplicate an existing or already-extracted title are dropped,
 * - duplicate tasks within one response are dropped,
 * - category names are matched case-insensitively to real lists, else null.
 */
export function sanitizeExtraction(result: ExtractionResult, req: ParsedExtractRequest): ExtractionResult {
  const existingIds = new Set(req.existingTasks.map((t) => t.id));
  const seen = new Set([
    ...req.existingTasks.filter((t) => t.status === 'todo').map((t) => normalizeTitle(t.title)),
    ...req.alreadyExtracted.map(normalizeTitle),
  ]);
  const categoryByLower = new Map(req.categories.map((c) => [c.toLowerCase(), c]));
  const matchCategory = (name: string | null) => (name ? (categoryByLower.get(name.toLowerCase()) ?? null) : null);

  const tasks = result.tasks
    .filter((t) => {
      const key = normalizeTitle(t.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({ ...t, category: matchCategory(t.category), subtasks: t.subtasks.filter((s) => s.trim()) }));

  const actions = result.actions
    .filter((a) => (a.type === 'query' ? true : a.targetTaskId !== null && existingIds.has(a.targetTaskId)))
    .map((a) => (a.changes ? { ...a, changes: { ...a.changes, category: matchCategory(a.changes.category) } } : a));

  return { ...result, tasks, actions };
}
