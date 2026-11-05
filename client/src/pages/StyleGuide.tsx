import { useToast, ToastHost } from '../ui/Toast';
import { Segmented } from '../ui/Segmented';
import { useSettings, type Settings } from '../hooks/useSettings';
import { CalendarParts } from './styleguide/CalendarParts';
import { Colors } from './styleguide/Colors';
import { Controls } from './styleguide/Controls';
import { Overlays } from './styleguide/Overlays';
import { Pages } from './styleguide/Pages';
import { Tasks } from './styleguide/Tasks';
import { Typography } from './styleguide/Type';

const SECTIONS = [
  ['color', 'Color'],
  ['type', 'Type'],
  ['controls', 'Controls'],
  ['tasks', 'Task rows'],
  ['calendar', 'Calendar'],
  ['overlays', 'Popovers & toasts'],
  ['pages', 'Pages'],
];

/**
 * The style guide: every design token and every component, rendered from the real code.
 * It is the reference the rest of the app is restyled against.
 */
export default function StyleGuide() {
  const { settings, update } = useSettings();
  const { toast, show, dismiss } = useToast();

  return (
    <div className="paper-page">
      <div className="max-w-[960px] px-5 pt-8 pb-32 sm:px-10">
        <header className="mb-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-section italic">Planner</p>
              <h1 className="mt-6 font-display text-page">Style guide</h1>
              <p className="mt-2 max-w-[56ch] text-body text-ink-muted">
                A modern paper planner: warm paper, ink, and one tomato accent. Everything below is the real code, so what you see is what the app will use.
              </p>
            </div>
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(theme: Settings['theme']) => update({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
          <nav aria-label="Sections" className="mt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body">
              {SECTIONS.map(([id, name]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="space-y-14">
          <Colors />
          <Typography />
          <Controls />
          <Tasks />
          <CalendarParts />
          <Overlays onShowToast={() => show('Deleted “Return library books”', () => {})} />
          <Pages />
        </main>
      </div>
      <ToastHost toast={toast} onDismiss={dismiss} />
    </div>
  );
}
