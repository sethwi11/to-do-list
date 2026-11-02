import { useState, type FormEvent } from 'react';
import type { Subtask } from '@todo/shared';

interface Props {
  parentTitle: string;
  subtasks: Subtask[];
  /** Subtasks are saved as a whole array on the parent task (one PATCH). */
  onChange: (subtasks: Subtask[]) => void;
}

export function SubtaskList({ parentTitle, subtasks, onChange }: Props) {
  const [draft, setDraft] = useState('');

  function add(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    // Generated in the browser: subtasks have no table of their own, so no server-assigned ids.
    onChange([...subtasks, { id: crypto.randomUUID(), title, done: false }]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-1">
      <ul aria-label={`Subtasks of ${parentTitle}`} className="flex flex-col gap-1">
        {subtasks.map((s) => (
          <li key={s.id} className="group/sub flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.done}
              onChange={() => onChange(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
              aria-label={`Mark subtask "${s.title}" as ${s.done ? 'not done' : 'done'}`}
              className="h-4 w-4 cursor-pointer accent-indigo-600"
            />
            <span className={`flex-1 break-words ${s.done ? 'text-slate-400 line-through' : ''}`}>{s.title}</span>
            <button
              type="button"
              onClick={() => onChange(subtasks.filter((x) => x.id !== s.id))}
              aria-label={`Delete subtask "${s.title}"`}
              className="rounded px-1 text-xs text-slate-400 hover:text-red-600 sm:opacity-0 sm:group-hover/sub:opacity-100 sm:focus:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a subtask and press Enter"
          aria-label={`Add a subtask to ${parentTitle}`}
          maxLength={200}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-sm placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-300 dark:hover:border-slate-700"
        />
      </form>
    </div>
  );
}
