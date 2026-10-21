import type { Category, CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';
import { apiFetch } from './client';

export const tasksApi = {
  list: () => apiFetch<Task[]>('/tasks'),
  create: (input: CreateTaskInput) =>
    apiFetch<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, changes: UpdateTaskInput) =>
    apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/categories'),
};
