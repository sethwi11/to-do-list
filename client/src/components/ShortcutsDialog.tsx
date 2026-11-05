import { Modal } from './Modal';

const SHORTCUTS = [
  ['N', 'New task'],
  ['/', 'Search'],
  ['Ctrl/⌘ + Z', 'Undo the last delete or complete'],
  ['Esc', 'Cancel editing / close dialogs'],
  ['?', 'Show this help'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {SHORTCUTS.map(([key, what]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800">{key}</kbd>
            </dt>
            <dd className="text-slate-600 dark:text-slate-300">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-slate-500">Single-key shortcuts are ignored while you're typing in a field.</p>
    </Modal>
  );
}
