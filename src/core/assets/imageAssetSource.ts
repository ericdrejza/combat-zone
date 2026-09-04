export type ImageAssetSource =
  | { kind: "embedded"; dataUrl: string }
  | { kind: "url"; url: string }
  | { kind: "google_drive"; fileId: string }
  | { kind: "cloud_storage"; assetId: string; generation: string };

export function isHttpImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Converts the pre-v6 string representation without fetching or rewriting bytes. */
export function migrateLegacyImageSource(value: string): ImageAssetSource {
  return isHttpImageUrl(value)
    ? { kind: "url", url: value }
    : { kind: "embedded", dataUrl: value };
}

export function directImageSourceUrl(source: ImageAssetSource): string | null {
  if (source.kind === "embedded") return source.dataUrl;
  if (source.kind === "url") return source.url;
  return null;
}

export function isImageAssetSource(value: unknown): value is ImageAssetSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (source.kind === "embedded") {
    return typeof source.dataUrl === "string" && source.dataUrl.startsWith("data:");
  }
  if (source.kind === "url") {
    return typeof source.url === "string" && isHttpImageUrl(source.url);
  }
  if (source.kind === "google_drive") {
    return typeof source.fileId === "string" && source.fileId.length > 0;
  }
  return source.kind === "cloud_storage" &&
    typeof source.assetId === "string" && /^[a-f0-9]{64}$/.test(source.assetId) &&
    typeof source.generation === "string" && source.generation.length > 0;
}
