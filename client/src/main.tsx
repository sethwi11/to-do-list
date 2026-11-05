import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProvider } from './app/AppProvider';
import { Shell } from './app/Shell';
import { queryClient } from './data/queryClient';
import { SettingsProvider } from './hooks/useSettings';
import NotFoundPage from './pages/NotFoundPage';
import StyleGuide from './pages/StyleGuide';
import TasksPage from './pages/TasksPage';
import TodayPage from './pages/TodayPage';
import './index.css';

// The calendar library is big, so its page loads only when you open it.
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

/*
 * Providers, outside in:
 *  - SettingsProvider: the saved settings, and it applies the theme to <html>. Outermost so
 *    even the style guide follows the chosen theme.
 *  - QueryClientProvider: server data cache.
 *  - BrowserRouter: the address bar drives which page shows.
 *  - AppProvider: tasks and calendars plus the actions on them, the dialogs, and the toast.
 *    It sits inside the router because its dialogs navigate.
 * The style guide lives outside the Shell so it has no sidebar.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/styleguide" element={<StyleGuide />} />
            <Route
              element={
                <AppProvider>
                  <Shell />
                </AppProvider>
              }
            >
              <Route index element={<TodayPage />} />
              <Route
                path="calendar"
                element={
                  <Suspense fallback={<p className="font-display text-title text-ink-muted italic">Loading the calendar…</p>}>
                    <CalendarPage />
                  </Suspense>
                }
              />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </SettingsProvider>
  </StrictMode>,
);
