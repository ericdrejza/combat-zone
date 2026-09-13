import { ImageOff, LoaderCircle } from "lucide-react";
import { motion, type MotionValue } from "motion/react";
import { useState } from "react";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { isVideoMediaType } from "@library/mediaAsset";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ControlledVideo } from "@core/rendering/ControlledVideo";
import { useStillImageSource } from "@core/assets/useStillImageSource";

type AssetImagePreviewProps = {
  imageAlt?: string;
  mediaType?: string;
  name: string;
  rotation: MotionValue<string>;
  playAnimations?: boolean;
  source: ImageAssetSource;
};

type ResolvedAssetImagePreviewProps = Omit<AssetImagePreviewProps, "source"> & {
  src: string | null;
};

function ResolvedAssetImagePreview({
  imageAlt = "",
  mediaType = "image/*",
  name,
  rotation,
  playAnimations = true,
  src
}: ResolvedAssetImagePreviewProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error"
  );
  const isVideo = isVideoMediaType(mediaType);
  const freeze = !playAnimations && (isVideo || mediaType === "image/webp");
  const stillFrameSrc = useStillImageSource(
    src,
    freeze,
    isVideo ? "video" : "image"
  );
  const displaySrc = freeze ? stillFrameSrc : src;

  return (
    <>
      {status === "loading" ? (
        <motion.span
          aria-label={`${name} image loading`}
          className="text-canvas-muted"
          role="status"
          style={{ transform: rotation }}
        >
          <LoaderCircle aria-hidden="true" className="h-7 w-7" />
        </motion.span>
      ) : null}
      {status === "error" ? (
        <ImageOff
          aria-label={`${name} image failed to load`}
          className="h-7 w-7 text-canvas-muted"
        />
      ) : null}
      {displaySrc ? isVideo && !freeze ? (
        <ControlledVideo
          ariaLabel={imageAlt || `${name} video`}
          className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
          onError={() => setStatus("error")}
          onLoadedData={() => setStatus("loaded")}
          play={playAnimations}
          src={displaySrc}
        />
      ) : (
        <img
          alt={imageAlt}
          className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
          draggable={false}
          onError={() => setStatus("error")}
          onLoad={() => setStatus("loaded")}
          src={displaySrc}
        />
      ) : null}
    </>
  );
}

/** Keeps every pending card on one shared rotation value so loaders stay in phase. */
export function AssetImagePreview({
  imageAlt = "",
  mediaType = "image/*",
  name,
  rotation,
  playAnimations = true,
  source
}: AssetImagePreviewProps) {
  const { enableAssetAnimation } = useInterfacePreferences();
  const src = useResolvedImageSource(source);

  // A changed source gets a fresh load lifecycle. This prevents a late effect
  // from restoring "loading" after a cached image has already fired onLoad.
  return (
    <ResolvedAssetImagePreview
      imageAlt={imageAlt}
      key={src ?? "unresolved"}
      mediaType={mediaType}
      name={name}
      playAnimations={enableAssetAnimation && playAnimations}
      rotation={rotation}
      src={src}
    />
  );
}
