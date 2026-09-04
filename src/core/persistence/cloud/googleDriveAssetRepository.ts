import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import type { LibraryImageAsset } from "@library/types";
import type { LocalSyncRepository } from "../syncTypes";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email";

type TokenResponse = { access_token?: string; error?: string };
type PickerDocument = { id: string };
type PickerBuilder = {
  addView(value: unknown): PickerBuilder;
  enableFeature(value: string): PickerBuilder;
  setAppId(value: string): PickerBuilder;
  setCallback(value: (data: { action: string; docs?: PickerDocument[] }) => void): PickerBuilder;
  setDeveloperKey(value: string): PickerBuilder;
  setOAuthToken(value: string): PickerBuilder;
  build(): { setVisible(value: boolean): void };
};
type GoogleRuntime = {
  accounts: { oauth2: { initTokenClient(config: {
    client_id: string;
    callback: (response: TokenResponse) => void;
    scope: string;
  }): { requestAccessToken(options?: { prompt?: string }): void } } };
  picker: {
    Action: { PICKED: string };
    DocsView: new () => { setIncludeFolders(value: boolean): unknown; setMimeTypes(value: string): unknown };
    Feature: { MULTISELECT_ENABLED: string };
    PickerBuilder: new () => PickerBuilder;
  };
};

type DriveEnvironment = { apiKey: string; appId: string; clientId: string };

export class GoogleDriveAssetError extends Error {
  constructor(
    message: string,
    readonly code: "account_mismatch" | "authorization" | "deleted" | "download_restricted" | "network"
  ) {
    super(message);
    this.name = "GoogleDriveAssetError";
  }
}

function environment(): DriveEnvironment | null {
  const { VITE_GOOGLE_OAUTH_CLIENT_ID, VITE_GOOGLE_PICKER_API_KEY, VITE_GOOGLE_CLOUD_PROJECT_NUMBER } = import.meta.env;
  return VITE_GOOGLE_OAUTH_CLIENT_ID && VITE_GOOGLE_PICKER_API_KEY && VITE_GOOGLE_CLOUD_PROJECT_NUMBER
    ? { clientId: VITE_GOOGLE_OAUTH_CLIENT_ID, apiKey: VITE_GOOGLE_PICKER_API_KEY, appId: VITE_GOOGLE_CLOUD_PROJECT_NUMBER }
    : null;
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new GoogleDriveAssetError("Google Drive could not be loaded.", "network")), { once: true });
    if (!existing) document.head.append(script);
  });
}

/** Keeps Drive authorization in memory and caches only selected file bytes. */
export class GoogleDriveAssetRepository {
  private accessToken: string | null = null;

  constructor(
    private readonly firebaseEmail: () => string | null,
    private readonly cache: LocalSyncRepository,
    private readonly config = environment()
  ) {}

  get configured(): boolean { return Boolean(this.config); }
  get connected(): boolean { return Boolean(this.accessToken); }

  disconnect(): void { this.accessToken = null; }

  async connect(): Promise<void> { await this.authorize(); }

  async pickImages(): Promise<LibraryImageAsset[]> {
    const runtime = await this.authorize();
    const documents = await this.openPicker(runtime);
    return Promise.all(documents.map(({ id }) => this.metadata(id)));
  }

  async download(fileId: string): Promise<Blob> {
    const cached = await this.cache.getCachedAsset(`drive:${fileId}`);
    if (cached && !this.accessToken) return cached.blob;
    await this.authorize(false);
    let metadata;
    try {
      metadata = await this.readMetadata(fileId);
    } catch (error) {
      if (cached) return cached.blob;
      throw error;
    }
    if (cached && cached.version === metadata.modifiedTime) return cached.blob;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (response.status === 401 || response.status === 403) {
      this.accessToken = null;
      throw new GoogleDriveAssetError("Reconnect Google Drive to access this image.", "authorization");
    }
    if (response.status === 404) throw new GoogleDriveAssetError("This Google Drive image was deleted or is no longer shared.", "deleted");
    if (!response.ok) throw new GoogleDriveAssetError("The Google Drive image could not be downloaded.", "network");
    const blob = await response.blob();
    await this.cache.putCachedAsset({ key: `drive:${fileId}`, blob, byteLength: blob.size, lastAccessedAt: Date.now(), version: metadata.modifiedTime });
    const estimate = await navigator.storage?.estimate?.();
    await this.cache.evictCachedAssets(Math.min(250_000_000, estimate?.quota ? Math.floor(estimate.quota * 0.2) : 250_000_000));
    return blob;
  }

  private async authorize(prompt = true): Promise<GoogleRuntime> {
    if (!this.config) throw new GoogleDriveAssetError("Google Drive is not configured.", "authorization");
    await Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js")
    ]);
    const root = globalThis as typeof globalThis & {
      google?: GoogleRuntime;
      gapi?: { load(name: string, callback: () => void): void };
    };
    if (!root.google || !root.gapi) throw new GoogleDriveAssetError("Google Drive could not be initialized.", "network");
    await new Promise<void>((resolve) => root.gapi!.load("picker", resolve));
    if (!this.accessToken) {
      this.accessToken = await new Promise<string>((resolve, reject) => {
        root.google!.accounts.oauth2.initTokenClient({
          client_id: this.config!.clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => response.access_token
            ? resolve(response.access_token)
            : reject(new GoogleDriveAssetError("Google Drive authorization was not granted.", "authorization"))
        }).requestAccessToken({ prompt: prompt ? "consent" : "" });
      });
      await this.assertMatchingAccount();
    }
    return root.google;
  }

  private async assertMatchingAccount(): Promise<void> {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const identity = await response.json() as { email?: string };
    const expected = this.firebaseEmail();
    if (!response.ok || !identity.email) throw new GoogleDriveAssetError("The Google Drive account could not be verified.", "authorization");
    if (!expected || identity.email.toLowerCase() !== expected.toLowerCase()) {
      this.accessToken = null;
      throw new GoogleDriveAssetError(`Choose the same Google account used to sign in to Combat Zone (${expected ?? "unknown"}).`, "account_mismatch");
    }
  }

  private openPicker(runtime: GoogleRuntime): Promise<PickerDocument[]> {
    return new Promise((resolve) => {
      const view = new runtime.picker.DocsView();
      view.setIncludeFolders(false);
      view.setMimeTypes("image/png,image/jpeg,image/webp,image/gif");
      const picker = new runtime.picker.PickerBuilder()
        .addView(view)
        .enableFeature(runtime.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(this.config!.appId)
        .setDeveloperKey(this.config!.apiKey)
        .setOAuthToken(this.accessToken!)
        .setCallback((data) => {
          if (data.action === runtime.picker.Action.PICKED) resolve(data.docs ?? []);
          else if (data.action !== "loaded") resolve([]);
        })
        .build();
      picker.setVisible(true);
    });
  }

  private async metadata(fileId: string): Promise<LibraryImageAsset> {
    const value = await this.readMetadata(fileId);
    return {
      source: { kind: "google_drive", fileId } satisfies ImageAssetSource,
      name: value.name || "Google Drive image",
      mediaType: value.mimeType,
      width: value.imageMediaMetadata?.width,
      height: value.imageMediaMetadata?.height
    };
  }

  private async readMetadata(fileId: string) {
    const fields = "id,name,mimeType,size,modifiedTime,trashed,capabilities(canDownload),imageMediaMetadata(width,height)";
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (response.status === 404) throw new GoogleDriveAssetError("A selected Google Drive image is unavailable.", "deleted");
    if (!response.ok) throw new GoogleDriveAssetError("Google Drive metadata could not be loaded.", "network");
    const value = await response.json() as {
      capabilities?: { canDownload?: boolean }; imageMediaMetadata?: { height?: number; width?: number };
      mimeType?: string; modifiedTime?: string; name?: string; trashed?: boolean;
    };
    if (value.trashed) throw new GoogleDriveAssetError("A selected Google Drive image was deleted.", "deleted");
    if (value.capabilities?.canDownload === false) throw new GoogleDriveAssetError("A selected Google Drive image cannot be downloaded.", "download_restricted");
    if (!value.mimeType?.startsWith("image/")) throw new GoogleDriveAssetError("Only image files can be linked.", "download_restricted");
    return { ...value, mimeType: value.mimeType };
  }
}
