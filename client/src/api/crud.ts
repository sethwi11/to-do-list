import { apiFetch } from './client';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** The same five calls for every kind of data, mirroring the server's generic router: list, get, create, update, remove (and restore, for things whose deletes can be undone). */
export function createCrudApi<T, C, U>(path: string) {
  return {
    list: () => apiFetch<T[]>(path),
    get: (id: string) => apiFetch<T>(`${path}/${id}`),
    create: (input: C) => apiFetch<T>(path, json('POST', input)),
    update: (id: string, changes: U) => apiFetch<T>(`${path}/${id}`, json('PATCH', changes)),
    remove: (id: string) => apiFetch<void>(`${path}/${id}`, { method: 'DELETE' }),
    restore: (id: string) => apiFetch<T>(`${path}/${id}/restore`, { method: 'POST' }),
  };
}
