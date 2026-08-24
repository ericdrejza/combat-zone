import type { LibraryImageAsset } from "./types";

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp"
};

export function isWebImageSource(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Creates an image asset that retains the remote URL instead of copying its bytes. */
export function createWebImageAsset(value: string): LibraryImageAsset {
  const url = new URL(value.trim());

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter an http or https image URL.");
  }

  const lastPathPart = url.pathname.split("/").filter(Boolean).at(-1);
  const decodedName = lastPathPart
    ? decodeURIComponent(lastPathPart)
    : url.hostname;
  const extension = decodedName.split(".").at(-1)?.toLowerCase() ?? "";

  return {
    dataUrl: url.href,
    mediaType: IMAGE_MEDIA_TYPES[extension] ?? "image/*",
    name: decodedName || "Linked image"
  };
}
