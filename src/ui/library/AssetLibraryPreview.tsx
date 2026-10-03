import { ImageOff } from "lucide-react";
import type { MotionValue } from "motion/react";

import { AssetImagePreview } from "./AssetImagePreview";
import type { AssetLibraryPreviewTarget } from "./assetLibraryView";
import { isAudioMediaType } from "@library/mediaAsset";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { AudioAssetIcon } from "./AudioAssetIcon";

type AssetLibraryPreviewProps = {
  compact?: boolean;
  playAudio?: boolean;
  playAnimations: boolean;
  rotation: MotionValue<string>;
  target: AssetLibraryPreviewTarget | null;
};

export function AssetLibraryPreview({
  compact = false,
  playAudio = false,
  playAnimations,
  rotation,
  target
}: AssetLibraryPreviewProps) {
  const sourceUrl = useResolvedImageSource(target?.asset.source);
  return (
    <div
      aria-label="Asset preview"
      className={compact ? "min-w-0" : "flex h-full min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-canvas-line bg-canvas p-3 [&_img]:object-contain"}
    >
      {target ? (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
          {isAudioMediaType(target.asset.mediaType) ? (
            <div className={compact ? "flex w-full min-w-0 items-center gap-3" : "w-full space-y-3 text-center"}><AudioAssetIcon asset={target.asset} className={compact ? "h-5 w-5 shrink-0" : "mx-auto h-8 w-8"} /><p className={compact ? "max-w-32 truncate text-sm font-semibold" : "font-semibold"}>{target.name}</p>{playAudio && sourceUrl ? <audio aria-label={`Preview ${target.name}`} autoPlay className={compact ? "h-10 min-w-0 flex-1" : "w-full"} controls controlsList="noplaybackrate" key={sourceUrl} src={sourceUrl} /> : <p className="text-sm text-canvas-muted">{playAudio ? "Loading audio preview…" : "Audio preview is off."}</p>}</div>
          ) : <AssetImagePreview
            imageAlt={target.name}
            name={target.name}
            mediaType={target.asset.mediaType}
            playAnimations={playAnimations}
            rotation={rotation}
            source={target.asset.source}
          />}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center text-sm text-canvas-muted">
          <ImageOff aria-hidden="true" className="h-8 w-8" />
          Hover an image to preview it.
        </div>
      )}
    </div>
  );
}
