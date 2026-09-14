import type { LibraryImageAsset } from "./types";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import type { ImageCompressionStrategy } from "./imageCompression";
import { getSelectedImageCompressionStrategy } from "./imageCompressionPreference";

const VIDEO_MEDIA_TYPES = new Set(["video/mp4", "video/webm"]);
const animatedWebpCache = new Map<string, boolean>();

export const LIBRARY_MEDIA_ACCEPT = "image/*,video/mp4,video/webm,.mp4,.webm";

/** True when an asset is one of the locally supported video formats. */
export function isVideoMediaType(mediaType: string | undefined): boolean {
  return Boolean(mediaType && VIDEO_MEDIA_TYPES.has(mediaType.toLowerCase()));
}

export function isSupportedLibraryMediaType(mediaType: string | undefined): boolean {
  return Boolean(mediaType?.startsWith("image/") || isVideoMediaType(mediaType));
}

export function isVideoAsset(asset: Pick<LibraryImageAsset, "mediaType">): boolean {
  return isVideoMediaType(asset.mediaType);
}

function isAnimatedWebpBytes(bytes: Uint8Array): boolean {
  if (
    bytes.length < 16 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP"
  ) {
    return false;
  }

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4)
      .getUint32(0, true);

    if (type === "ANIM") return true;
    if (type === "VP8X" && offset + 8 < bytes.length && (bytes[offset + 8] & 0x02) !== 0) {
      return true;
    }

    offset += 8 + size + (size % 2);
  }

  return false;
}

function isAnimatedEmbeddedWebp(dataUrl: string): boolean {
  const cached = animatedWebpCache.get(dataUrl);
  if (cached !== undefined) return cached;
  try {
    const encoded = dataUrl.split(",", 2)[1];
    if (!encoded) return false;
    // Animated WebP requires the animation bit in its leading VP8X chunk. Do
    // not decode a potentially multi-megabyte asset merely to inspect it.
    const animated = isAnimatedWebpBytes(
      Uint8Array.from(atob(encoded.slice(0, 64)), (byte) => byte.charCodeAt(0))
    );
    animatedWebpCache.set(dataUrl, animated);
    if (animatedWebpCache.size > 128) {
      animatedWebpCache.delete(animatedWebpCache.keys().next().value as string);
    }
    return animated;
  } catch {
    return false;
  }
}

/** Identifies WebP animation so it receives the same visual affordance as video. */
export function isAnimatedAsset(asset: LibraryImageAsset): boolean {
  return asset.animated === true || (
    asset.mediaType.toLowerCase() === "image/webp" &&
    asset.source.kind === "embedded" &&
    isAnimatedEmbeddedWebp(asset.source.dataUrl)
  );
}

function mediaTypeFromName(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase();

  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  return null;
}

/** Accepts images plus the two explicitly supported local video formats. */
export function getSupportedLibraryMediaType(file: File): string | null {
  if (isSupportedLibraryMediaType(file.type)) return file.type;
  return mediaTypeFromName(file.name);
}

export function isSupportedLibraryMediaFile(file: File): boolean {
  return getSupportedLibraryMediaType(file) !== null;
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Selected file could not be read."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Selected file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function readVideoDimensions(source: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => resolve({
      height: video.videoHeight,
      width: video.videoWidth
    }), { once: true });
    video.addEventListener("error", () => reject(new Error("Selected video could not be decoded.")), { once: true });
    video.src = source;
  });
}

function readImageDimensions(source: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ height: image.naturalHeight || image.height, width: image.naturalWidth || image.width }), { once: true });
    image.addEventListener("error", () => reject(new Error("Selected image could not be decoded.")), { once: true });
    image.src = source;
  });
}

/** Reads uploadable library media and records intrinsic dimensions when available. */
export async function readLibraryMediaFile(
  file: File,
  storeLocalAsset?: ((blob: Blob) => Promise<ImageAssetSource>) | null,
  compressionStrategy: ImageCompressionStrategy = getSelectedImageCompressionStrategy()
): Promise<LibraryImageAsset> {
  const mediaType = getSupportedLibraryMediaType(file);
  if (!mediaType) throw new Error("Only images, MP4, and WebM files are supported.");

  const compressed = await compressionStrategy.compress(file, mediaType, file.name);
  const storedBlob = compressed?.blob ?? file;
  const storedMediaType = compressed?.mediaType ?? mediaType;
  const storedName = compressed?.name ?? file.name;
  const dataUrl = storeLocalAsset ? null : await readDataUrl(storedBlob);
  const dimensionSource = compressed ? null : dataUrl ?? URL.createObjectURL(storedBlob);
  const fileBytes = storedMediaType === "image/webp" && "arrayBuffer" in storedBlob
    ? await storedBlob.arrayBuffer()
    : null;
  const animated = storedMediaType === "image/webp" && fileBytes
    ? isAnimatedWebpBytes(new Uint8Array(fileBytes))
    : storedMediaType === "image/webp" && dataUrl
      ? isAnimatedEmbeddedWebp(dataUrl)
      : false;
  let dimensions: { height: number; width: number };
  if (compressed) {
    dimensions = compressed;
  } else {
    try {
      dimensions = isVideoMediaType(storedMediaType)
        ? await readVideoDimensions(dimensionSource as string)
        : await readImageDimensions(dimensionSource as string);
    } finally {
      if (!dataUrl) URL.revokeObjectURL(dimensionSource as string);
    }
  }
  const source = storeLocalAsset
    ? await storeLocalAsset(storedBlob)
    : { kind: "embedded" as const, dataUrl: dataUrl as string };

  return {
    ...dimensions,
    ...(animated ? { animated: true } : {}),
    mediaType: storedMediaType,
    name: storedName,
    source
  };
}
