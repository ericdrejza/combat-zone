import {
  type PropsWithChildren,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import {
  createEmptyLibraryState,
  EXPORT_SCHEMA_VERSION,
  IndexedDbWorkspaceRepository,
  recoverInterruptedLocalReset,
  resetLocalPersistence,
  WORKSPACE_SCHEMA_VERSION,
  type EncounterExportEnvelope,
  type EncounterRecord,
  type WorkspaceExportEnvelope,
  type WorkspaceRepository
} from "@core/persistence";
import { resetInteractionState } from "@interaction/interactionState";
import { loadLibraryState } from "@library/librarySlice";
import { commitEncounterChange, loadEncounterState } from "@store/encounterSlice";
import { resetEncounterLog } from "@store/encounterLogSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import {
  LOCAL_PREFERENCES_RESET_EVENT,
  MOTION_OVERRIDE_STORAGE_KEY
} from "@ui/motion_preferences/MotionPreferenceProvider";
import type { SaveStatus } from "@ui/toolbar/EncounterTitleControls";
import { useWorkspaceWriterLock } from "@hooks/useWorkspaceWriterLock";
import {
  PersistenceContext,
  type PersistenceContextValue
} from "./PersistenceContext";

const AUTOSAVE_DELAY_MS = 500;
const PERSISTENCE_CHANNEL_NAME = "combat-zone:persistence";
const defaultRepository = new IndexedDbWorkspaceRepository();

function createEncounterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `encounter-${Date.now()}`;
}

function createDraft(): EncounterState {
  return createEncounterState({
    id: createEncounterId(),
    name: "Untitled Encounter"
  });
}

function announcePersistenceChange(type: "reset" | "saved"): void {
  if (!globalThis.BroadcastChannel) return;
  const channel = new BroadcastChannel(PERSISTENCE_CHANNEL_NAME);
  channel.postMessage({ type });
  channel.close();
}

type PersistenceProviderProps = PropsWithChildren<{
  repository?: WorkspaceRepository;
}>;

export function PersistenceProvider({
  children,
  repository = defaultRepository
}: PersistenceProviderProps) {
  const readOnly = useWorkspaceWriterLock();
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<EncounterRecord | null>(null);
  const activeRecordRef = useRef<EncounterRecord | null>(null);
  const encounterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const suspendedRef = useRef(false);
  const lastEncounterRef = useRef(store.getState().encounter.present);
  const lastLibraryRef = useRef(store.getState().library);

  function updateActiveRecord(record: EncounterRecord | null) {
    activeRecordRef.current = record;
    setActiveRecord(record);
  }

  async function refreshEncounterList() {
    setEncounters(await repository.listEncounters());
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = writeQueueRef.current.then(operation, operation);
    writeQueueRef.current = result.catch(() => undefined);
    return result;
  }

  function requireWritable() {
    if (readOnly) {
      throw new Error("This workspace is read-only because another tab is editing it.");
    }
  }

  async function persistCurrentEncounter(
    folderId?: string | null
  ): Promise<"saved" | "needs-folder"> {
    if (readOnly) return "saved";
    const encounter = store.getState().encounter.present;
    const currentRecord = activeRecordRef.current;
    if (!currentRecord) {
      if (folderId === undefined) {
      await repository.saveRecoveryDraft(encounter);
      setSaveStatus("saved");
      announcePersistenceChange("saved");
      return "needs-folder";
      }
      const created = await repository.createEncounter(encounter, folderId);
      await repository.deleteRecoveryDraft();
      const manifest = await repository.getManifest();
      await repository.saveManifest({
        ...manifest,
        activeEncounterId: created.id,
        revision: manifest.revision + 1,
        updatedAt: Date.now()
      });
      updateActiveRecord(created);
      await refreshEncounterList();
      setSaveStatus("saved");
      announcePersistenceChange("saved");
      return "saved";
    }

    const saved = await repository.saveEncounter(encounter, {
      expectedRevision: currentRecord.revision
    });
    updateActiveRecord(saved);
    await refreshEncounterList();
    setSaveStatus("saved");
    announcePersistenceChange("saved");
    return "saved";
  }

  async function save(folderId?: string | null) {
    if (encounterTimerRef.current) {
      clearTimeout(encounterTimerRef.current);
      encounterTimerRef.current = null;
    }
    setSaveStatus("saving");
    try {
      return await enqueue(() => persistCurrentEncounter(folderId));
    } catch (error) {
      setSaveStatus("error");
      throw error;
    }
  }

  async function flush() {
    if (!initialized || readOnly || suspendedRef.current) return;
    if (encounterTimerRef.current) {
      clearTimeout(encounterTimerRef.current);
      encounterTimerRef.current = null;
      await save();
    }
    if (libraryTimerRef.current) {
      clearTimeout(libraryTimerRef.current);
      libraryTimerRef.current = null;
      await enqueue(async () => {
        await repository.saveLibrary(store.getState().library);
        announcePersistenceChange("saved");
      });
    }
    await writeQueueRef.current;
  }

  function installEncounter(encounter: EncounterState, record: EncounterRecord | null) {
    lastEncounterRef.current = encounter;
    updateActiveRecord(record);
    store.dispatch(loadEncounterState(encounter));
    store.dispatch(resetEncounterLog());
    store.dispatch(resetInteractionState());
  }

  async function createNewEncounter() {
    requireWritable();
    await flush();
    const draft = createDraft();
    await repository.deleteRecoveryDraft();
    await repository.saveRecoveryDraft(draft);
    const manifest = await repository.getManifest();
    await repository.saveManifest({
      ...manifest,
      activeEncounterId: null,
      revision: manifest.revision + 1,
      updatedAt: Date.now()
    });
    suspendedRef.current = false;
    installEncounter(draft, null);
    setSaveStatus("saved");
  }

  async function loadEncounter(id: string) {
    if (readOnly) {
      const record = await repository.getEncounter(id);
      if (!record) throw new Error("The selected encounter no longer exists.");
      installEncounter(record.state, record);
      return;
    }
    await flush();
    const record = await repository.getEncounter(id);
    if (!record) throw new Error("The selected encounter no longer exists.");
    const manifest = await repository.getManifest();
    await repository.saveManifest({
      ...manifest,
      activeEncounterId: id,
      revision: manifest.revision + 1,
      updatedAt: Date.now()
    });
    if (!activeRecordRef.current) {
      await repository.deleteRecoveryDraft();
    }
    suspendedRef.current = false;
    installEncounter(record.state, record);
    setSaveStatus("saved");
  }

  async function deleteEncounter(id: string): Promise<boolean> {
    requireWritable();
    const deletingActive = store.getState().encounter.present.id === id;
    if (deletingActive) {
      if (encounterTimerRef.current) clearTimeout(encounterTimerRef.current);
      encounterTimerRef.current = null;
      suspendedRef.current = true;
    }
    await repository.deleteEncounter(id);
    await refreshEncounterList();
    if (deletingActive) updateActiveRecord(null);
    return deletingActive;
  }

  async function duplicateEncounter(id: string) {
    requireWritable();
    await repository.duplicateEncounter(id);
    await refreshEncounterList();
  }

  async function moveEncounter(id: string, folderId: string | null) {
    requireWritable();
    const record = await repository.moveEncounter(id, folderId);
    if (activeRecordRef.current?.id === id) updateActiveRecord(record);
    await refreshEncounterList();
  }

  async function renameEncounter(id: string, name: string) {
    requireWritable();
    const record = await repository.getEncounter(id);
    const trimmedName = name.trim();
    if (!record || !trimmedName) return;
    if (activeRecordRef.current?.id === id) {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("encounter.rename", {
            name: trimmedName
          }),
          nextEncounter: { ...store.getState().encounter.present, name: trimmedName }
        })
      );
      return;
    }
    await repository.saveEncounter(
      { ...record.state, name: trimmedName },
      { expectedRevision: record.revision }
    );
    await refreshEncounterList();
  }

  async function exportWorkspace() {
    await flush();
    return repository.exportWorkspace();
  }

  async function exportEncounter(id: string) {
    await flush();
    return repository.exportEncounter(id);
  }

  async function importEncounter(
    envelope: EncounterExportEnvelope,
    folderId: string | null
  ) {
    requireWritable();
    await flush();
    const beforeIds = new Set((await repository.listEncounters()).map(({ id }) => id));
    const imported = {
      ...envelope.encounter,
      id: createEncounterId()
    };
    const timestamp = Date.now();
    await repository.importWorkspace(
      {
        kind: "workspace-export",
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: timestamp,
        workspace: {
          manifest: {
            schemaVersion: WORKSPACE_SCHEMA_VERSION,
            activeEncounterId: null,
            revision: 0,
            updatedAt: timestamp
          },
          encounters: [
            {
              id: imported.id,
              state: imported,
              folderId: null,
              revision: 0,
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ],
          recoveryDraft: null,
          library: {
            state: envelope.library,
            revision: 0,
            updatedAt: timestamp
          }
        }
      },
      "merge"
    );
    const mergedLibrary = await repository.getLibrary();
    lastLibraryRef.current = mergedLibrary.state;
    store.dispatch(loadLibraryState(mergedLibrary.state));
    await refreshEncounterList();
    const record = (await repository.listEncounters()).find(
      ({ id }) => !beforeIds.has(id)
    );
    if (!record) throw new Error("The imported encounter could not be created.");
    await repository.moveEncounter(record.id, folderId);
    await loadEncounter(record.id);
  }

  async function reloadFromRepository() {
    const [manifest, draft, library] = await Promise.all([
      repository.getManifest(),
      repository.getRecoveryDraft(),
      repository.getLibrary()
    ]);
    const record = manifest.activeEncounterId
      ? await repository.getEncounter(manifest.activeEncounterId)
      : null;
    const encounter = record?.state ?? draft?.state;
    lastLibraryRef.current = library.state;
    store.dispatch(loadLibraryState(library.state));
    if (encounter) {
      installEncounter(encounter, record);
    } else if (readOnly) {
      installEncounter(createDraft(), null);
    } else {
      await createNewEncounter();
    }
    await refreshEncounterList();
  }

  async function importWorkspace(
    envelope: WorkspaceExportEnvelope,
    mode: "merge" | "overwrite"
  ) {
    requireWritable();
    await flush();
    if (mode === "overwrite") {
      await repository.saveBackup(await repository.exportWorkspace());
    }
    await repository.importWorkspace(envelope, mode);
    await reloadFromRepository();
  }

  async function resetLocalData() {
    if (readOnly) throw new Error("Local data can only be reset from the editing tab.");
    suspendedRef.current = true;
    if (encounterTimerRef.current) clearTimeout(encounterTimerRef.current);
    if (libraryTimerRef.current) clearTimeout(libraryTimerRef.current);
    encounterTimerRef.current = null;
    libraryTimerRef.current = null;
    const draft = createDraft();
    const emptyLibrary = createEmptyLibraryState();
    await resetLocalPersistence(repository, draft, [MOTION_OVERRIDE_STORAGE_KEY]);
    globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
    lastLibraryRef.current = emptyLibrary;
    store.dispatch(loadLibraryState(emptyLibrary));
    suspendedRef.current = false;
    installEncounter(draft, null);
    setEncounters([]);
    setSaveStatus("saved");
    announcePersistenceChange("reset");
  }

  useEffect(() => {
    setPersistenceWritable(!readOnly);
    return () => setPersistenceWritable(true);
  }, [readOnly]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await repository.initialize();
        if (!readOnly) {
          await recoverInterruptedLocalReset(repository, [
            MOTION_OVERRIDE_STORAGE_KEY
          ]);
        }
        if (!cancelled) {
          await reloadFromRepository();
          globalThis.navigator.storage?.persist &&
            void globalThis.navigator.storage.persist();
          if (!cancelled) {
            setInitialized(true);
            setSaveStatus("saved");
          }
        }
      } catch {
        if (!cancelled) {
          setInitialized(true);
          setSaveStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readOnly, repository]);

  useLayoutEffect(() => {
    if (!initialized) return;
    const unsubscribe = store.subscribe(() => {
      if (readOnly || suspendedRef.current) return;
      const state = store.getState();
      if (state.encounter.present !== lastEncounterRef.current) {
        lastEncounterRef.current = state.encounter.present;
        setSaveStatus("saving");
        if (encounterTimerRef.current) clearTimeout(encounterTimerRef.current);
        encounterTimerRef.current = setTimeout(() => {
          encounterTimerRef.current = null;
          void enqueue(() => persistCurrentEncounter()).catch(() =>
            setSaveStatus("error")
          );
        }, AUTOSAVE_DELAY_MS);
      }
      if (state.library !== lastLibraryRef.current) {
        lastLibraryRef.current = state.library;
        if (libraryTimerRef.current) clearTimeout(libraryTimerRef.current);
        libraryTimerRef.current = setTimeout(() => {
          libraryTimerRef.current = null;
          void enqueue(async () => {
            await repository.saveLibrary(store.getState().library);
            announcePersistenceChange("saved");
          }).catch(() => setSaveStatus("error"));
        }, AUTOSAVE_DELAY_MS);
      }
    });
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialized, readOnly, repository]);

  useEffect(() => {
    if (!globalThis.BroadcastChannel) return;
    const channel = new BroadcastChannel(PERSISTENCE_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === "reset" || (readOnly && event.data?.type === "saved")) {
        void reloadFromRepository();
      }
    };
    return () => channel.close();
  }, [readOnly, repository]);

  const value: PersistenceContextValue = {
    activeRecord,
    createNewEncounter,
    deleteEncounter,
    duplicateEncounter,
    encounters,
    exportEncounter,
    exportWorkspace,
    importEncounter,
    importWorkspace,
    initialized,
    loadEncounter,
    moveEncounter,
    readOnly,
    renameEncounter,
    resetLocalData,
    save,
    saveStatus
  };

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-canvas-muted" role="status">
        Loading workspace…
      </div>
    );
  }

  return (
    <PersistenceContext.Provider value={value}>
      {children}
    </PersistenceContext.Provider>
  );
}

export function usePersistence(): PersistenceContextValue {
  return useContext(PersistenceContext);
}
