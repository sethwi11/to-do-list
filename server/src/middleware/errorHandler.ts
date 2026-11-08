import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.originalUrl}` });
};

// Last-resort error handler.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'BadJson', message: 'Request body is not valid JSON' });
    return;
  }
  if (err instanceof HttpError) {
    const names: Record<number, string> = { 403: 'Forbidden', 404: 'NotFound', 413: 'FileTooLarge', 415: 'UnsupportedType' };
    res.status(err.status).json({ error: names[err.status] ?? 'ValidationError', message: err.message });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'FileTooLarge', message: 'That file is larger than 15 MB, the most that can be attached.' });
    return;
  }
  if (err?.name === 'MulterError') {
    res.status(400).json({ error: 'ValidationError', message: 'The upload could not be read' });
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
