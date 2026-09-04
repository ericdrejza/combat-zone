import { createContext, useContext } from "react";
import type { EntitlementResult } from "@combat-zone/firebase-api";
import type { CloudSyncStatus, ReconciliationChoice } from "@core/persistence/cloud";
import type { EncounterExportEnvelope, RecentEncounterAccess, StorageUsageSnapshot, WorkspaceExportEnvelope } from "@core/persistence";
import type { LibraryImageAsset } from "@library/types";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";

export type CloudUser = {
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  uid: string;
};

export type CloudSyncContextValue = {
  backendAvailable: boolean;
  entitlement: EntitlementResult | null;
  driveConfigured: boolean;
  driveConnected: boolean;
  error: Error | null;
  lastSuccessfulSyncAt: number | null;
  reconciliationRequired: boolean;
  recentEncounters: RecentEncounterAccess[];
  status: CloudSyncStatus;
  usage: StorageUsageSnapshot | null;
  user: CloudUser | null;
  reconcile: (choice: ReconciliationChoice, confirmation?: string) => Promise<void>;
  linkDriveImages: () => Promise<LibraryImageAsset[]>;
  connectGoogleDrive: () => Promise<void>;
  prepareEncounterExport: (value: EncounterExportEnvelope) => Promise<EncounterExportEnvelope>;
  prepareWorkspaceExport: (value: WorkspaceExportEnvelope) => Promise<WorkspaceExportEnvelope>;
  resolveImageAsset: (source: ImageAssetSource) => Promise<Blob | string>;
  retry: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function useCloudSync(): CloudSyncContextValue {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error("CloudSyncProvider is missing.");
  return context;
}

export function useOptionalCloudSync(): CloudSyncContextValue | null {
  return useContext(CloudSyncContext);
}
