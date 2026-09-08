import type { RootState } from "@store/store";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";

type CanvasBackgroundLayerProps = {
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  canvasSize: CanvasSize;
};

export function CanvasBackgroundLayer({
  backgroundImage,
  canvasSize
}: CanvasBackgroundLayerProps) {
  const backgroundUrl = useResolvedImageSource(backgroundImage?.source);

  return (
    <>
      <rect
        className="fill-canvas-panel"
        height={canvasSize.height}
        width={canvasSize.width}
      />
      {backgroundImage && backgroundUrl ? (
        <image
          aria-label="Canvas background image"
          height={canvasSize.height}
          href={backgroundUrl}
          preserveAspectRatio="none"
          width={canvasSize.width}
          x="0"
          y="0"
        />
      ) : null}
      <rect
        aria-hidden="true"
        className="pointer-events-none fill-none stroke-canvas-line"
        data-canvas-boundary="true"
        height={Math.max(0, canvasSize.height - 2)}
        strokeDasharray="8 8"
        strokeOpacity="0.8"
        strokeWidth="2"
        width={Math.max(0, canvasSize.width - 2)}
        x="1"
        y="1"
      />
    </>
  );
}
