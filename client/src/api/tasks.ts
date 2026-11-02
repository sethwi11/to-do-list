import type {
  Category,
  CreateCategoryInput,
  CreateTaskInput,
  Task,
  UpdateCategoryInput,
  UpdateTaskInput,
} from '@todo/shared';
import { apiFetch } from './client';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const tasksApi = {
  list: () => apiFetch<Task[]>('/tasks'),
  get: (id: string) => apiFetch<Task>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => apiFetch<Task>('/tasks', json('POST', input)),
  update: (id: string, changes: UpdateTaskInput) => apiFetch<Task>(`/tasks/${id}`, json('PATCH', changes)),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
  restore: (id: string) => apiFetch<Task>(`/tasks/${id}/restore`, { method: 'POST' }),
  reorder: (ids: string[]) => apiFetch<void>('/tasks/reorder', json('POST', { ids })),
};

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/categories'),
  create: (input: CreateCategoryInput) => apiFetch<Category>('/categories', json('POST', input)),
  update: (id: string, changes: UpdateCategoryInput) =>
    apiFetch<Category>(`/categories/${id}`, json('PATCH', changes)),
  remove: (id: string) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
};
