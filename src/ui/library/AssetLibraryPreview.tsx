import { ImageOff } from "lucide-react";
import type { MotionValue } from "motion/react";

import { AssetImagePreview } from "./AssetImagePreview";
import type { AssetLibraryPreviewTarget } from "./assetLibraryView";

type AssetLibraryPreviewProps = {
  rotation: MotionValue<string>;
  target: AssetLibraryPreviewTarget | null;
};

export function AssetLibraryPreview({
  rotation,
  target
}: AssetLibraryPreviewProps) {
  return (
    <div
      aria-label="Asset preview"
      className="flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-canvas-line bg-canvas p-3"
    >
      {target ? (
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl">
          <AssetImagePreview
            imageAlt={target.name}
            name={target.name}
            rotation={rotation}
            source={target.asset.source}
          />
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
