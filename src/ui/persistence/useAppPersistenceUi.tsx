import { useRef, useState } from "react";

import {
  parseExportEnvelope,
  type EncounterExportEnvelope
} from "@core/persistence";
import type { LibraryNode } from "@library/types";
import type { LibrarySectionId } from "@library/types";
import type { LibraryFolderBySection } from "@ui/library/useAssetLibraryModalState";
import type { LibraryViewModeBySection } from "@ui/library/useAssetLibraryModalState";
import {
  AssetLibraryModal,
  type AssetLibraryMode
} from "@ui/library/AssetLibraryModal";
import { SettingsModal } from "@ui/settings/SettingsModal";
import type { SaveStatus } from "@ui/toolbar/EncounterTitleControls";
import { useOptionalCloudSync } from "@ui/cloud_sync";
import { DeletedEncounterDialog } from "./DeletedEncounterDialog";
import { downloadExport } from "./downloadExport";
import { ImportTypeMismatchDialog } from "./ImportTypeMismatchDialog";
import { UnsavedDraftDialog } from "./UnsavedDraftDialog";
import { usePersistence } from "./PersistenceProvider";

type AppPersistenceUiOptions = {
  onActorTokenSelect: (actorId: string, node: LibraryNode) => void;
  onBackgroundDoubleClick: (node: LibraryNode) => void;
  onTokenDoubleClick: (node: LibraryNode) => void;
};

type AppPersistenceUi = {
  dialogs: React.ReactNode;
  hasSavedEncounter: boolean;
  openLibrary: (target?: LibraryOpenTarget) => void;
  openTokenLibraryForActor: (actorId: string) => void;
  openSettings: () => void;
  readOnly: boolean;
  requestSave: () => Promise<void>;
  saveStatus: SaveStatus;
};

type LibraryLocation = {
  folderId: string;
  sectionId: LibrarySectionId;
};

type LibraryOpenTarget = LibraryLocation | LibrarySectionId;

/** Owns persistence-specific dialogs and transition guards outside App's shell. */
export function useAppPersistenceUi({
  onActorTokenSelect,
  onBackgroundDoubleClick,
  onTokenDoubleClick
}: AppPersistenceUiOptions): AppPersistenceUi {
  const persistence = usePersistence();
  const cloud = useOptionalCloudSync();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySectionId, setLibrarySectionId] =
    useState<LibrarySectionId>("encounters");
  const [currentFolderBySection, setCurrentFolderBySection] =
    useState<LibraryFolderBySection>({});
  const [viewModeBySection, setViewModeBySection] =
    useState<LibraryViewModeBySection>({});
  const [libraryMode, setLibraryMode] = useState<AssetLibraryMode>("browse");
  const [tokenActorId, setTokenActorId] = useState<string | null>(null);
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
          currentFolderBySection={currentFolderBySection}
          initialSectionId={librarySectionId}
          viewModeBySection={viewModeBySection}
          mode={libraryMode}
          onActiveEncounterDeleted={() => {
            setLibraryOpen(false);
            setDeletedDialogOpen(true);
          }}
          onBackgroundDoubleClick={(node) => {
            onBackgroundDoubleClick(node);
            setLibraryOpen(false);
          }}
          onClose={() => {
            setLibraryOpen(false);
            setTokenActorId(null);
          }}
          onCurrentFolderChange={(sectionId, folderId) => {
            setCurrentFolderBySection((current) => ({
              ...current,
              [sectionId]: folderId
            }));
          }}
          onViewModeChange={(sectionId, viewMode) => {
            setViewModeBySection((current) => ({
              ...current,
              [sectionId]: viewMode
            }));
          }}
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
            if (tokenActorId) {
              onActorTokenSelect(tokenActorId, node);
              setTokenActorId(null);
            } else {
              onTokenDoubleClick(node);
            }
            setLibraryOpen(false);
          }}
          tokenSubmitLabel={tokenActorId ? "Set Actor Image" : "Create Actor"}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onExportWorkspace={() => {
            void persistence.exportWorkspace().then((envelope) =>
              cloud ? cloud.prepareWorkspaceExport(envelope) : envelope
            ).then((envelope) =>
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
    hasSavedEncounter: Boolean(persistence.activeRecord),
    openLibrary: (target) => {
      setTokenActorId(null);
      const location =
        typeof target === "object" && target !== null ? target : undefined;
      const sectionId =
        typeof target === "string" ? target : location?.sectionId ?? "encounters";

      setLibrarySectionId(sectionId);
      if (location) {
        setCurrentFolderBySection((current) => ({
          ...current,
          [location.sectionId]: location.folderId
        }));
      }
      setLibraryMode("browse");
      setLibraryOpen(true);
    },
    openTokenLibraryForActor: (actorId) => {
      setTokenActorId(actorId);
      setLibrarySectionId("tokens");
      setLibraryMode("browse");
      setLibraryOpen(true);
    },
    openSettings: () => setSettingsOpen(true),
    readOnly: persistence.readOnly,
    requestSave,
    saveStatus: persistence.saveStatus
  };
}
