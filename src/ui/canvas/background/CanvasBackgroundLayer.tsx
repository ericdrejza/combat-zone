import type { RootState } from "@store/store";
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { isVideoMediaType } from "@library/mediaAsset";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ControlledVideo } from "@core/rendering/ControlledVideo";
import { useStillImageSource } from "@core/assets/useStillImageSource";

type CanvasBackgroundLayerProps = {
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  canvasSize: CanvasSize;
};

export function CanvasBackgroundLayer({
  backgroundImage,
  canvasSize
}: CanvasBackgroundLayerProps) {
  const backgroundUrl = useResolvedImageSource(backgroundImage?.source);
  const isVideo = isVideoMediaType(backgroundImage?.mediaType);
  const { enableAssetAnimation } = useInterfacePreferences();
  const stillBackgroundUrl = useStillImageSource(
    backgroundUrl,
    isVideo && !enableAssetAnimation,
    "video",
    1920
  );

  return (
    <>
      <rect
        className="fill-canvas-panel"
        height={canvasSize.height}
        width={canvasSize.width}
      />
      {backgroundImage && backgroundUrl && isVideo && enableAssetAnimation ? (
        <foreignObject
          aria-label="Canvas background video"
          height={canvasSize.height}
          pointerEvents="none"
          width={canvasSize.width}
          x="0"
          y="0"
        >
          <ControlledVideo
            className="h-full w-full object-fill"
            play={enableAssetAnimation}
            src={backgroundUrl}
          />
        </foreignObject>
      ) : backgroundImage && (stillBackgroundUrl || (!isVideo && backgroundUrl)) ? (
        <image
          aria-label="Canvas background image"
          height={canvasSize.height}
          href={stillBackgroundUrl ?? backgroundUrl ?? undefined}
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
