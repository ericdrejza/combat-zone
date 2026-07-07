import type { RootState } from "../../store/store";
import {
  CANVAS_BACKGROUND_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from "./canvasConstants";

type CanvasBackgroundLayerProps = {
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
};

export function CanvasBackgroundLayer({
  backgroundImage
}: CanvasBackgroundLayerProps) {
  return (
    <>
      <rect
        fill={CANVAS_BACKGROUND_COLOR}
        height={CANVAS_HEIGHT}
        width={CANVAS_WIDTH}
      />
      {backgroundImage ? (
        <image
          aria-label="Canvas background image"
          height={CANVAS_HEIGHT}
          href={backgroundImage.dataUrl}
          preserveAspectRatio="xMidYMid slice"
          width={CANVAS_WIDTH}
          x="0"
          y="0"
        />
      ) : null}
    </>
  );
}
