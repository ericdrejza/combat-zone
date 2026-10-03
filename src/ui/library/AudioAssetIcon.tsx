import { AudioLines, Music } from "lucide-react";
import type { LibraryImageAsset } from "@library/types";

/** Links use their resolved asset's preference; missing preferences mean Audio. */
export function AudioAssetIcon({ asset, className = "h-8 w-8" }: {
  asset?: LibraryImageAsset | null; className?: string;
}) {
  const Icon = asset?.audioIcon === "music" ? Music : AudioLines;
  return <Icon aria-label={asset?.audioIcon === "music" ? "Music asset" : "Audio asset"} className={className} role="img" />;
}
