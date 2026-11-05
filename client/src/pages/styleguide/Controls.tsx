import { useState } from 'react';
import { CalendarPlus, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Kbd, QuickAddInput, SectionLabel, Select, Textarea } from '../../ui/fields';
import { Caption, Section, Stage } from './shared';

export function Controls() {
  const [checked, setChecked] = useState(true);
  const [quick, setQuick] = useState('');
  const [name, setName] = useState('');

  return (
    <Section id="controls" title="Buttons and form controls" intro="Everything is 32px (buttons) or 36px (inputs) tall with 4px corners. The only shadow in the app is on popovers, so none of these have one.">
      <div>
        <Caption>Buttons</Caption>
        <Stage className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Save event</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">More options</Button>
            <Button variant="primary" icon={Plus}>New task</Button>
            <Button variant="secondary" icon={Download}>Export</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled>Save event</Button>
            <Button variant="secondary" disabled>Cancel</Button>
            <Button variant="ghost" disabled>More options</Button>
            <span className="text-meta text-ink-muted">Disabled, with faint ink: the one place it is used.</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <IconButton icon={Pencil} label="Edit" />
            <IconButton icon={CalendarPlus} label="Schedule" />
            <IconButton icon={Trash2} label="Delete" />
            <IconButton icon={Search} label="Search" disabled />
            <span className="ml-2 text-meta text-ink-muted">Icon buttons are 32px and always carry a label for screen readers and the tooltip.</span>
          </div>
        </Stage>
      </div>

      <div>
        <Caption>Inputs</Caption>
        <Stage className="grid gap-5 sm:grid-cols-2">
          <Field label="Title">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Interview with Acme" />}</Field>
          <Field label="Calendar">
            {(p) => (
              <Select {...p} defaultValue="school">
                <option value="school">School</option>
                <option value="acm">ACM</option>
                <option value="personal">Personal</option>
              </Select>
            )}
          </Field>
          <Field label="Link" hint="Zoom, Teams, or Meet. Opens in a new tab.">
            {(p) => <Input {...p} defaultValue="https://zoom.us/j/123456789" />}
          </Field>
          <Field label="Due date" error="Pick a date that isn't in the past.">
            {(p) => <Input {...p} defaultValue="2026-10-01" />}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(p) => <Textarea {...p} placeholder="Supports Markdown: **bold**, - bullets, - [ ] checkboxes" />}
          </Field>
          <Field label="Disabled">{(p) => <Input {...p} disabled defaultValue="Can't change this" />}</Field>
        </Stage>
      </div>

      <div>
        <Caption>Checkbox and quick add</Caption>
        <Stage className="space-y-6">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-1 text-body">
              <Checkbox checked={false} onChange={() => {}} label="Unchecked example" /> Unchecked
            </label>
            <label className="flex items-center gap-1 text-body">
              <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} label="Interactive example" /> Click me
            </label>
            <label className="flex items-center gap-1 text-meta text-ink-muted">
              <Checkbox size="sm" checked={true} onChange={() => {}} label="Small example" /> Small, for calendar blocks
            </label>
          </div>
          <div className="max-w-md">
            <QuickAddInput value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Quick add" />
            <p className="mt-2 text-meta text-ink-muted">A single underlined line. Tab into it to see the focus underline.</p>
          </div>
        </Stage>
      </div>

      <div>
        <Caption>Section labels, shortcuts</Caption>
        <Stage className="max-w-xl space-y-5">
          <SectionLabel count={5}>Today</SectionLabel>
          <SectionLabel count={2}>Overdue</SectionLabel>
          <SectionLabel>Up next</SectionLabel>
          <p className="flex flex-wrap items-center gap-2 text-meta text-ink-muted">
            <Kbd>N</Kbd> new task <Kbd>/</Kbd> search <Kbd>⌘K</Kbd> command palette <Kbd>?</Kbd> all shortcuts
          </p>
        </Stage>
      </div>
    </Section>
  );
}
