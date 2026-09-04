import { ImageOff, LoaderCircle } from "lucide-react";
import { motion, type MotionValue } from "motion/react";
import { useEffect, useState } from "react";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";

type AssetImagePreviewProps = {
  name: string;
  rotation: MotionValue<string>;
  source: ImageAssetSource;
};

/** Keeps every pending card on one shared rotation value so loaders stay in phase. */
export function AssetImagePreview({
  name,
  rotation,
  source
}: AssetImagePreviewProps) {
  const src = useResolvedImageSource(source);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

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
      {src ? <img
        alt=""
        className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
        onError={() => setStatus("error")}
        onLoad={() => setStatus("loaded")}
        src={src}
      /> : null}
    </>
  );
}
