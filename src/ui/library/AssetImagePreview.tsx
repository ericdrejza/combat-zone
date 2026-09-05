import { ImageOff, LoaderCircle } from "lucide-react";
import { motion, type MotionValue } from "motion/react";
import { useState } from "react";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";

type AssetImagePreviewProps = {
  imageAlt?: string;
  name: string;
  rotation: MotionValue<string>;
  source: ImageAssetSource;
};

type ResolvedAssetImagePreviewProps = Omit<AssetImagePreviewProps, "source"> & {
  src: string | null;
};

function ResolvedAssetImagePreview({
  imageAlt = "",
  name,
  rotation,
  src
}: ResolvedAssetImagePreviewProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error"
  );

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
      {src ? (
        <img
          alt={imageAlt}
          className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
          draggable={false}
          onError={() => setStatus("error")}
          onLoad={() => setStatus("loaded")}
          src={src}
        />
      ) : null}
    </>
  );
}

/** Keeps every pending card on one shared rotation value so loaders stay in phase. */
export function AssetImagePreview({
  imageAlt = "",
  name,
  rotation,
  source
}: AssetImagePreviewProps) {
  const src = useResolvedImageSource(source);

  // A changed source gets a fresh load lifecycle. This prevents a late effect
  // from restoring "loading" after a cached image has already fired onLoad.
  return (
    <ResolvedAssetImagePreview
      imageAlt={imageAlt}
      key={src ?? "unresolved"}
      name={name}
      rotation={rotation}
      src={src}
    />
  );
}
