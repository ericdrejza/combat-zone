import { createContext } from "react";

import type {
  EncounterExportEnvelope,
  EncounterRecord,
  WorkspaceExportEnvelope
} from "@core/persistence";
import type { SaveStatus } from "@ui/toolbar/EncounterTitleControls";

export type PersistenceContextValue = {
  activeRecord: EncounterRecord | null;
  createNewEncounter: () => Promise<void>;
  deleteEncounter: (id: string) => Promise<boolean>;
  duplicateEncounter: (id: string) => Promise<void>;
  encounters: EncounterRecord[];
  exportEncounter: (id: string) => Promise<EncounterExportEnvelope>;
  exportWorkspace: () => Promise<WorkspaceExportEnvelope>;
  importEncounter: (
    envelope: EncounterExportEnvelope,
    folderId: string | null
  ) => Promise<void>;
  importWorkspace: (
    envelope: WorkspaceExportEnvelope,
    mode: "merge" | "overwrite"
  ) => Promise<void>;
  initialized: boolean;
  loadEncounter: (id: string) => Promise<void>;
  moveEncounter: (id: string, folderId: string | null) => Promise<void>;
  readOnly: boolean;
  renameEncounter: (id: string, name: string) => Promise<void>;
  resetLocalData: () => Promise<void>;
  save: (folderId?: string | null) => Promise<"saved" | "needs-folder">;
  saveStatus: SaveStatus;
};

const uninitializedExport = async (): Promise<never> => {
  throw new Error("Persistence is not initialized.");
};

export const PersistenceContext = createContext<PersistenceContextValue>({
  activeRecord: null,
  createNewEncounter: async () => undefined,
  deleteEncounter: async () => false,
  duplicateEncounter: async () => undefined,
  encounters: [],
  exportEncounter: uninitializedExport,
  exportWorkspace: uninitializedExport,
  importEncounter: async () => undefined,
  importWorkspace: async () => undefined,
  initialized: true,
  loadEncounter: async () => undefined,
  moveEncounter: async () => undefined,
  readOnly: false,
  renameEncounter: async () => undefined,
  resetLocalData: async () => undefined,
  save: async () => "needs-folder",
  saveStatus: "idle"
});
