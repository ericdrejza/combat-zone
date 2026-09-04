import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import type { EntitlementResult } from "@combat-zone/firebase-api";
import type { EncounterExportEnvelope, LocalSyncRepository, StorageUsageSnapshot, WorkspaceExportEnvelope, WorkspaceRepository } from "@core/persistence";
import {
  CloudSyncCoordinator,
  createFirebaseBackend,
  FirebaseApiClient,
  FirebaseCloudAssetRepository,
  FirebaseCloudWorkspaceRepository,
  GoogleDriveAssetRepository,
  prepareEncounterCloudExport,
  prepareWorkspaceCloudExport,
  type CloudSyncStatus,
  type ReconciliationChoice
} from "@core/persistence/cloud";
import { ImageAssetResolverProvider, type ImageAssetResolver } from "@core/assets/ImageAssetResolver";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { CloudSyncContext, type CloudUser } from "./CloudSyncContext";
import { CloudReconciliationDialog } from "./CloudReconciliationDialog";

type CloudSyncProviderProps = PropsWithChildren<{
  localSync: LocalSyncRepository;
  workspaceRepository: WorkspaceRepository;
}>;

function publicUser(user: User): CloudUser {
  return { uid: user.uid, displayName: user.displayName, email: user.email, photoUrl: user.photoURL };
}

export function CloudSyncProvider({ children, localSync, workspaceRepository }: CloudSyncProviderProps) {
  const persistence = usePersistence();
  const backend = useMemo(createFirebaseBackend, []);
  const coordinator = useRef<CloudSyncCoordinator | null>(null);
  const assetRepository = useRef<FirebaseCloudAssetRepository | null>(null);
  const driveRepository = useRef<GoogleDriveAssetRepository | null>(null);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudSyncStatus>(backend ? "signedOut" : "unavailable");
  const [error, setError] = useState<Error | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementResult | null>(null);
  const [usage, setUsage] = useState<StorageUsageSnapshot | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [recentEncounters, setRecentEncounters] = useState<Awaited<ReturnType<LocalSyncRepository["getRecentEncounterAccesses"]>>>([]);

  const updateStatus = useCallback((next: CloudSyncStatus, reason?: Error) => {
    setStatus(next);
    setError(reason ?? null);
    if (next === "synced") setLastSuccessfulSyncAt(Date.now());
  }, []);

  async function connect(authenticatedUser: User): Promise<void> {
    if (!backend) return;
    if (persistence.readOnly) {
      coordinator.current?.stop();
      coordinator.current = null;
      updateStatus("unavailable", new Error("Cloud sync runs in the tab that holds the editing lock."));
      return;
    }
    updateStatus("authenticating");
    const api = new FirebaseApiClient(backend);
    const resolvedEntitlement = await api.getEntitlement();
    setEntitlement(resolvedEntitlement);
    if (!resolvedEntitlement.features.cloudSync) {
      updateStatus("entitlementRequired");
      return;
    }
    const assets = new FirebaseCloudAssetRepository(backend, localSync);
    const drive = new GoogleDriveAssetRepository(() => backend.auth.currentUser?.email ?? null, localSync);
    assetRepository.current = assets;
    driveRepository.current = drive;
    setRecentEncounters(await localSync.getRecentEncounterAccesses());
    setUsage(await assets.getUsage().catch(() => null));
    const next = new CloudSyncCoordinator({
      assets,
      cloud: new FirebaseCloudWorkspaceRepository(api),
      local: workspaceRepository,
      sync: localSync,
      uid: authenticatedUser.uid,
      onStatus: updateStatus,
      exportLocal: persistence.exportWorkspace,
      importLocal: persistence.importWorkspace,
      onRemoteApplied: persistence.reloadFromRepository
    });
    coordinator.current?.stop();
    coordinator.current = next;
    setReconciliationRequired((await next.start()) === "reconciliation_required");
  }

  useEffect(() => {
    if (!backend) return;
    void getRedirectResult(backend.auth).catch((reason) => updateStatus("error", reason as Error));
    return onAuthStateChanged(backend.auth, (nextUser) => {
      setUser(nextUser ? publicUser(nextUser) : null);
      if (!nextUser) {
        coordinator.current?.stop();
        coordinator.current = null;
        setEntitlement(null);
        assetRepository.current = null;
        driveRepository.current?.disconnect();
        driveRepository.current = null;
        setDriveConnected(false);
        setReconciliationRequired(false);
        updateStatus("signedOut");
        return;
      }
      void connect(nextUser).catch((reason) => updateStatus("error", reason as Error));
    });
  }, [backend, persistence.readOnly, updateStatus]);

  useEffect(() => {
    if (!backend || persistence.readOnly) return;
    const timer = window.setInterval(() => void coordinator.current?.drain(), 2_000);
    const recentsTimer = window.setInterval(() => void localSync.getRecentEncounterAccesses().then(setRecentEncounters), 2_000);
    const online = () => void coordinator.current?.drain();
    const offline = () => updateStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(timer);
      clearInterval(recentsTimer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [backend, persistence.readOnly, updateStatus]);

  async function signIn(): Promise<void> {
    if (!backend) return;
    updateStatus("authenticating");
    try {
      await signInWithPopup(backend.auth, backend.googleProvider);
    } catch (reason) {
      const code = (reason as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(backend.auth, backend.googleProvider);
        return;
      }
      updateStatus("error", reason as Error);
    }
  }

  async function signOut(): Promise<void> {
    coordinator.current?.stop();
    coordinator.current = null;
    await localSync.setSyncIdentity(null);
    assetRepository.current = null;
    driveRepository.current?.disconnect();
    driveRepository.current = null;
    setDriveConnected(false);
    if (backend) await firebaseSignOut(backend.auth);
  }

  async function reconcile(choice: ReconciliationChoice, confirmation?: string): Promise<void> {
    if (choice === "keep_device" && confirmation !== "REPLACE CLOUD DATA") {
      throw new Error("Type REPLACE CLOUD DATA to replace cloud data.");
    }
    await coordinator.current?.reconcile(choice);
    setReconciliationRequired(false);
  }

  async function linkDriveImages() {
    if (!user) throw new Error("Sign in with Google before linking Drive images.");
    const drive = driveRepository.current ?? new GoogleDriveAssetRepository(
      () => backend?.auth.currentUser?.email ?? null,
      localSync
    );
    driveRepository.current = drive;
    const images = await drive.pickImages();
    setDriveConnected(drive.connected);
    return images;
  }

  async function connectGoogleDrive() {
    if (!user) throw new Error("Sign in with Google before connecting Drive.");
    const drive = driveRepository.current ?? new GoogleDriveAssetRepository(
      () => backend?.auth.currentUser?.email ?? null,
      localSync
    );
    driveRepository.current = drive;
    try {
      await drive.connect();
      setDriveConnected(true);
    } catch (reason) {
      updateStatus("error", reason as Error);
      throw reason;
    }
  }

  const resolveAsset = useCallback<ImageAssetResolver>(async (source) => {
    if (source.kind === "cloud_storage") {
      const assets = assetRepository.current;
      if (!assets) throw new Error("Sign in to load this cloud image.");
      return assets.download(source.assetId, source.generation);
    }
    if (source.kind === "google_drive") {
      const drive = driveRepository.current;
      if (!drive) throw new Error("Reconnect Google Drive to load this image.");
      return drive.download(source.fileId);
    }
    return source.kind === "embedded" ? source.dataUrl : source.url;
  }, []);

  const value = {
    backendAvailable: Boolean(backend), driveConfigured: driveRepository.current?.configured ?? false,
    driveConnected, entitlement, error, lastSuccessfulSyncAt,
    reconciliationRequired, recentEncounters, status, usage, user, reconcile,
    linkDriveImages,
    connectGoogleDrive,
    prepareEncounterExport: (value: EncounterExportEnvelope) => prepareEncounterCloudExport(value, resolveAsset),
    prepareWorkspaceExport: (value: WorkspaceExportEnvelope) => prepareWorkspaceCloudExport(value, resolveAsset),
    resolveImageAsset: resolveAsset,
    retry: async () => {
      const current = backend?.auth.currentUser;
      if (current) await connect(current);
    },
    signIn,
    signOut
  };

  return (
    <CloudSyncContext.Provider value={value}>
      <ImageAssetResolverProvider resolve={resolveAsset}>
        {children}
        <CloudReconciliationDialog />
      </ImageAssetResolverProvider>
    </CloudSyncContext.Provider>
  );
}
