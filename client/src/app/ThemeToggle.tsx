import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettings, type Settings } from '../hooks/useSettings';
import { Segmented } from '../ui/Segmented';

export const THEME_OPTIONS: { value: Settings['theme']; label: React.ReactNode; title: string }[] = [
  { value: 'light', label: <Sun className="size-4" aria-hidden />, title: 'Light' },
  { value: 'dark', label: <Moon className="size-4" aria-hidden />, title: 'Dark' },
  { value: 'system', label: <Monitor className="size-4" aria-hidden />, title: 'Match system' },
];

/** Light / Dark / System, defaulting to System. */
export function ThemeToggle({ className }: { className?: string }) {
  const { settings, update } = useSettings();
  return <Segmented label="Theme" value={settings.theme} onChange={(theme) => update({ theme })} options={THEME_OPTIONS} className={className} />;
}
