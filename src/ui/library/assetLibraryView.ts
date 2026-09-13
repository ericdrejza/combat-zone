import type { LibraryImageAsset } from "@library/types";

export type AssetLibraryViewMode = "grid" | "list";

export type AssetLibraryContextButtonState = {
  playAnimations: boolean;
  showAssetSizes: boolean;
};

export const DEFAULT_ASSET_LIBRARY_CONTEXT_BUTTON_STATE: AssetLibraryContextButtonState = {
  playAnimations: false,
  showAssetSizes: false
};

export type AssetLibraryPreviewTarget = {
  asset: LibraryImageAsset;
  name: string;
};
