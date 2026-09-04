import type { FirebaseApiErrorCode, FirebaseApiErrorDetails } from "@combat-zone/firebase-api";
import { FirebaseError } from "firebase/app";

const RETRYABLE_CODES = new Set(["functions/aborted", "functions/deadline-exceeded", "functions/unavailable"]);

export class FirebaseApiClientError extends Error {
  constructor(
    public readonly code: FirebaseApiErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly details?: FirebaseApiErrorDetails,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "FirebaseApiClientError";
  }
}

/** Converts SDK-specific failures to stable application errors. */
export function normalizeFirebaseApiError(error: unknown): FirebaseApiClientError {
  if (error instanceof FirebaseApiClientError) return error;
  if (error instanceof FirebaseError) {
    const directDetails = (error as FirebaseError & { details?: unknown }).details;
    const details = typeof directDetails === "object"
      ? directDetails as FirebaseApiErrorDetails
      : typeof error.customData?.details === "object"
        ? error.customData.details as FirebaseApiErrorDetails
      : undefined;
    return new FirebaseApiClientError(
      details?.code ?? (RETRYABLE_CODES.has(error.code) ? "UNAVAILABLE" : "INTERNAL"),
      error.message,
      details?.retryable ?? RETRYABLE_CODES.has(error.code),
      details,
      error
    );
  }
  return new FirebaseApiClientError("INTERNAL", "The cloud operation failed.", false, undefined, error);
}

export async function withFirebaseApiRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let delay = 1_000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const normalized = normalizeFirebaseApiError(error);
      if (!normalized.retryable || attempt >= attempts) throw normalized;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * delay));
      delay = Math.min(delay * 2, 60_000);
    }
  }
}
