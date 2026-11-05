import type { CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';
import { apiFetch } from './client';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// Tasks keep their own API object: they have an extra call (reorder) and the server
// does extra work on update (spawning the next occurrence of a recurring task).
export const tasksApi = {
  list: () => apiFetch<Task[]>('/tasks'),
  get: (id: string) => apiFetch<Task>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => apiFetch<Task>('/tasks', json('POST', input)),
  update: (id: string, changes: UpdateTaskInput) => apiFetch<Task>(`/tasks/${id}`, json('PATCH', changes)),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
  restore: (id: string) => apiFetch<Task>(`/tasks/${id}/restore`, { method: 'POST' }),
  reorder: (ids: string[]) => apiFetch<void>('/tasks/reorder', json('POST', { ids })),
};
