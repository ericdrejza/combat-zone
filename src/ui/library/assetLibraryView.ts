import type { LibraryImageAsset } from "@library/types";

export type AssetLibraryViewMode = "grid" | "list";

export type AssetLibraryPreviewTarget = {
  asset: LibraryImageAsset;
  name: string;
};
