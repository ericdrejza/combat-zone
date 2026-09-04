import type { FirebaseApiErrorCode, FirebaseApiErrorDetails } from "@combat-zone/firebase-api";
import { HttpsError, type FunctionsErrorCode } from "firebase-functions/v2/https";

const HTTPS_CODES: Record<FirebaseApiErrorCode, FunctionsErrorCode> = {
  APP_CHECK_REQUIRED: "unauthenticated",
  ASSET_NOT_READY: "failed-precondition",
  AUTH_REQUIRED: "unauthenticated",
  FORBIDDEN: "permission-denied",
  IDEMPOTENCY_MISMATCH: "failed-precondition",
  INTERNAL: "internal",
  INVALID_REQUEST: "invalid-argument",
  NOT_FOUND: "not-found",
  QUOTA_EXCEEDED: "resource-exhausted",
  RATE_LIMITED: "resource-exhausted",
  REVISION_CONFLICT: "aborted",
  UNAVAILABLE: "unavailable",
  UNSUPPORTED_API_VERSION: "failed-precondition",
  UNSUPPORTED_SCHEMA_VERSION: "failed-precondition",
  WORKSPACE_TOO_LARGE: "failed-precondition"
};

export class ApiError extends Error {
  constructor(
    public readonly code: FirebaseApiErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly revisions?: { expectedRevision?: number; actualRevision?: number }
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toHttpsError(error: unknown, correlationId: string): HttpsError {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError("INTERNAL", "The cloud operation failed.");
  const details: FirebaseApiErrorDetails = {
    code: apiError.code,
    correlationId,
    retryable: apiError.retryable,
    ...apiError.revisions
  };
  return new HttpsError(HTTPS_CODES[apiError.code], apiError.message, details);
}
