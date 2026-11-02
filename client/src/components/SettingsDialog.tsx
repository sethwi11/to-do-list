import { useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { backupApi } from '../api/backup';
import { notificationsSupported } from '../hooks/useDueNotifications';
import type { Settings } from '../hooks/useSettings';
import { isTtsSupported } from '../speech/tts';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  /** Called after an import so the app reloads its data. */
  onImported: () => void;
  onShowShortcuts: () => void;
}

export function SettingsDialog({ open, onClose, settings, onChange, onImported, onShowShortcuts }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const data = await backupApi.export();
      // Build the file in the browser and "click" a temporary download link.
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-todo-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${data.tasks.length} tasks and ${data.categories.length} lists.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Export failed.');
    }
  }

  async function handleImport(file: File) {
    try {
      const data: unknown = JSON.parse(await file.text());
      const result = await backupApi.import(data);
      setMessage(`Imported: ${result.tasksAdded} new tasks, ${result.tasksUpdated} updated, ${result.categoriesAdded} new lists.`);
      onImported();
    } catch (err) {
      setMessage(
        err instanceof SyntaxError
          ? "That file isn't valid JSON."
          : err instanceof ApiError
            ? `Import failed: ${err.message}`
            : 'Import failed.',
      );
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function toggleNotifications(on: boolean) {
    if (!on) return onChange({ notifications: false });
    const permission = await Notification.requestPermission();
    if (permission === 'granted') onChange({ notifications: true });
    else setMessage('Notifications are blocked for this site. Allow them in the browser’s site settings.');
  }

  const row = 'flex items-center justify-between gap-4 py-2';

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="flex flex-col divide-y divide-slate-100 text-sm dark:divide-slate-800">
        <div className={row}>
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            value={settings.theme}
            onChange={(e) => onChange({ theme: e.target.value as Settings['theme'] })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <label className={`${row} cursor-pointer`}>
          <span>
            Speak replies aloud
            {!isTtsSupported() && <span className="block text-xs text-slate-500">Not supported in this browser</span>}
          </span>
          <input type="checkbox" checked={settings.tts} onChange={(e) => onChange({ tts: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
        </label>

        <label className={`${row} cursor-pointer`}>
          <span>
            Auto-add confident new tasks
            <span className="block text-xs text-slate-500">Skips review for new tasks at 85%+ confidence. Changes and deletes always need review.</span>
          </span>
          <input type="checkbox" checked={settings.autoAccept} onChange={(e) => onChange({ autoAccept: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
        </label>

        <label className={`${row} cursor-pointer`}>
          <span>
            Notify me when a task is due
            <span className="block text-xs text-slate-500">
              {notificationsSupported() ? 'Works while the app is open in a tab.' : 'Not supported in this browser.'}
            </span>
          </span>
          <input
            type="checkbox"
            disabled={!notificationsSupported()}
            checked={settings.notifications}
            onChange={(e) => void toggleNotifications(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 py-3">
          <span className="mr-auto">Your data</span>
          <button type="button" onClick={() => void handleExport()} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Export JSON
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Import JSON…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <p className="w-full text-xs text-slate-500">Import merges: it adds and updates tasks but never deletes anything.</p>
        </div>

        <p className="py-3 text-xs text-slate-500">
          Privacy: voice is transcribed by your browser. In Chrome, audio is sent to Google for recognition. Transcripts and your open tasks are sent to
          the Anthropic API for extraction.
        </p>

        <div className="py-3">
          <button type="button" onClick={onShowShortcuts} className="text-indigo-600 hover:underline dark:text-indigo-400">
            Keyboard shortcuts (?)
          </button>
        </div>

        {message && (
          <p role="status" className="py-2 text-sm text-slate-600 dark:text-slate-300">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
