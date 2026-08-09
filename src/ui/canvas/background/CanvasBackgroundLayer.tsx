import type { RootState } from "@store/store";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { CANVAS_BACKGROUND_COLOR } from "../canvasConstants";

type CanvasBackgroundLayerProps = {
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  canvasSize: CanvasSize;
};

export function CanvasBackgroundLayer({
  backgroundImage,
  canvasSize
}: CanvasBackgroundLayerProps) {
  return (
    <>
      <rect
        fill={CANVAS_BACKGROUND_COLOR}
        height={canvasSize.height}
        width={canvasSize.width}
      />
      {backgroundImage ? (
        <image
          aria-label="Canvas background image"
          height={canvasSize.height}
          href={backgroundImage.dataUrl}
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
