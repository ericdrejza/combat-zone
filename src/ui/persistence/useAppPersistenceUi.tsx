import { useRef, useState } from "react";

import {
  parseExportEnvelope,
  type EncounterExportEnvelope
} from "@core/persistence";
import type { LibraryNode } from "@library/types";
import {
  AssetLibraryModal,
  type AssetLibraryMode
} from "@ui/library/AssetLibraryModal";
import { SettingsModal } from "@ui/settings/SettingsModal";
import type { SaveStatus } from "@ui/toolbar/EncounterTitleControls";
import { DeletedEncounterDialog } from "./DeletedEncounterDialog";
import { downloadExport } from "./downloadExport";
import { ImportTypeMismatchDialog } from "./ImportTypeMismatchDialog";
import { UnsavedDraftDialog } from "./UnsavedDraftDialog";
import { usePersistence } from "./PersistenceProvider";

type AppPersistenceUiOptions = {
  onBackgroundDoubleClick: (node: LibraryNode) => void;
  onTokenDoubleClick: (node: LibraryNode) => void;
};

type AppPersistenceUi = {
  dialogs: React.ReactNode;
  openLibrary: () => void;
  openSettings: () => void;
  readOnly: boolean;
  requestSave: () => Promise<void>;
  saveStatus: SaveStatus;
};

/** Owns persistence-specific dialogs and transition guards outside App's shell. */
export function useAppPersistenceUi({
  onBackgroundDoubleClick,
  onTokenDoubleClick
}: AppPersistenceUiOptions): AppPersistenceUi {
  const persistence = usePersistence();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<AssetLibraryMode>("browse");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [deletedDialogOpen, setDeletedDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] =
    useState<EncounterExportEnvelope | null>(null);
  const [importTypeMismatch, setImportTypeMismatch] = useState<
    "encounter" | "workspace" | null
  >(null);
  const pendingDraftActionRef = useRef<(() => Promise<void>) | null>(null);

  async function requestSave() {
    const result = await persistence.save();
    if (result === "needs-folder") {
      setLibraryMode("save-destination");
      setLibraryOpen(true);
    }
  }

  function requestEncounterTransition(action: () => Promise<void>) {
    if (!persistence.activeRecord && !deletedDialogOpen) {
      pendingDraftActionRef.current = action;
      setDraftDialogOpen(true);
      return;
    }
    void action();
  }

  function runPendingDraftAction() {
    const action = pendingDraftActionRef.current;
    pendingDraftActionRef.current = null;
    if (action) void action();
  }

  function openEncounterImport(envelope: EncounterExportEnvelope) {
    setPendingImport(envelope);
    setSettingsOpen(false);
    setLibraryMode("import-destination");
    setLibraryOpen(true);
  }

  async function importWorkspaceFile(file: File) {
    try {
      const envelope = parseExportEnvelope(JSON.parse(await file.text()));
      if (envelope.kind === "encounter-export") {
        setImportTypeMismatch("workspace");
        return;
      }

      const mode = window
        .prompt("Import full workspace: type MERGE or OVERWRITE")
        ?.trim()
        .toLowerCase();
      if (mode !== "merge" && mode !== "overwrite") return;
      const confirmed = window.confirm(
        mode === "merge"
          ? "Merge every imported encounter and asset into this workspace?"
          : "Overwrite this local workspace? A recovery backup will be created first."
      );
      if (!confirmed) return;
      await persistence.importWorkspace(envelope, mode);
      setSettingsOpen(false);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "The import file is invalid."
      );
    }
  }

  async function importEncounterFile(file: File) {
    try {
      const envelope = parseExportEnvelope(JSON.parse(await file.text()));
      if (envelope.kind === "workspace-export") {
        setImportTypeMismatch("encounter");
        return;
      }
      requestEncounterTransition(async () => openEncounterImport(envelope));
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "The import file is invalid."
      );
    }
  }

  const dialogs = (
    <>
      {libraryOpen ? (
        <AssetLibraryModal
          mode={libraryMode}
          onActiveEncounterDeleted={() => {
            setLibraryOpen(false);
            setDeletedDialogOpen(true);
          }}
          onBackgroundDoubleClick={(node) => {
            onBackgroundDoubleClick(node);
            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
          onCreateEncounter={() => {
            if (libraryMode === "encounter-only") {
              void persistence.createNewEncounter().then(() => setLibraryOpen(false));
              return;
            }
            requestEncounterTransition(async () => {
              await persistence.createNewEncounter();
              setLibraryOpen(false);
            });
          }}
          onImportDestinationSelected={(folderId) => {
            const envelope = pendingImport;
            setPendingImport(null);
            if (envelope) void persistence.importEncounter(envelope, folderId);
          }}
          onImportEncounterFile={(file) => void importEncounterFile(file)}
          onRequestLoadEncounter={(id) => {
            if (libraryMode === "encounter-only") {
              void persistence.loadEncounter(id).then(() => setLibraryOpen(false));
              return;
            }
            requestEncounterTransition(async () => {
              await persistence.loadEncounter(id);
              setLibraryOpen(false);
            });
          }}
          onSaveDestinationComplete={runPendingDraftAction}
          onTokenDoubleClick={(node) => {
            onTokenDoubleClick(node);
            setLibraryOpen(false);
          }}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onExportWorkspace={() => {
            void persistence.exportWorkspace().then((envelope) =>
              downloadExport(envelope, "combat-zone-workspace.json")
            );
          }}
          onImportWorkspaceFile={importWorkspaceFile}
          onResetLocalData={persistence.resetLocalData}
          readOnly={persistence.readOnly}
        />
      ) : null}
      {draftDialogOpen ? (
        <UnsavedDraftDialog
          onCancel={() => {
            pendingDraftActionRef.current = null;
            setDraftDialogOpen(false);
          }}
          onDiscard={() => {
            setDraftDialogOpen(false);
            runPendingDraftAction();
          }}
          onSave={() => {
            setDraftDialogOpen(false);
            setLibraryMode("save-destination");
            setLibraryOpen(true);
          }}
        />
      ) : null}
      {deletedDialogOpen ? (
        <DeletedEncounterDialog
          onCreate={() => {
            setDeletedDialogOpen(false);
            void persistence.createNewEncounter();
          }}
          onLoad={() => {
            setDeletedDialogOpen(false);
            setLibraryMode("encounter-only");
            setLibraryOpen(true);
          }}
        />
      ) : null}
      {importTypeMismatch ? (
        <ImportTypeMismatchDialog
          expected={importTypeMismatch}
          onClose={() => setImportTypeMismatch(null)}
        />
      ) : null}
    </>
  );

  return {
    dialogs,
    openLibrary: () => {
      setLibraryMode("browse");
      setLibraryOpen(true);
    },
    openSettings: () => setSettingsOpen(true),
    readOnly: persistence.readOnly,
    requestSave,
    saveStatus: persistence.saveStatus
  };
}
