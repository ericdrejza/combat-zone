import { useEffect, useState } from "react";

type StillSourceKind = "image" | "video";

const MAX_CACHED_STILLS = 64;
const MAX_CONCURRENT_CAPTURES = 2;
const stillSourceCache = new Map<string, Map<string, Promise<string | null>>>();
const pendingCaptures: Array<() => void> = [];
let activeCaptures = 0;

function scheduleCapture(task: () => Promise<string | null>) {
  return new Promise<string | null>((resolve) => {
    const start = () => {
      activeCaptures += 1;
      void task().then(resolve, () => resolve(null)).finally(() => {
        activeCaptures -= 1;
        pendingCaptures.shift()?.();
      });
    };
    if (activeCaptures < MAX_CONCURRENT_CAPTURES) start();
    else pendingCaptures.push(start);
  });
}

function fitWithin(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale))
  };
}

function releaseVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function captureStillSource(
  src: string,
  kind: StillSourceKind,
  maxDimension: number
): Promise<string | null> {
  const variantKey = `${kind}:${maxDimension}`;
  const variants = stillSourceCache.get(src);
  const cached = variants?.get(variantKey);
  if (cached) return cached;

  const pending = scheduleCapture(() => new Promise<string | null>((resolve) => {
    const media = kind === "video" ? document.createElement("video") : new Image();
    const loadedEvent = kind === "video" ? "loadeddata" : "load";
    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      if (media instanceof HTMLVideoElement) releaseVideo(media);
      resolve(result);
    };

    media.addEventListener(loadedEvent, () => {
      const sourceWidth = media instanceof HTMLVideoElement
        ? media.videoWidth
        : media.naturalWidth || media.width;
      const sourceHeight = media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight || media.height;
      if (!sourceWidth || !sourceHeight) {
        finish(null);
        return;
      }

      try {
        const size = fitWithin(sourceWidth, sourceHeight, maxDimension);
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (!context) {
          finish(null);
          return;
        }
        context.drawImage(media, 0, 0, size.width, size.height);
        finish(canvas.toDataURL("image/webp", 0.82));
      } catch {
        finish(null);
      }
    }, { once: true });
    media.addEventListener("error", () => finish(null), { once: true });
    if (media instanceof HTMLVideoElement) {
      media.muted = true;
      media.playsInline = true;
      media.preload = "auto";
    }
    media.src = src;
  }));

  if (variants) variants.set(variantKey, pending);
  else stillSourceCache.set(src, new Map([[variantKey, pending]]));
  if (stillSourceCache.size > MAX_CACHED_STILLS) {
    stillSourceCache.delete(stillSourceCache.keys().next().value as string);
  }
  return pending;
}

/** Returns one bounded, shared first-frame capture while animated media is frozen. */
export function useStillImageSource(
  src: string | null,
  freeze: boolean,
  kind: StillSourceKind = "image",
  maxDimension = 512
): string | null {
  const [stillSource, setStillSource] = useState<string | null>(null);

  useEffect(() => {
    if (!src || !freeze) {
      setStillSource(null);
      return;
    }

    let cancelled = false;
    void captureStillSource(src, kind, maxDimension).then((captured) => {
      if (!cancelled) setStillSource(captured);
    });
    return () => { cancelled = true; };
  }, [freeze, kind, maxDimension, src]);

  // Rendering the original animated source while the capture is pending lets
  // it advance before React can replace it. Leave the image blank briefly
  // instead so a disabled animation never paints a moving frame.
  return freeze ? stillSource : src;
}
