import { NextResponse } from "next/server";

/**
 * Centralized error taxonomy for the /api/rewrite pipeline.
 *
 * Every error the pipeline can throw maps to exactly one of these, so the
 * route handler can catch a single base type and always return a
 * consistent, safe JSON shape — no stack traces or provider internals ever
 * reach the client.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("RATE_LIMITED", "You're rewriting too quickly. Try again in a moment.", 429);
    this.retryAfterMs = retryAfterMs;
  }
}

export class UpstreamProviderError extends AppError {
  constructor(message = "The writing provider returned an unexpected response.") {
    super("UPSTREAM_PROVIDER_ERROR", message, 502);
  }
}

export class InternalError extends AppError {
  constructor(message = "Something went wrong. Try rewriting again.") {
    super("INTERNAL_ERROR", message, 500);
  }
}

/**
 * Converts any thrown value into a safe JSON response. Unknown/unexpected
 * errors are logged server-side but never expose their details to the
 * client — they collapse to a generic InternalError.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const response = NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
    if (error instanceof RateLimitError) {
      response.headers.set("Retry-After", Math.ceil(error.retryAfterMs / 1000).toString());
    }
    return response;
  }

  console.error("Unhandled /api/rewrite error:", error);
  const fallback = new InternalError();
  return NextResponse.json(
    { error: { code: fallback.code, message: fallback.message } },
    { status: fallback.status }
  );
}
