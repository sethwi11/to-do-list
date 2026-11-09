import { useApp } from '../../app/AppContext';
import { Kbd } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';

const SHORTCUTS: [string, string][] = [
  ['N', 'Add a task (jumps to the quick-add box)'],
  ['/', 'Search tasks'],
  ['Shift F', 'Full screen on or off'],
  ['Ctrl/⌘ Z', 'Undo the last delete or complete'],
  ['Esc', 'Close a dialog or menu'],
  ['?', 'Show this list'],
];

export function ShortcutsDialog() {
  const { dialog, closeDialog } = useApp();
  return (
    <Dialog open={dialog?.kind === 'shortcuts'} onClose={() => closeDialog('shortcuts')} title="Keyboard shortcuts">
      <dl className="-my-4">
        {SHORTCUTS.map(([key, what]) => (
          <div key={key} className="flex items-center justify-between gap-6 border-b border-hairline py-3 last:border-b-0">
            <dd className="order-1 text-body">{what}</dd>
            <dt className="order-2 shrink-0">
              <Kbd>{key}</Kbd>
            </dt>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-meta text-ink-muted">Single-key shortcuts are ignored while you're typing in a field.</p>
    </Dialog>
  );
}
