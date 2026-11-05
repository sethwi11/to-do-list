import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { ApiError } from '../../api/client';
import { backupApi, type ImportSummary } from '../../api/backup';
import { notificationsSupported } from '../../hooks/useDueNotifications';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/Panel';
import { ThemeToggle } from '../../app/ThemeToggle';

/** "Imported 12 new items and updated 3." */
function describeImport(summary: ImportSummary): string {
  const totals = Object.values(summary).reduce((a, c) => ({ added: a.added + c.added, updated: a.updated + c.updated }), { added: 0, updated: 0 });
  return `Imported ${totals.added} new item${totals.added === 1 ? '' : 's'} and updated ${totals.updated}.`;
}

const row = 'flex items-center justify-between gap-6 border-b border-hairline py-4';

export function SettingsDialog() {
  const { dialog, closeDialog, openDialog, reload } = useApp();
  const { settings, update } = useSettings();
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
      setMessage(`Exported ${data.tasks.length} tasks, ${data.events.length} events, and ${data.calendars.length} calendars.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Export failed.');
    }
  }

  async function handleImport(file: File) {
    try {
      const data: unknown = JSON.parse(await file.text());
      setMessage(describeImport(await backupApi.import(data)));
      void reload();
    } catch (err) {
      setMessage(err instanceof SyntaxError ? "That file isn't valid JSON." : err instanceof ApiError ? `Import failed: ${err.message}` : 'Import failed.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function toggleNotifications(on: boolean) {
    if (!on) return update({ notifications: false });
    const permission = await Notification.requestPermission();
    if (permission === 'granted') update({ notifications: true });
    else setMessage('Notifications are blocked for this site. Allow them in the browser’s site settings.');
  }

  return (
    <Dialog open={dialog?.kind === 'settings'} onClose={() => closeDialog('settings')} title="Settings">
      <div className="-my-4">
        <div className={row}>
          <span className="text-body">Theme</span>
          <ThemeToggle />
        </div>

        <label className={`${row} cursor-pointer`}>
          <span>
            <span className="block text-body">Notify me when a task is due</span>
            <span className="block text-meta text-ink-muted">{notificationsSupported() ? 'Works while the app is open in a tab.' : 'Not supported in this browser.'}</span>
          </span>
          <Checkbox
            checked={settings.notifications}
            onChange={(e) => void toggleNotifications(e.target.checked)}
            label="Notify me when a task is due"
            className={notificationsSupported() ? '' : 'pointer-events-none opacity-50'}
          />
        </label>

        <div className={`${row} flex-wrap`}>
          <span className="text-body">Your data</span>
          <span className="flex gap-2">
            <Button variant="secondary" icon={Download} onClick={() => void handleExport()}>
              Export JSON
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>
              Import JSON
            </Button>
          </span>
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
          <p className="w-full text-meta text-ink-muted">Import merges: it adds and updates, and never deletes anything.</p>
        </div>

        {message && (
          <p role="status" className="border-b border-hairline py-3 text-body text-ink">
            {message}
          </p>
        )}

        <div className="flex gap-2 py-3">
          <Button variant="ghost" onClick={() => openDialog({ kind: 'shortcuts' })}>
            Keyboard shortcuts
          </Button>
          <a href="/styleguide" className="inline-flex h-8 items-center rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
            Style guide
          </a>
        </div>
      </div>
    </Dialog>
  );
}
