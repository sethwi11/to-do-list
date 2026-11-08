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
import ApplicationPage from './pages/ApplicationPage';
import ApplicationsPage from './pages/ApplicationsPage';
import CoursePage from './pages/CoursePage';
import CoursesPage from './pages/CoursesPage';
import NotFoundPage from './pages/NotFoundPage';
import StyleGuide from './pages/StyleGuide';
import TasksPage from './pages/TasksPage';
import TodayPage from './pages/TodayPage';
import './index.css';

// The calendar library is big, so its page loads only when you open it.
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

// Providers, outside in: settings (applies the theme), the server-data cache, the router, then AppProvider (shared data, actions, dialogs, toast).
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
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="applications/:id" element={<ApplicationPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="courses/:id" element={<CoursePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </SettingsProvider>
  </StrictMode>,
);
