import type { EncounterState } from "@core/encounter/types";
import type { WorkspaceRepository } from "./types";

export const LOCAL_RESET_MARKER_KEY = "combat-zone:reset-in-progress";

function removeLocalKeys(keys: readonly string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(key);
    localStorage.removeItem(LOCAL_RESET_MARKER_KEY);
  } catch {
    // IndexedDB remains authoritative when localStorage is restricted.
  }
}

/** Finishes the reset atomically enough to recover from a tab closing mid-flow. */
export async function recoverInterruptedLocalReset(
  repository: WorkspaceRepository,
  preferenceKeys: readonly string[]
): Promise<boolean> {
  let interrupted = false;
  try {
    interrupted = localStorage.getItem(LOCAL_RESET_MARKER_KEY) === "true";
  } catch {
    return false;
  }
  if (!interrupted) return false;

  await repository.clearLocalData();
  await repository.initialize();
  removeLocalKeys(preferenceKeys);
  return true;
}

/** Clears only application-owned records, then creates the clean recovery draft. */
export async function resetLocalPersistence(
  repository: WorkspaceRepository,
  draft: EncounterState,
  preferenceKeys: readonly string[]
): Promise<void> {
  try {
    localStorage.setItem(LOCAL_RESET_MARKER_KEY, "true");
  } catch {
    // The IndexedDB clearing transaction itself remains atomic.
  }

  await repository.clearLocalData();
  await repository.initialize();
  await repository.saveRecoveryDraft(draft);
  removeLocalKeys(preferenceKeys);
}
