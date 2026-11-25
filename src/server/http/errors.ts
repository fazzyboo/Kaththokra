import "server-only";

/*
  Every handled error becomes { "error": { "code", "message", ...details } } (BACKEND_PLAN.md §6).
  `details` carries extra fields some endpoints need, e.g. { attemptsLeft } on WRONG_CODE.
*/

export type ErrorCode =
  | "BAD_REQUEST"
  | "BAD_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_ORIGIN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "WRONG_CODE"
  | "EXPIRED"
  | "LOCKED"
  | "NOT_REGISTERED"
  | "NOT_PAYABLE"
  | "GEMINI_BUSY"
  | "DB_UNAVAILABLE"
  | "INTERNAL"
  // Applink codes pass through as-is (E1308, E1303, …)
  | `E${number}`;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  toBody() {
    return { error: { ...this.details, code: this.code, message: this.message } };
  }
}

export const badRequest = (message = "Bad request", details?: Record<string, unknown>) =>
  new AppError("BAD_REQUEST", message, 400, details);
export const unauthorized = (message = "Sign in required") => new AppError("UNAUTHORIZED", message, 401);
export const forbidden = (message = "Not allowed") => new AppError("FORBIDDEN", message, 403);
export const notFound = (message = "Not found") => new AppError("NOT_FOUND", message, 404);
export const conflict = (message = "Conflict", details?: Record<string, unknown>) =>
  new AppError("CONFLICT", message, 409, details);
/** 429 with `retryAfter` (seconds) in the body; wrap() also sets the Retry-After header. */
export const rateLimited = (retryAfter: number) =>
  new AppError("RATE_LIMITED", "Too many requests, try again later", 429, { retryAfter });
