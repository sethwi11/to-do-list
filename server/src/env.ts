import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// .env lives at the repo root (one file for the whole monorepo).
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

// Validate environment variables once at startup.
const EnvSchema = z.object({
  // Named API_PORT, not PORT: many tools (hosting platforms, dev runners) set PORT for their own purposes, and the API would silently start on their port.
  API_PORT: z.coerce.number().int().positive().default(3001),
  DB_PATH: z.string().default('data/todo.db'),
  // Where uploaded files are kept.
  UPLOADS_DIR: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const dbPath = path.resolve(import.meta.dirname, '..', parsed.data.DB_PATH);

export const env = {
  ...parsed.data,
  // Resolve relative to /server so it doesn't depend on the current working directory.
  DB_PATH: dbPath,
  UPLOADS_DIR: parsed.data.UPLOADS_DIR ? path.resolve(import.meta.dirname, '..', parsed.data.UPLOADS_DIR) : path.join(path.dirname(dbPath), 'uploads'),
};
