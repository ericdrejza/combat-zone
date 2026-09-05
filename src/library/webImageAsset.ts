import type { LibraryImageAsset } from "./types";
import { isHttpImageUrl } from "@core/assets/imageAssetSource";
import { getFileNameWithoutExtension } from "./fileName";

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
  return isHttpImageUrl(value);
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
    source: { kind: "url", url: url.href },
    mediaType: IMAGE_MEDIA_TYPES[extension] ?? "image/*",
    name: getFileNameWithoutExtension(decodedName || "Linked image")
  };
}
