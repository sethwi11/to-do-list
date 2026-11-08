import { useState, type FormEvent } from 'react';
import { QuickAddInput } from '../ui/fields';
import { useApp, type TaskDefaults } from './AppContext';

/** The underlined box in every page header. */
export function QuickAdd({ defaults, className }: { defaults?: TaskDefaults; className?: string }) {
  const { addTask } = useApp();
  const [value, setValue] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    const task = await addTask({ title, dueDate: defaults?.dueDate ?? null, calendarId: defaults?.calendarId ?? null, applicationId: defaults?.applicationId ?? null });
    if (task) setValue('');
  }

  return (
    <form onSubmit={submit} className={className}>
      <QuickAddInput
        id="quick-add"
        aria-label="Add a task"
        placeholder="Add a task…"
        // N is the shortcut that works today; Ctrl/⌘ K arrives with the command palette.
        shortcut="N"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setValue('');
            e.currentTarget.blur();
          }
        }}
      />
    </form>
  );
}
