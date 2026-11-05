import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.originalUrl}` });
};

/*
 * Last-resort error handler. Express 5 forwards errors thrown in async
 * handlers here automatically (Express 4 needed a try/catch in every route).
 * We log the full error on the server but only send a generic message to the
 * client, so internals like SQL and stack traces never leak.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'BadJson', message: 'Request body is not valid JSON' });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.status === 403 ? 'Forbidden' : 'ValidationError', message: err.message });
    return;
  }
  // A foreign-key failure means the request pointed at something that doesn't exist (a calendar, course...).
  if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    res.status(400).json({ error: 'ValidationError', message: 'That refers to something that does not exist (a calendar, course, task...)' });
    return;
  }
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    res.status(409).json({ error: 'Conflict', message: 'That already exists (a name or date must be unique)' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'InternalError', message: 'Something went wrong on the server' });
};
