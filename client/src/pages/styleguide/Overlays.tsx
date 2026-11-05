import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/fields';
import { Dialog, Panel, PanelTitle } from '../../ui/Panel';
import { EmptyState, SkeletonRows } from '../../ui/states';
import { ToastView } from '../../ui/Toast';
import { Caption, Section, Stage } from './shared';

export function Overlays({ onShowToast }: { onShowToast: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Section id="overlays" title="Popovers, modals, toasts" intro="The one place a shadow is allowed. Surface color, 8px corners, a hairline border, a 22px Fraunces title. They close on Escape and on a click outside, and keep keyboard focus inside while open.">
      <div>
        <Caption>Quick-create popover</Caption>
        <Stage className="bg-transparent">
          <Panel className="w-full max-w-sm p-5">
            <PanelTitle>New event</PanelTitle>
            <div className="mt-4 space-y-4">
              <Field label="Title">{(p) => <Input {...p} defaultValue="Interview with Acme" />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">{(p) => <Input {...p} defaultValue="2:00 PM" />}</Field>
                <Field label="Ends">{(p) => <Input {...p} defaultValue="3:00 PM" />}</Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  {(p) => (
                    <Select {...p} defaultValue="interview">
                      <option value="interview">Interview</option>
                      <option value="meeting">Meeting</option>
                    </Select>
                  )}
                </Field>
                <Field label="Calendar">
                  {(p) => (
                    <Select {...p} defaultValue="applications">
                      <option value="applications">Applications</option>
                      <option value="school">School</option>
                    </Select>
                  )}
                </Field>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost">More options</Button>
              <Button variant="primary">Save</Button>
            </div>
          </Panel>
        </Stage>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <Caption>Modal dialog</Caption>
          <Stage className="space-y-3">
            <p className="text-meta text-ink-muted">A real dialog: Tab stays inside, Escape and a click on the dim area close it.</p>
            <Button variant="secondary" onClick={() => setOpen(true)}>Open the dialog</Button>
          </Stage>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Delete this calendar?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
                <Button variant="primary" onClick={() => setOpen(false)}>Delete</Button>
              </>
            }
          >
            <p className="text-body text-ink-muted">Its 12 tasks and 3 events stay, without a calendar. You can undo this for a few seconds afterwards.</p>
          </Dialog>
        </div>
        <div>
          <Caption>Toast</Caption>
          <Stage className="space-y-4">
            <ToastView message="Deleted “Return library books”" onUndo={() => {}} onDismiss={() => {}} />
            <Button variant="secondary" onClick={onShowToast}>Show a live toast (bottom left)</Button>
          </Stage>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <Caption>Empty state</Caption>
          <Stage>
            <EmptyState message="Nothing scheduled. Enjoy it.">
              <Button variant="ghost">Add a task</Button>
            </EmptyState>
          </Stage>
        </div>
        <div>
          <Caption>Loading</Caption>
          <Stage>
            <SkeletonRows count={4} />
          </Stage>
        </div>
      </div>
    </Section>
  );
}
