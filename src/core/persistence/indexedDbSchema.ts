import {
  migrateEncounterState,
  migrateExportEnvelope,
  migrateLibraryState
} from "./envelope";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

export const STORE_MANIFEST = "manifest";
export const STORE_ENCOUNTERS = "encounters";
export const STORE_RECOVERY = "recovery";
export const STORE_LIBRARY = "library";
export const STORE_BACKUPS = "backups";
export const STORE_SYNC_STATE = "sync_state";
export const STORE_SYNC_OUTBOX = "sync_outbox";
export const STORE_ASSET_CACHE = "asset_cache";
export const MANIFEST_KEY = "workspace";
export const RECOVERY_KEY = "draft";
export const LIBRARY_KEY = "library";
export const LATEST_BACKUP_KEY = "latest";

export function idbRequest<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("IndexedDB request failed."));
  });
}

export function idbTransactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function migrateCursor(
  store: IDBObjectStore,
  migrate: (value: unknown) => unknown
): void {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.update(migrate(cursor.value));
    cursor.continue();
  };
}

/** Opens and upgrades all application-owned stores in one atomic IDB transaction. */
export function openWorkspaceDatabase(name: string, version: number): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
  }
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(name, version);
    opening.onupgradeneeded = (event) => {
      const database = opening.result;
      const transaction = opening.transaction!;
      if (!database.objectStoreNames.contains(STORE_MANIFEST)) database.createObjectStore(STORE_MANIFEST);
      if (!database.objectStoreNames.contains(STORE_ENCOUNTERS)) database.createObjectStore(STORE_ENCOUNTERS, { keyPath: "id" });
      if (!database.objectStoreNames.contains(STORE_RECOVERY)) database.createObjectStore(STORE_RECOVERY);
      if (!database.objectStoreNames.contains(STORE_LIBRARY)) database.createObjectStore(STORE_LIBRARY);
      if (!database.objectStoreNames.contains(STORE_BACKUPS)) database.createObjectStore(STORE_BACKUPS);
      if (!database.objectStoreNames.contains(STORE_SYNC_STATE)) database.createObjectStore(STORE_SYNC_STATE);
      if (!database.objectStoreNames.contains(STORE_SYNC_OUTBOX)) database.createObjectStore(STORE_SYNC_OUTBOX, { keyPath: "key" });
      if (!database.objectStoreNames.contains(STORE_ASSET_CACHE)) database.createObjectStore(STORE_ASSET_CACHE, { keyPath: "key" });

      if ((event.oldVersion ?? 0) > 0 && (event.oldVersion ?? 0) < 3) {
        migrateCursor(transaction.objectStore(STORE_MANIFEST), (value) => ({
          ...(value as object),
          schemaVersion: WORKSPACE_SCHEMA_VERSION
        }));
        migrateCursor(transaction.objectStore(STORE_LIBRARY), (value) => {
          const record = value as Record<string, unknown>;
          return { ...record, state: migrateLibraryState(record.state) };
        });
      }
      if ((event.oldVersion ?? 0) > 0 && (event.oldVersion ?? 0) < 4) {
        migrateCursor(transaction.objectStore(STORE_ENCOUNTERS), (value) => {
          const record = value as Record<string, unknown>;
          return { ...record, state: migrateEncounterState(record.state) };
        });
        migrateCursor(transaction.objectStore(STORE_RECOVERY), (value) => {
          const record = value as Record<string, unknown>;
          return { ...record, state: migrateEncounterState(record.state) };
        });
        migrateCursor(transaction.objectStore(STORE_BACKUPS), migrateExportEnvelope);
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("Could not open IndexedDB."));
  });
}
