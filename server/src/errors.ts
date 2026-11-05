/**
 * An error with an HTTP status and a message that's safe to show the user.
 * Throw one anywhere (repositories, routes); the error handler turns it into
 * a JSON response instead of a generic 500.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
