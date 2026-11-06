import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { isOpen, PRIORITIES, RECURRENCES, type Priority, type Recurrence, type Subtask, type Task } from '@todo/shared';
import { useApp, type TaskDefaults } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { Button, IconButton } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Label, Select, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { uploadAndLink } from '../attachments/useAttachments';
import { AttachmentList } from '../files/AttachmentList';

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Never',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** The dialog for adding a task or editing one. Which one is decided by the shared dialog state. */
export function TaskDialog() {
  const { dialog, closeDialog, tasks, removeTask } = useApp();
  const open = dialog?.kind === 'task';
  const editing = open && dialog.mode === 'edit' ? (tasks.find((t) => t.id === dialog.id) ?? null) : null;

  return (
    <Dialog
      open={open}
      onClose={() => closeDialog('task')}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                closeDialog('task');
                void removeTask(editing);
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => closeDialog('task')}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-form">
            {editing ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      {open && (editing || dialog.mode === 'new') && (
        // Mounted only while open, so the fields start fresh (from the task, or the defaults) every time.
        <TaskForm task={editing} defaults={dialog.mode === 'new' ? dialog.defaults : {}} />
      )}
    </Dialog>
  );
}

function TaskForm({ task, defaults }: { task: Task | null; defaults: TaskDefaults }) {
  const { calendars, applications, addTask, saveTask, closeDialog, showToast } = useApp();

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? defaults.priority ?? 'medium');
  const [calendarId, setCalendarId] = useState(task?.calendarId ?? defaults.calendarId ?? '');
  const [applicationId, setApplicationId] = useState(task?.applicationId ?? defaults.applicationId ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? 'none');
  const [estimate, setEstimate] = useState(task?.estimatedMinutes?.toString() ?? '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [draft, setDraft] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // for a new task: uploaded once it's saved

  function addSubtask() {
    const text = draft.trim();
    if (!text) return;
    // Subtasks live inside their task (no table of their own), so the browser makes their ids.
    setSubtasks((s) => [...s, { id: crypto.randomUUID(), title: text, done: false }]);
    setDraft('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Give the task a title.');
      return;
    }
    const minutes = Number.parseInt(estimate, 10);
    const fields = {
      title: title.trim(),
      notes: notes.trim() || null,
      dueDate: dueDate || null,
      dueTime: dueDate && dueTime ? dueTime : null, // a time needs a date
      priority,
      calendarId: calendarId || null,
      applicationId: applicationId || null,
      recurrence,
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 1440) : null,
      subtasks,
    };
    const saved = task ? await saveTask(task.id, fields) : await addTask(fields);
    if (saved && !task && pendingFiles.length > 0) {
      const problems = await uploadAndLink(pendingFiles, { ownerType: 'task', ownerId: saved.id });
      if (problems.length > 0) showToast(problems[0]!);
    }
    if (saved) closeDialog('task'); // on failure the banner explains, and the dialog stays so nothing typed is lost
  }

  return (
    <form id="task-form" onSubmit={submit} className="space-y-4">
      <Field label="Title" error={titleError}>
        {(p) => (
          <Input
            {...p}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleError(undefined);
            }}
            maxLength={200}
            data-autofocus
            placeholder="What needs doing?"
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">{(p) => <Input {...p} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        <Field label="Time">{(p) => <Input {...p} type="time" value={dueTime} disabled={!dueDate} onChange={(e) => setDueTime(e.target.value)} />}</Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          {(p) => (
            <Select {...p} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((v) => (
                <option key={v} value={v}>
                  {PRIORITY_LABEL[v]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Calendar">
          {(p) => (
            <Select {...p} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              <option value="">None</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {(applications.length > 0 || applicationId) && (
        <Field label="Application" hint="Follow-ups and prep for an internship you're tracking.">
          {(p) => (
            <Select {...p} value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">None</option>
              {[...applications]
                .filter((a) => isOpen(a.status) || a.id === applicationId)
                .sort((a, b) => a.company.localeCompare(b.company))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company} — {a.role}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeat">
          {(p) => (
            <Select {...p} value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {RECURRENCES.map((v) => (
                <option key={v} value={v}>
                  {RECURRENCE_LABEL[v]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estimate (minutes)">
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={1440} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="60" />}
        </Field>
      </div>

      <Field label="Notes">{(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />}</Field>

      <div>
        <h3 className="mb-1.5 text-label text-ink-muted uppercase">Subtasks</h3>
        <ul>
          {subtasks.map((s) => (
            <li key={s.id} className="group flex min-h-9 items-center gap-1 border-b border-hairline">
              <Checkbox
                checked={s.done}
                onChange={() => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                label={`Mark subtask “${s.title}” as ${s.done ? 'not done' : 'done'}`}
              />
              <span className={cx('min-w-0 flex-1 text-body break-words', s.done && 'text-ink-muted line-through')}>{s.title}</span>
              <IconButton
                icon={X}
                label={`Delete subtask “${s.title}”`}
                onClick={() => setSubtasks((all) => all.filter((x) => x.id !== s.id))}
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
              />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <Input
            aria-label="Add a subtask"
            value={draft}
            maxLength={200}
            placeholder="Add a subtask"
            onChange={(e) => setDraft(e.target.value)}
            // Enter here adds the subtask rather than saving the whole task.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
              }
            }}
          />
          <Button variant="secondary" icon={Plus} onClick={addSubtask} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      </div>

      <div>
        <Label>Files</Label>
        <AttachmentList owner={task ? { ownerType: 'task', ownerId: task.id } : null} editable pending={pendingFiles} onPendingChange={setPendingFiles} />
      </div>
    </form>
  );
}
