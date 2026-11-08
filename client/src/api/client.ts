import { todayLocalISO } from '../lib/dates';

/** Error type for every failed API call. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thin fetch wrapper. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      // X-Client-Date tells the server what "today" is for *you* (used for recurrences).
      headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-Client-Date': todayLocalISO(), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is it running? (npm run dev)");
  }

  // 502/503/504 come from the Vite proxy when Express isn't running (or is still starting).
  if (res.status >= 502 && res.status <= 504) {
    throw new ApiError(res.status, "Can't reach the API server. Is it running? (npm run dev)");
  }
  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
