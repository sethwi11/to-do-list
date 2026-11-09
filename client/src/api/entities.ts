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
  CreateRoutineBlockInput,
  CreateWeekTemplateInput,
  RoutineBlock,
  RoutineBlockBatchInput,
  UpdateRoutineBlockInput,
  UpdateWeekTemplateInput,
  WeekTemplate,
  RoutineOverride,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateHoldingInput,
  CreateMoneyMoveInput,
  CreateSavingsGoalInput,
  Expense,
  ExpenseCategory,
  Holding,
  MoneyMove,
  MoneyMoveBatchInput,
  SavingsGoal,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateHoldingInput,
  UpdateSavingsGoalInput,
  CheckIn,
  CreateCheckInInput,
  UpdateCheckInInput,
  CreateRoutineOverrideInput,
  UpdateRoutineOverrideInput,
  Event,
  EventBatchInput,
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
export const eventsApi = {
  ...createCrudApi<Event, CreateEventInput, UpdateEventInput>('/events'),
  /** Write several events and delete others in one all-or-nothing request. */
  batch: (plan: EventBatchInput) => apiFetch<{ put: Event[]; removed: string[] }>('/events/batch', { method: 'POST', body: JSON.stringify(plan) }),
};
export const timeBlocksApi = createCrudApi<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>('/time-blocks');
export const semestersApi = createCrudApi<Semester, CreateSemesterInput, UpdateSemesterInput>('/semesters');
export const coursesApi = createCrudApi<Course, CreateCourseInput, UpdateCourseInput>('/courses');
export const applicationsApi = createCrudApi<Application, CreateApplicationInput, UpdateApplicationInput>('/applications');
export const templatesApi = createCrudApi<Template, CreateTemplateInput, UpdateTemplateInput>('/templates');
export const focusSessionsApi = createCrudApi<FocusSession, CreateFocusSessionInput, never>('/focus-sessions');
export const weeklyReviewsApi = createCrudApi<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>('/weekly-reviews');

export const weekTemplatesApi = createCrudApi<WeekTemplate, CreateWeekTemplateInput, UpdateWeekTemplateInput>('/week-templates');
export const routineBlocksApi = {
  ...createCrudApi<RoutineBlock, CreateRoutineBlockInput, UpdateRoutineBlockInput>('/routine-blocks'),
  batch: (plan: RoutineBlockBatchInput) => apiFetch<{ put: RoutineBlock[]; removed: string[] }>('/routine-blocks/batch', { method: 'POST', body: JSON.stringify(plan) }),
};

export const routineOverridesApi = createCrudApi<RoutineOverride, CreateRoutineOverrideInput, UpdateRoutineOverrideInput>('/routine-overrides');

export const checkInsApi = createCrudApi<CheckIn, CreateCheckInInput, UpdateCheckInInput>('/check-ins');

export const expenseCategoriesApi = createCrudApi<ExpenseCategory, CreateExpenseCategoryInput, UpdateExpenseCategoryInput>('/expense-categories');
export const expensesApi = createCrudApi<Expense, CreateExpenseInput, UpdateExpenseInput>('/expenses');
export const savingsGoalsApi = createCrudApi<SavingsGoal, CreateSavingsGoalInput, UpdateSavingsGoalInput>('/savings-goals');
export const holdingsApi = createCrudApi<Holding, CreateHoldingInput, UpdateHoldingInput>('/holdings');
export const moneyMovesApi = {
  ...createCrudApi<MoneyMove, CreateMoneyMoveInput, never>('/money-moves'),
  /** Write several moves (or remove them again) in one all-or-nothing request. */
  batch: (plan: MoneyMoveBatchInput) => apiFetch<{ put: MoneyMove[]; removed: string[] }>('/money-moves/batch', { method: 'POST', body: JSON.stringify(plan) }),
};

export const settingsApi = {
  get: () => apiFetch<AppSettings>('/settings'),
  update: (changes: UpdateSettingsInput) => apiFetch<AppSettings>('/settings', { method: 'PATCH', body: JSON.stringify(changes) }),
};
