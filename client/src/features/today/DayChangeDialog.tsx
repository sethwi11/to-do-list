import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SkipForward } from 'lucide-react';
import { spanOn, timePart, type PlanItem } from '@todo/shared';
import { useRoutine } from '../../actions/useRoutineActions';
import { useApp } from '../../app/AppContext';
import { fullDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { formatTimeRange } from '../calendar/format';

/** Change a routine block for one day only: skip it, move it, or replace it with a to-do or a new event. The template itself is edited on the Week page. */
export function DayChangeDialog({ item, date, onClose }: { item: PlanItem | null; date: string; onClose: () => void }) {
  const { tasks, openDialog } = useApp();
  const routine = useRoutine();
  const navigate = useNavigate();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [taskId, setTaskId] = useState('');
  const open = tasks.filter((t) => t.status === 'todo');
  const label = item ? `${item.title} today` : '';

  async function act(run: () => Promise<unknown>) {
    if (await run()) onClose();
  }

  return (
    <Dialog open={item !== null} onClose={onClose} title={item ? item.title : ''}>
      {item && (
        <div className="space-y-5" key={item.key}>
          <p className="text-meta text-ink-muted">
            {fullDate(date)} · <span className="font-mono">{formatTimeRange(timePart(item.start), timePart(item.end))}</span>
            {item.makeup && ' · make-up'}
          </p>

          <Button variant="secondary" icon={SkipForward} onClick={() => void act(() => routine.changeDay({ date, routineBlockId: item.sourceId, action: 'skip' }, `Skipped ${label}. It's in Bumped`))}>
            Skip today
          </Button>

          <form
            className="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const from = start || timePart(item.start);
              const to = end || timePart(item.end);
              if (from === to) return;
              void act(() => routine.changeDay({ date, routineBlockId: item.sourceId, action: 'move', ...spanOn(date, from, to) }, `Moved ${label}`));
            }}
          >
            <Field label="Move today: from">{(p) => <Input {...p} type="time" defaultValue={timePart(item.start)} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="Until">{(p) => <Input {...p} type="time" defaultValue={timePart(item.end)} onChange={(e) => setEnd(e.target.value)} />}</Field>
            <Button variant="secondary" type="submit">
              Move
            </Button>
          </form>

          <form
            className="grid grid-cols-[1fr_auto] items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const task = open.find((t) => t.id === taskId);
              if (task) void act(() => routine.replaceWithTask(item, date, task));
            }}
          >
            <Field label="Replace with a to-do">
              {(p) => (
                <Select {...p} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  <option value="">Choose a to-do</option>
                  {open.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button variant="secondary" type="submit" disabled={!taskId}>
              Replace
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Button
              variant="ghost"
              onClick={() =>
                void act(async () => {
                  const o = await routine.changeDay({ date, routineBlockId: item.sourceId, action: 'replace', title: 'a new event' }, `${label} goes to Bumped`);
                  if (o) openDialog({ kind: 'event', mode: 'new', defaults: { start: item.start, end: item.end, calendarId: item.calendarId } });
                  return o;
                })
              }
            >
              Replace with a new event
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/week?block=${item.sourceId}`)}>
              Change it every week
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
