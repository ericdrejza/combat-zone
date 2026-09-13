import type { LibraryImageAsset, LibraryNode } from "@library/types";

function getEmbeddedDataUrlByteSize(dataUrl: string): number | null {
  const separatorIndex = dataUrl.indexOf(",");
  const metadata = dataUrl.slice(0, separatorIndex);
  const payload = dataUrl.slice(separatorIndex + 1);

  if (separatorIndex < 0 || !metadata.endsWith(";base64")) {
    return null;
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

function formatByteSize(byteSize: number): string {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats original local upload bytes; linked and remote assets intentionally have no display size. */
export function getUploadedAssetSizeLabel(
  node: LibraryNode,
  asset: LibraryImageAsset | null
): string | null {
  if (node.type !== "image" || !asset) {
    return null;
  }

  if (asset.source.kind === "local_asset") {
    return formatByteSize(asset.source.byteLength);
  }
  if (asset.source.kind !== "embedded") return null;

  const byteSize = getEmbeddedDataUrlByteSize(asset.source.dataUrl);

  if (byteSize === null) {
    return null;
  }

  return formatByteSize(byteSize);
}
