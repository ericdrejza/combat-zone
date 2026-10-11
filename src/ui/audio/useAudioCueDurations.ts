import { useImageSourceLease } from "@core/assets/ImageAssetResolver";
import type { LibraryImageAsset } from "@library/types";
import { readAudioDuration } from "./ambienceCueDefaults";

/** Hold source leases through metadata reads and read linked assets once per batch. */
export function useAudioCueDurations() {
  const acquireSource = useImageSourceLease();
  return (assets: Array<LibraryImageAsset | null | undefined>): Promise<Array<number | null>> => {
    const reads = new Map<LibraryImageAsset, Promise<number | null>>();
    return Promise.all(assets.map((asset) => {
      if (!asset) return null;
      let reading = reads.get(asset);
      if (!reading) {
        reading = (async () => {
          const source = await acquireSource(asset.source);
          if (!source) return null;
          try { return await readAudioDuration(source.url); }
          finally { source.release(); }
        })();
        reads.set(asset, reading);
      }
      return reading;
    }));
  };
}
