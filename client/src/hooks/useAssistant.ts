import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LOW_CONFIDENCE,
  type Category,
  type CreateTaskInput,
  type ExtractedAction,
  type ExtractedTask,
  type ExtractionResult,
  type ExtractMode,
  type QueryRange,
  type Task,
  type TaskSource,
  type UpdateTaskInput,
} from '@todo/shared';
import { ApiError } from '../api/client';
import { aiApi } from '../api/ai';
import { clientNow } from '../lib/clientNow';
import { toCreateInput, toUpdateInput } from '../lib/reviewMapping';
import { AUTO_ACCEPT_THRESHOLD, type Settings } from './useSettings';

export type ReviewItem =
  | { id: string; kind: 'task'; task: ExtractedTask; source: TaskSource; checked: boolean }
  | { id: string; kind: 'action'; action: ExtractedAction; targetTitle: string; checked: boolean };

interface Deps {
  tasks: Task[];
  categories: Category[];
  settings: Settings;
  createTask: (input: CreateTaskInput) => Promise<Task | null>;
  updateTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  /** Show the part of the list a voice query asked about. */
  onQuery: (range: QueryRange) => void;
  /** Read text aloud (the voice layer pauses the mic while it plays). */
  speak: (text: string) => Promise<void>;
  showToast: (message: string, onUndo?: () => void) => void;
}

/**
 * The extraction pipeline and review queue, shared by all three inputs
 * (brain dump, push-to-talk, conversation): text in, review cards out.
 *
 * Nothing Claude proposes touches the list until you accept it, except
 * queries (read-only) and, if you enable it, high-confidence *new* tasks.
 * Destructive actions always need an explicit confirmation.
 */
// Pending review items survive a page refresh, so extracted work isn't lost.
const QUEUE_KEY = 'voice-todo.reviewQueue';
function loadQueue(): ReviewItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  } catch {
    return [];
  }
}

export function useAssistant(deps: Deps) {
  const [items, setItems] = useState<ReviewItem[]>(loadQueue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<{ text: string; question: string | null } | null>(null);

  // Refs hold values the async pipeline must read *at the time it runs*, not
  // when the callback was created, so the callbacks can stay stable.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);
  const pendingQuestion = useRef<string | null>(null);
  /** Titles accepted this session; sent so the model won't propose them again. */
  const acceptedTitles = useRef<string[]>([]);
  /** Requests run one at a time, so each sees the results of the previous one (dedupe, pending question). */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const process = useCallback(
    (text: string, mode: ExtractMode, recentContext: string[] = []): Promise<ExtractionResult | null> => {
      const run = async () => {
        const d = depsRef.current;
        setBusy(true);
        setError(null);
        try {
          const result = await aiApi.extract({
            text,
            mode,
            clientNow: clientNow(),
            recentContext,
            existingTasks: d.tasks
              .filter((t) => t.status === 'todo')
              .slice(0, 500)
              .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, dueTime: t.dueTime, status: t.status })),
            alreadyExtracted: [
              ...itemsRef.current.flatMap((i) => (i.kind === 'task' ? [i.task.title] : [])),
              ...acceptedTitles.current,
            ].slice(-200),
            pendingQuestion: pendingQuestion.current,
            categories: d.categories.map((c) => c.name),
          });
          await handleResult(result, mode === 'brain-dump' ? 'brain-dump' : 'voice', mode);
          return result;
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong while extracting tasks.');
          return null;
        } finally {
          setBusy(false);
        }
      };
      const next = queue.current.then(run, run);
      queue.current = next;
      return next;
    },
    [],
  );

  async function handleResult(result: ExtractionResult, source: TaskSource, mode: ExtractMode) {
    const d = depsRef.current;
    const titleOf = (id: string | null) => d.tasks.find((t) => t.id === id)?.title ?? 'a task';

    // Queries are read-only, so run them immediately.
    for (const a of result.actions) if (a.type === 'query' && a.queryRange) d.onQuery(a.queryRange);

    // Optionally auto-add confident new tasks; everything else goes to review.
    const auto = d.settings.autoAccept ? result.tasks.filter((t) => t.confidence >= AUTO_ACCEPT_THRESHOLD) : [];
    const toReview = result.tasks.filter((t) => !auto.includes(t));

    const newItems: ReviewItem[] = [
      ...toReview.map((task) => ({
        id: crypto.randomUUID(),
        kind: 'task' as const,
        task,
        source,
        checked: task.confidence >= LOW_CONFIDENCE,
      })),
      ...result.actions
        .filter((a) => a.type !== 'query')
        .map((action) => ({
          id: crypto.randomUUID(),
          kind: 'action' as const,
          action,
          targetTitle: titleOf(action.targetTaskId),
          // Deletes are never pre-checked: "Accept all" must not delete anything.
          checked: action.type !== 'delete' && action.confidence >= LOW_CONFIDENCE,
        })),
    ];
    if (newItems.length) setItems((prev) => [...prev, ...newItems]);

    if (auto.length) {
      const created: Task[] = [];
      for (const t of auto) {
        const task = await d.createTask(toCreateInput(t, d.categories, source));
        if (task) {
          created.push(task);
          acceptedTitles.current.push(task.title);
        }
      }
      if (created.length) {
        d.showToast(`Added ${created.length} task${created.length === 1 ? '' : 's'} automatically`, () => {
          for (const t of created) void depsRef.current.deleteTask(t.id);
        });
      }
    }

    pendingQuestion.current = result.clarifyingQuestion;
    // In conversation mode, small talk produces an empty reply: stay quiet.
    if (result.spokenReply || result.clarifyingQuestion) {
      setReply({ text: result.spokenReply, question: result.clarifyingQuestion });
    }
    // A typed brain dump only talks back when it has a question or answers a query.
    const toSay = [result.spokenReply, result.clarifyingQuestion].filter(Boolean).join(' ');
    const worthSaying = mode !== 'brain-dump' || result.clarifyingQuestion !== null || hasQuery(result);
    if (d.settings.tts && toSay && worthSaying) await d.speak(toSay);
  }

  // ---- review queue operations ------------------------------------------

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const accept = useCallback(async (id: string): Promise<boolean> => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return false;
    const d = depsRef.current;

    if (item.kind === 'task') {
      const created = await d.createTask(toCreateInput(item.task, d.categories, item.source));
      if (!created) return false;
      acceptedTitles.current.push(created.title);
    } else {
      const { action } = item;
      const target = action.targetTaskId!;
      if (action.type === 'complete') {
        if (!(await d.updateTask(target, { status: 'done' }))) return false;
      } else if (action.type === 'update') {
        const changes = toUpdateInput(action, d.categories);
        if (changes && !(await d.updateTask(target, changes))) return false;
      } else if (action.type === 'delete') {
        // Destructive: always confirm, even when it came from "Accept".
        if (!window.confirm(`Delete "${item.targetTitle}"?`)) return false;
        if (!(await d.deleteTask(target))) return false;
      }
    }
    remove(id);
    return true;
  }, []);

  const acceptAll = useCallback(async () => {
    const chosen = itemsRef.current.filter((i) => i.checked && !(i.kind === 'action' && i.action.type === 'delete'));
    let count = 0;
    for (const item of chosen) if (await accept(item.id)) count++;
    if (count) depsRef.current.showToast(`Accepted ${count} item${count === 1 ? '' : 's'}`);
  }, [accept]);

  const updateTaskDraft = useCallback((id: string, task: ExtractedTask) => {
    setItems((prev) => prev.map((i) => (i.id === id && i.kind === 'task' ? { ...i, task } : i)));
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }, []);

  return {
    items,
    busy,
    error,
    reply,
    dismissError: () => setError(null),
    process,
    accept,
    reject: remove,
    acceptAll,
    clearAll: () => setItems([]),
    updateTaskDraft,
    toggleChecked,
  };
}

const hasQuery = (r: ExtractionResult) => r.actions.some((a) => a.type === 'query');
