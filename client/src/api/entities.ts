import type {
  Application,
  AppSettings,
  Calendar,
  Course,
  CreateApplicationInput,
  CreateCalendarInput,
  CreateCourseInput,
  CreateEventInput,
  CreateEventTypeInput,
  CreateFocusSessionInput,
  CreateSemesterInput,
  CreateTemplateInput,
  CreateTimeBlockInput,
  CreateWeeklyReviewInput,
  Event,
  EventType,
  FocusSession,
  Semester,
  Template,
  TimeBlock,
  UpdateApplicationInput,
  UpdateCalendarInput,
  UpdateCourseInput,
  UpdateEventInput,
  UpdateEventTypeInput,
  UpdateSemesterInput,
  UpdateSettingsInput,
  UpdateTemplateInput,
  UpdateTimeBlockInput,
  UpdateWeeklyReviewInput,
  WeeklyReview,
} from '@todo/shared';
import { apiFetch } from './client';
import { createCrudApi } from './crud';

// One line per kind of data. Screens added in later phases use these.
export const calendarsApi = createCrudApi<Calendar, CreateCalendarInput, UpdateCalendarInput>('/calendars');
export const eventTypesApi = createCrudApi<EventType, CreateEventTypeInput, UpdateEventTypeInput>('/event-types');
export const eventsApi = createCrudApi<Event, CreateEventInput, UpdateEventInput>('/events');
export const timeBlocksApi = createCrudApi<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>('/time-blocks');
export const semestersApi = createCrudApi<Semester, CreateSemesterInput, UpdateSemesterInput>('/semesters');
export const coursesApi = createCrudApi<Course, CreateCourseInput, UpdateCourseInput>('/courses');
export const applicationsApi = createCrudApi<Application, CreateApplicationInput, UpdateApplicationInput>('/applications');
export const templatesApi = createCrudApi<Template, CreateTemplateInput, UpdateTemplateInput>('/templates');
export const focusSessionsApi = createCrudApi<FocusSession, CreateFocusSessionInput, never>('/focus-sessions');
export const weeklyReviewsApi = createCrudApi<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>('/weekly-reviews');

export const settingsApi = {
  get: () => apiFetch<AppSettings>('/settings'),
  update: (changes: UpdateSettingsInput) => apiFetch<AppSettings>('/settings', { method: 'PATCH', body: JSON.stringify(changes) }),
};
