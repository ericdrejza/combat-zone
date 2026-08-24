import { ImageOff, LoaderCircle } from "lucide-react";
import { motion, type MotionValue } from "motion/react";
import { useState } from "react";

type AssetImagePreviewProps = {
  name: string;
  rotation: MotionValue<string>;
  src: string;
};

/** Keeps every pending card on one shared rotation value so loaders stay in phase. */
export function AssetImagePreview({
  name,
  rotation,
  src
}: AssetImagePreviewProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
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
      <img
        alt=""
        className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
        onError={() => setStatus("error")}
        onLoad={() => setStatus("loaded")}
        src={src}
      />
    </>
  );
}
