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
import TasksPage from './pages/TasksPage';
import TodayPage from './pages/TodayPage';
import './index.css';

// Pages other than Today and Tasks load when first opened, so the app starts faster.
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));
const ApplicationPage = lazy(() => import('./pages/ApplicationPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const CoursePage = lazy(() => import('./pages/CoursePage'));
const StyleGuide = lazy(() => import('./pages/StyleGuide'));
const WeekPage = lazy(() => import('./pages/WeekPage'));
const DisplayPage = lazy(() => import('./pages/DisplayPage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
const MoneyPage = lazy(() => import('./pages/MoneyPage'));
const PathPage = lazy(() => import('./pages/PathPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));

// Providers, outside in: settings (applies the theme), the server-data cache, the router, then AppProvider (shared data, actions, dialogs, toast).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/styleguide" element={<Suspense><StyleGuide /></Suspense>} />
            {/* The display view fills the screen on its own, without the sidebar. */}
            <Route path="/display" element={<AppProvider><Suspense><DisplayPage /></Suspense></AppProvider>} />
            <Route
              element={
                <AppProvider>
                  <Shell />
                </AppProvider>
              }
            >
              <Route index element={<TodayPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="week" element={<WeekPage />} />
              <Route path="checkin" element={<CheckInPage />} />
              <Route path="money" element={<MoneyPage />} />
              <Route path="path" element={<PathPage />} />
              <Route path="review" element={<ReviewPage />} />
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
