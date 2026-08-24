import type { Middleware, UnknownAction } from "@reduxjs/toolkit";

let persistenceWritable = true;

export function setPersistenceWritable(writable: boolean): void {
  persistenceWritable = writable;
}

export function isPersistenceWritable(): boolean {
  return persistenceWritable;
}

function isProtectedMutation(action: UnknownAction): boolean {
  if (
    action.type === "encounter/commitEncounterChange" ||
    action.type === "encounter/undoEncounterChange" ||
    action.type === "encounter/redoEncounterChange"
  ) {
    return true;
  }

  return (
    action.type.startsWith("library/") &&
    action.type !== "library/loadLibraryState" &&
    action.type !== "library/resetLibraryState"
  );
}

/** Enforces the writer-tab boundary even when a UI control forgets to disable itself. */
export const persistenceWriteGuardMiddleware: Middleware =
  () => (next) => (action) => {
    if (
      !persistenceWritable &&
      typeof action === "object" &&
      action !== null &&
      "type" in action &&
      isProtectedMutation(action as UnknownAction)
    ) {
      return action;
    }

    return next(action);
  };
