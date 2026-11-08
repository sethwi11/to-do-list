import { useMemo, useState, type FormEvent } from 'react';
import { addDays, BLOCK_LENGTHS, blockMinutes, blockMinutesFor, blockSpan, combine, datePart, formatMinutes, timePart, type Task, type TimeBlock } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { formatDueDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { ConflictNotice } from '../events/ConflictNotice';

/** Set time aside to work on a to-do, or change when an existing block is. */
export function ScheduleDialog() {
  const { dialog, closeDialog, tasks, timeBlocks, removeTimeBlock } = useApp();
  const open = dialog?.kind === 'schedule';
  const task = open ? tasks.find((t) => t.id === dialog.taskId) : undefined;
  const block = open && dialog.blockId ? timeBlocks.find((b) => b.id === dialog.blockId) : undefined;

  return (
    <Dialog
      open={open && !!task}
      onClose={() => closeDialog('schedule')}
      title={block ? 'Edit time block' : 'Set time aside'}
      footer={
        <>
          {block && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                closeDialog('schedule');
                void removeTimeBlock(block);
              }}
            >
              Remove block
            </Button>
          )}
          <Button variant="ghost" onClick={() => closeDialog('schedule')}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="schedule-form">
            {block ? 'Save' : 'Schedule'}
          </Button>
        </>
      }
    >
      {open && task && <ScheduleForm key={block?.id ?? task.id} task={task} block={block} />}
    </Dialog>
  );
}

/** When a new block starts if you haven't said: the to-do's due day (or today, if that has passed) at 9 AM, or the next hour if it's today. */
export function defaultStart(task: Pick<Task, 'dueDate'>, today: string, now: Date): { date: string; time: string } {
  const date = task.dueDate && task.dueDate >= today ? task.dueDate : today;
  if (date !== today) return { date, time: '09:00' };
  const next = now.getHours() + 1;
  if (next >= 22) return { date: addDays(today, 1), time: '09:00' }; // too late tonight
  return { date, time: `${String(next).padStart(2, '0')}:00` };
}

function ScheduleForm({ task, block }: { task: Task; block: TimeBlock | undefined }) {
  const { today, clashesFor, scheduleTask, moveTimeBlock, closeDialog } = useApp();
  const initial = useMemo(() => (block ? { date: datePart(block.start), time: timePart(block.start) } : defaultStart(task, today, new Date())), [block, task, today]);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [minutes, setMinutes] = useState(block ? blockMinutes(block) : blockMinutesFor(task));
  const [error, setError] = useState<string | undefined>();

  const lengths = useMemo(() => [...new Set<number>([...BLOCK_LENGTHS, minutes])].sort((a, b) => a - b), [minutes]);
  const span = date && time ? blockSpan(combine(date, time), minutes) : null;
  const clashes = useMemo(() => (span ? clashesFor({ ...span, allDay: false }, { blocks: block ? new Set([block.id]) : undefined }) : []), [clashesFor, span?.start, span?.end, block]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setError('Choose a day and a start time.');
      return;
    }
    const saved = block ? await moveTimeBlock(block, blockSpan(combine(date, time), minutes)) : await scheduleTask(task, combine(date, time), minutes);
    if (saved) closeDialog('schedule'); // on failure the toast says why, and the dialog stays so nothing is lost
  }

  return (
    <form id="schedule-form" onSubmit={submit} className="space-y-4">
      <p className="text-body">
        <span className="font-medium">{task.title}</span>
        {task.dueDate && <span className="block text-meta text-ink-muted">Due {formatDueDate(task.dueDate, today)}</span>}
      </p>
      <div className="grid grid-cols-[1fr_9rem] gap-3 max-sm:grid-cols-[1fr_8.5rem]">
        <Field label="Day" error={error}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={date}
              data-autofocus
              onChange={(e) => {
                setDate(e.target.value);
                setError(undefined);
              }}
            />
          )}
        </Field>
        <Field label="Starts">
          {(p) => (
            <Input
              {...p}
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setError(undefined);
              }}
            />
          )}
        </Field>
      </div>
      <Field
        label="For how long"
        hint={block ? undefined : task.estimatedMinutes ? `This to-do is estimated at ${formatMinutes(task.estimatedMinutes)}.` : 'Set an estimate on the to-do and new blocks will start at that length.'}
      >
        {(p) => (
          <Select {...p} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {lengths.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <ConflictNotice conflicts={clashes} />
    </form>
  );
}
