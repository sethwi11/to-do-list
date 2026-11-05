import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// .env lives at the repo root (one file for the whole monorepo). It's optional:
// the app needs no API keys or paid services, only (optionally) these two settings.
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

/*
 * Validate environment variables once at startup. Failing fast with a clear
 * message beats a confusing crash later when some code reads `undefined`.
 */
const EnvSchema = z.object({
  // Named API_PORT, not PORT: many tools (hosting platforms, dev runners) set PORT
  // for their own purposes, and the API would silently start on their port.
  API_PORT: z.coerce.number().int().positive().default(3001),
  DB_PATH: z.string().default('data/todo.db'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Resolve relative to /server so it doesn't depend on the current working directory.
  DB_PATH: path.resolve(import.meta.dirname, '..', parsed.data.DB_PATH),
};
