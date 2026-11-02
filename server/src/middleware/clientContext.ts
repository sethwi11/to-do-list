import type { Request } from 'express';
import { LocalDateSchema } from '@todo/shared';
import type { RequestContext } from '../repositories/TaskRepository';

/**
 * "Today" is a property of the *user*, not the server: at 11 PM in
 * California it's already tomorrow in UTC. The client sends its local date in
 * an X-Client-Date header on every request. If it's missing or malformed, we
 * fall back to the server's local date (identical when both run on your laptop).
 */
export function requestContext(req: Request): RequestContext {
  const header = LocalDateSchema.safeParse(req.get('X-Client-Date'));
  if (header.success) return { today: header.data };

  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}
