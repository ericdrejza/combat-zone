import { Cloud, Link, Link2, Video } from "lucide-react";

import googleDriveIcon from "@icons/google-drive-2026.svg";
import { isAnimatedAsset, isVideoAsset } from "@library/mediaAsset";
import type { LibraryImageAsset, LibraryNode } from "@library/types";

type AssetLibraryAssetTypeIconProps = {
  asset: LibraryImageAsset | null | undefined;
  node: LibraryNode;
};

/** Displays the non-default origin or media type of a Library asset. */
export function AssetLibraryAssetTypeIcon({
  asset,
  node
}: AssetLibraryAssetTypeIconProps) {
  if (asset && (isVideoAsset(asset) || isAnimatedAsset(asset))) {
    return <Video aria-label="Video asset" className="h-3.5 w-3.5 flex-none" />;
  }

  if (node.type === "link") {
    return <Link aria-label="Linked asset" className="h-3.5 w-3.5 flex-none" />;
  }

  switch (asset?.source.kind) {
    case "embedded":
      return null;
    case "url":
      return <Link2 aria-label="Web link" className="h-3.5 w-3.5 flex-none" />;
    case "google_drive":
      return <img alt="Google Drive" className="h-3.5 w-3.5 flex-none" src={googleDriveIcon} />;
    case "cloud_storage":
      return <Cloud aria-label="Cloud storage asset" className="h-3.5 w-3.5 flex-none" />;
    default:
      return null;
  }
}
