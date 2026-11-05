import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { SectionLabel } from '../../ui/fields';
import { TaskRow } from '../../ui/TaskRow';
import { Caption, Section, Stage } from './shared';

const noop = () => {};

interface DemoTask {
  id: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
}
const DEMO: DemoTask[] = [
  { id: 1, title: 'Finish the data structures problem set', priority: 'high' },
  { id: 2, title: 'Email Valencia about the group project', priority: 'medium' },
  { id: 3, title: 'Return library books', priority: 'low' },
];

/** The completion sequence, live: check a row to see the strike draw, then the row fade and collapse. */
function CompletionDemo() {
  const [round, setRound] = useState(0);
  const [removed, setRemoved] = useState<number[]>([]);
  const left = DEMO.filter((t) => !removed.includes(t.id));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-meta text-ink-muted">Check a task. Uncheck it within 0.4s to cancel.</p>
        <Button variant="ghost" icon={RotateCcw} onClick={() => { setRemoved([]); setRound((r) => r + 1); }}>
          Replay
        </Button>
      </div>
      <ul key={round} className="border-t border-hairline">
        {left.map((t) => (
          <TaskRow
            key={t.id}
            title={t.title}
            done={false}
            priority={t.priority}
            dueLabel="Today"
            dueTone="today"
            leaveOnComplete
            onToggle={() => setRemoved((r) => [...r, t.id])}
          />
        ))}
      </ul>
      {left.length === 0 && <p className="py-4 font-display text-title text-ink-muted italic">All done. Press Replay.</p>}
    </div>
  );
}

export function Tasks() {
  return (
    <Section
      id="tasks"
      title="Task rows"
      intro="Rows separated by hairlines, not cards. Priority is the bar on the left edge: full height for high, half height for medium, none for low. Hover or tab to a row to reveal its actions."
    >
      <div>
        <Caption>Variants</Caption>
        <Stage className="max-w-[960px]">
          <SectionLabel count={2} className="mb-1">Overdue</SectionLabel>
          <ul className="mb-6">
            <TaskRow title="Pay rent" done={false} priority="high" dueLabel="Mon, Nov 2" dueTone="overdue" calendar={{ name: 'Personal', color: 'plum' }} onToggle={noop} />
            <TaskRow title="Choose interns for the spring cycle" done={false} priority="medium" dueLabel="Tue, Nov 3" dueTone="overdue" calendar={{ name: 'ACM', color: 'sage' }} subtasks={{ done: 1, total: 3 }} onToggle={noop} />
          </ul>
          <SectionLabel count={3} className="mb-1">Today</SectionLabel>
          <ul className="mb-6">
            <TaskRow
              title="Finish the COMP 365 lab write-up"
              done={false}
              priority="high"
              dueLabel="Today"
              dueTone="today"
              calendar={{ name: 'School', color: 'dusty-blue' }}
              subtasks={{ done: 2, total: 4 }}
              focusMinutes={75}
              onToggle={noop}
              onOpen={noop}
              onEdit={noop}
              onSchedule={noop}
              onTimer={noop}
            />
            <TaskRow title="Email the recruiter" done={false} priority="medium" dueLabel="Today" dueTone="today" calendar={{ name: 'Applications', color: 'tomato' }} onToggle={noop} onEdit={noop} onSchedule={noop} onTimer={noop} />
            <TaskRow title="Put the budget spreadsheet in the shared folder for the chapter meeting next Monday" done={false} priority="low" calendar={{ name: 'Kappa Alpha Psi', color: 'crimson' }} onToggle={noop} />
          </ul>
          <SectionLabel className="mb-1">Done</SectionLabel>
          <ul>
            <TaskRow title="Read chapter 4" done priority="medium" dueLabel="Yesterday" calendar={{ name: 'School', color: 'dusty-blue' }} onToggle={noop} />
          </ul>
        </Stage>
      </div>
      <div>
        <Caption>Completing a task</Caption>
        <Stage className="max-w-[960px]">
          <CompletionDemo />
        </Stage>
      </div>
    </Section>
  );
}
