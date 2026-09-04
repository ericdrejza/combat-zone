import type {
  CloudCommand,
  CloudCommandResult,
  EncounterPayload,
  LibraryPayload,
  RecoveryDraftPayload,
  ReplaceWorkspacePayload,
  WorkspaceMetadataPayload
} from "@combat-zone/firebase-api";
import type { FirebaseApiClient, CloudRecordObserver } from "./firebaseApiClient";

export type CloudWorkspaceSnapshot = {
  workspace: unknown | null;
  encounters: unknown[];
  library: unknown | null;
  recoveryDraft: unknown | null;
};

export type CloudWorkspaceRepository = {
  readWorkspace(): Promise<CloudWorkspaceSnapshot | null>;
  subscribeWorkspace(observer: CloudRecordObserver, onError: (error: Error) => void): () => void;
  commitWorkspace(command: CloudCommand<WorkspaceMetadataPayload>): Promise<CloudCommandResult>;
  commitEncounter(command: CloudCommand<EncounterPayload>): Promise<CloudCommandResult>;
  deleteEncounter(command: CloudCommand<{ encounterId: string; schemaVersion: number }>): Promise<CloudCommandResult>;
  commitLibrary(command: CloudCommand<LibraryPayload>): Promise<CloudCommandResult>;
  commitRecoveryDraft(command: CloudCommand<RecoveryDraftPayload>): Promise<CloudCommandResult>;
  replaceWorkspace(command: CloudCommand<ReplaceWorkspacePayload>): Promise<CloudCommandResult>;
};

export class FirebaseCloudWorkspaceRepository implements CloudWorkspaceRepository {
  constructor(private readonly api: FirebaseApiClient) {}

  async readWorkspace(): Promise<CloudWorkspaceSnapshot | null> {
    const workspace = await this.api.readWorkspace();
    if (!workspace) return null;
    const [encounters, library, recoveryDraft] = await Promise.all([
      this.api.listEncounters(),
      this.api.readLibrary(),
      this.api.readRecoveryDraft()
    ]);
    return { workspace, encounters, library, recoveryDraft };
  }

  subscribeWorkspace(observer: CloudRecordObserver, onError: (error: Error) => void) {
    return this.api.subscribeWorkspace(observer, onError);
  }

  commitWorkspace(command: CloudCommand<WorkspaceMetadataPayload>) { return this.api.commitWorkspace(command); }
  commitEncounter(command: CloudCommand<EncounterPayload>) { return this.api.commitEncounter(command); }
  deleteEncounter(command: CloudCommand<{ encounterId: string; schemaVersion: number }>) { return this.api.deleteEncounter(command); }
  commitLibrary(command: CloudCommand<LibraryPayload>) { return this.api.commitLibrary(command); }
  commitRecoveryDraft(command: CloudCommand<RecoveryDraftPayload>) { return this.api.commitRecoveryDraft(command); }
  replaceWorkspace(command: CloudCommand<ReplaceWorkspacePayload>) { return this.api.replaceCloudWorkspace(command); }
}
