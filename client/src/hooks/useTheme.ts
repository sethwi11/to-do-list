import { useEffect } from 'react';
import type { Settings } from './useSettings';

/** Applies the theme by toggling a `dark` class on <html> (Tailwind's dark: variant is configured to follow that class in index.css). */
export function useTheme(theme: Settings['theme']) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    try {
      localStorage.setItem('voice-todo.theme', theme); // read by the inline script in index.html (no flash)
    } catch {
      /* ignore */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
