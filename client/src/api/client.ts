/**
 * Error type for every failed API call. `status` is 0 when the server
 * couldn't be reached at all (it's down, or there's no network).
 */
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

/**
 * Thin fetch wrapper. It converts network failures and non-2xx responses into
 * ApiError, so UI code handles one error type with a readable message.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
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
