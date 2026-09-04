export const FIREBASE_API_VERSION = 1 as const;
export const CLOUD_RECORD_SCHEMA_VERSION = 2 as const;
export const SUPPORTED_ENCOUNTER_SCHEMA_VERSION = 6 as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type RecentEncounter = {
  accessedAt: number;
  encounterId: string;
};

export type CloudCommand<T> = {
  apiVersion: typeof FIREBASE_API_VERSION;
  expectedRevision: number | null;
  mutationId: string;
  payload: T;
};

export type CloudCommandResult = {
  mutationId: string;
  revision: number;
  status: "already_applied" | "applied";
  updatedAt: number;
};

export type WorkspaceMetadataPayload = {
  recentEncounters: RecentEncounter[];
  schemaVersion: number;
};

export type EncounterPayload = {
  assetIds: string[];
  encounterId: string;
  folderId: string | null;
  schemaVersion: number;
  state: JsonObject;
};

export type DeleteEncounterPayload = {
  encounterId: string;
  schemaVersion: number;
};

export type LibraryPayload = {
  assetIds: string[];
  schemaVersion: number;
  state: JsonObject;
};

export type RecoveryDraftPayload = {
  assetIds: string[];
  schemaVersion: number;
  state: JsonObject;
} | null;

export type EntitlementResult = {
  apiVersion: typeof FIREBASE_API_VERSION;
  features: { cloudSync: boolean };
  limits: {
    backgroundMaxBytes: number;
    tokenMaxBytes: number;
    totalStorageBytes: number;
  };
  tierId: string;
};

export type CloudAssetType = "background" | "token";

export type ReserveAssetUploadPayload = {
  assetId: string;
  assetType: CloudAssetType;
  expectedBytes: number;
  mediaType: string;
};

export type ReserveAssetUploadResult =
  | {
      status: "ready";
      assetId: string;
      generation: string;
    }
  | {
      status: "pending";
      assetId: string;
    }
  | {
      status: "reserved";
      assetId: string;
      expiresAt: number;
      reservationId: string;
    };

export type CancelAssetUploadPayload = {
  reservationId: string;
};

export type StorageUsageResult = {
  limitBytes: number;
  reservedBytes: number;
  storedBytes: number;
  updatedAt: number;
};

export type ReplaceWorkspacePayload = {
  encounters: EncounterPayload[];
  library: LibraryPayload;
  recoveryDraft: Exclude<RecoveryDraftPayload, null> | null;
  workspace: WorkspaceMetadataPayload;
};

export type FirebaseApiErrorCode =
  | "APP_CHECK_REQUIRED"
  | "ASSET_NOT_READY"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "IDEMPOTENCY_MISMATCH"
  | "INTERNAL"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "REVISION_CONFLICT"
  | "UNAVAILABLE"
  | "UNSUPPORTED_API_VERSION"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "WORKSPACE_TOO_LARGE";

export type FirebaseApiErrorDetails = {
  actualRevision?: number;
  code: FirebaseApiErrorCode;
  correlationId: string;
  expectedRevision?: number;
  retryable: boolean;
};
