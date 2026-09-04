import { FirebaseError } from "firebase/app";
import {
  FirebaseApiClientError,
  normalizeFirebaseApiError,
  withFirebaseApiRetry
} from "@core/persistence/cloud/firebaseApiError";

describe("Firebase API errors", () => {
  it("preserves structured callable error details", () => {
    const source = new FirebaseError("functions/aborted", "Changed", {
      details: {
        code: "REVISION_CONFLICT",
        correlationId: "correlation-1",
        retryable: false,
        expectedRevision: 2,
        actualRevision: 3
      }
    });

    const error = normalizeFirebaseApiError(source);
    expect(error.code).toBe("REVISION_CONFLICT");
    expect(error.retryable).toBe(false);
    expect(error.details?.actualRevision).toBe(3);
  });

  it("retries transient failures and returns the eventual result", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const operation = vi.fn()
      .mockRejectedValueOnce(new FirebaseApiClientError("UNAVAILABLE", "Retry", true))
      .mockResolvedValue("done");

    await expect(withFirebaseApiRetry(operation, 2)).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent failures", async () => {
    const operation = vi.fn().mockRejectedValue(
      new FirebaseApiClientError("INVALID_REQUEST", "Invalid", false)
    );

    await expect(withFirebaseApiRetry(operation)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(operation).toHaveBeenCalledOnce();
  });
});
