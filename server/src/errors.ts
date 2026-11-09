/** An error with an HTTP status and a stable code the app can act on; the message is safe to show to the player. */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
